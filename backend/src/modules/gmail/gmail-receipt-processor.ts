import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { notInVersionWorkspace } from '../../common/workspaces/version-workspaces';
import {
  ActorType,
  AuditAction,
  EntityType,
  Integration,
  Receipt,
  ReceiptJobStatus,
  ReceiptProcessingJob,
  ReceiptStatus,
} from '../../entities';
import { AuditService } from '../audit/audit.service';
import type { ReceiptUncategorizedEvent } from '../notifications/events/notification-events';
import { ReceiptMatchService } from '../receipts/services/receipt-match.service';
import type { GmailApi } from './gmail-api.types';
import { GmailService } from './services/gmail.service';
import { GmailReceiptCategoryService } from './services/gmail-receipt-category.service';
import { GmailReceiptDuplicateService } from './services/gmail-receipt-duplicate.service';
import { GmailReceiptParserService } from './services/gmail-receipt-parser.service';

const JOB_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).substr(2, 9)}`;

type ReceiptAttachment = NonNullable<NonNullable<Receipt['metadata']>['attachments']>[number];

@Injectable()
export class GmailReceiptProcessor {
  private readonly logger = new Logger(GmailReceiptProcessor.name);
  private processing = false;

  constructor(
    @InjectRepository(ReceiptProcessingJob)
    private readonly jobRepository: Repository<ReceiptProcessingJob>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly gmailService: GmailService,
    private readonly parserService: GmailReceiptParserService,
    private readonly duplicateService: GmailReceiptDuplicateService,
    private readonly categoryService: GmailReceiptCategoryService,
    private readonly auditService: AuditService,
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    private readonly matchService?: ReceiptMatchService,
  ) {}

  private getHeaderValue(
    headers: GmailApi.MessagePartHeader[] | null | undefined,
    name: string,
  ): string {
    return headers?.find(header => header.name?.toLowerCase() === name.toLowerCase())?.value || '';
  }

  @Interval(3000)
  async processJobs(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      const now = new Date();
      const lockTimeout = new Date(now.getTime() - JOB_LOCK_TIMEOUT_MS);

      // Find pending jobs or stale locked jobs. A past version takes no mail in;
      // its jobs are left out here rather than failed, so they never block the queue.
      const job = await this.jobRepository
        .createQueryBuilder('job')
        .where(
          new Brackets(status =>
            status
              .where('job.status = :status', { status: ReceiptJobStatus.PENDING })
              .orWhere('job.status = :processing AND job.lockedAt < :lockTimeout', {
                processing: ReceiptJobStatus.PROCESSING,
                lockTimeout,
              }),
          ),
        )
        .andWhere(notInVersionWorkspace('job.workspaceId'))
        .orderBy('job.createdAt', 'ASC')
        .limit(1)
        .getOne();

      if (!job) {
        return;
      }

      // Lock the job
      const lockResult = await this.jobRepository
        .createQueryBuilder()
        .update(ReceiptProcessingJob)
        .set({
          status: ReceiptJobStatus.PROCESSING,
          lockedAt: now,
          lockedBy: WORKER_ID,
        })
        .where('id = :id', { id: job.id })
        .andWhere('status = :status', { status: job.status })
        .execute();

      if (lockResult.affected === 0) {
        return;
      }

      // Process the job
      await this.processJob(job);
    } catch (error) {
      this.logger.error('Error in job processor', error);
    } finally {
      this.processing = false;
    }
  }

  private async processJob(job: ReceiptProcessingJob): Promise<void> {
    try {
      this.logger.log(`Processing job ${job.id} for message ${job.payload.gmailMessageId}`);

      // Get integration
      const integration = await this.integrationRepository.findOne({
        where: { id: job.payload.integrationId },
        relations: ['workspace'],
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      // The receipt goes into the workspace the mailbox was connected in.
      const workspaceId = integration.workspaceId || integration.workspace?.id || null;

      if (!workspaceId) {
        throw new Error('No workspace found for integration');
      }

      // Check if receipt already exists; per workspace, as the same mailbox may
      // be connected in several workspaces.
      const existing = await this.receiptRepository.findOne({
        where: { workspaceId, gmailMessageId: job.payload.gmailMessageId },
      });

      if (existing) {
        this.logger.log(`Receipt already exists for message ${job.payload.gmailMessageId}`);
        job.status = ReceiptJobStatus.COMPLETED;
        job.receiptId = existing.id;
        await this.jobRepository.save(job);
        return;
      }

      // Fetch message from Gmail
      const message = await this.gmailService.getMessage(workspaceId, job.payload.gmailMessageId);

      // Extract metadata
      const headers = message.payload?.headers || [];
      const subject = this.getHeaderValue(headers, 'Subject');
      const sender = this.getHeaderValue(headers, 'From');
      const dateHeader = this.getHeaderValue(headers, 'Date');
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
      const emailBody = this.extractEmailBody(message.payload || undefined);

      // Find attachments
      const attachments: ReceiptAttachment[] = [];
      const findAttachments = (part?: GmailApi.MessagePart) => {
        if (!part) {
          return;
        }

        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0,
          });
        }
        if (Array.isArray(part.parts)) {
          part.parts.forEach(findAttachments);
        }
      };
      findAttachments(message.payload || undefined);

      // Download attachments
      const attachmentPaths: string[] = [];
      for (const attachment of attachments) {
        try {
          const filePath = await this.gmailService.downloadAttachment(
            workspaceId,
            job.payload.gmailMessageId,
            attachment.id,
            attachment.filename,
          );
          attachmentPaths.push(filePath);
        } catch (error) {
          this.logger.error(`Failed to download attachment ${attachment.filename}`, error);
        }
      }

      // Parse receipts from attachments
      let parsedData = null;
      let initialStatus = ReceiptStatus.NEW;

      if (attachmentPaths.length > 0) {
        try {
          parsedData = await this.parserService.parseReceipt(attachmentPaths[0], {
            sender,
            subject,
            dateHeader,
            emailBody,
          });
          job.progress = 60;
          await this.jobRepository.save(job);

          if (parsedData) {
            if (this.hasParsedAmount(parsedData.amount)) {
              initialStatus = ReceiptStatus.PARSED;
            } else {
              initialStatus = ReceiptStatus.NEEDS_REVIEW;
              parsedData = {
                ...parsedData,
                validationIssues: this.withValidationIssue(
                  parsedData.validationIssues,
                  'missing_amount',
                ),
              };
            }
          }
        } catch (error) {
          this.logger.error('Failed to parse receipt', error);
          initialStatus = ReceiptStatus.FAILED;
        }
      } else if (emailBody) {
        try {
          parsedData = await this.parserService.parseFromEmailOnly({
            sender,
            subject,
            dateHeader,
            emailBody,
          });

          if (parsedData) {
            if (this.hasParsedAmount(parsedData.amount)) {
              initialStatus = ReceiptStatus.PARSED;
            } else {
              initialStatus = ReceiptStatus.NEEDS_REVIEW;
            }
          }
        } catch (error) {
          this.logger.error('Failed to parse receipt from email body', error);
          initialStatus = ReceiptStatus.NEEDS_REVIEW;
        }
      }

      // Create receipt
      const receipt = this.receiptRepository.create({
        userId: job.userId,
        workspaceId,
        gmailMessageId: job.payload.gmailMessageId,
        gmailThreadId: message.threadId || '',
        subject,
        sender,
        receivedAt,
        status: initialStatus,
        metadata: {
          attachments,
          labels: message.labelIds || [],
          snippet: message.snippet ?? undefined,
        },
        // Saving turns the omitted column into null, as before.
        parsedData: parsedData ?? undefined,
        attachmentPaths,
        taxAmount: parsedData?.tax || null,
        isDuplicate: false,
      });

      const savedReceipt = await this.receiptRepository.save(receipt);
      job.progress = 70;
      await this.jobRepository.save(job);

      // Audit: record receipt import from Gmail.
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.INTEGRATION,
        actorId: integration.connectedByUserId || job.userId,
        actorLabel: 'Gmail Import',
        entityType: EntityType.RECEIPT,
        entityId: savedReceipt.id,
        action: AuditAction.IMPORT,
        diff: { before: null, after: savedReceipt },
        meta: {
          integrationId: integration.id,
          gmailMessageId: job.payload.gmailMessageId,
          provider: 'gmail',
        },
      });

      // Check for duplicates
      if (parsedData && savedReceipt.status === ReceiptStatus.PARSED) {
        try {
          const potentialDuplicates =
            await this.duplicateService.findPotentialDuplicates(savedReceipt);

          if (potentialDuplicates.length > 0) {
            savedReceipt.metadata = {
              ...savedReceipt.metadata,
              potentialDuplicates: potentialDuplicates.map(d => d.id),
            };
            savedReceipt.status = ReceiptStatus.NEEDS_REVIEW;
          } else {
            savedReceipt.status = ReceiptStatus.DRAFT;
          }

          job.progress = 85;
          await this.jobRepository.save(job);
        } catch (error) {
          this.logger.error('Failed to check duplicates', error);
        }
      }

      // Suggest category
      if (parsedData && savedReceipt.status !== ReceiptStatus.FAILED) {
        try {
          await this.categoryService.categorize(savedReceipt);

          job.progress = 95;
          await this.jobRepository.save(job);
        } catch (error) {
          this.logger.error('Failed to suggest category', error);
        }
      }

      if (parsedData && savedReceipt.status !== ReceiptStatus.FAILED && this.matchService) {
        try {
          await this.matchService.suggest(savedReceipt);
        } catch (error) {
          this.logger.error('Failed to match receipt to a transaction', error);
        }
      }

      if (!savedReceipt.parsedData?.categoryId) {
        this.eventEmitter?.emit('receipt.uncategorized', {
          workspaceId,
          userId: integration.connectedByUserId || job.userId,
          receiptId: savedReceipt.id,
          receiptName: savedReceipt.subject,
        } satisfies ReceiptUncategorizedEvent);
      }

      // Save final receipt state
      await this.receiptRepository.save(savedReceipt);

      // Mark job as completed
      job.status = ReceiptJobStatus.COMPLETED;
      job.progress = 100;
      job.receiptId = savedReceipt.id;
      job.result = { receiptId: savedReceipt.id };
      await this.jobRepository.save(job);

      this.logger.log(
        `Successfully processed receipt ${savedReceipt.id} for message ${job.payload.gmailMessageId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to process job ${job.id}`, error);

      job.status = ReceiptJobStatus.FAILED;
      job.error = error instanceof Error ? error.message : String(error);
      await this.jobRepository.save(job);
    }
  }

  private extractEmailBody(payload?: GmailApi.MessagePart): string | null {
    const bodies: { mimeType: string; data: string }[] = [];

    const walk = (part?: GmailApi.MessagePart) => {
      if (part?.body?.data && (part.mimeType === 'text/plain' || part.mimeType === 'text/html')) {
        bodies.push({
          mimeType: part.mimeType,
          data: part.body.data,
        });
      }

      if (Array.isArray(part?.parts)) {
        for (const child of part.parts) {
          walk(child);
        }
      }
    };

    walk(payload);

    const htmlPart = bodies.find(body => body.mimeType === 'text/html');
    const textPart = bodies.find(body => body.mimeType === 'text/plain');
    const selected = htmlPart || textPart;

    if (!selected) {
      return null;
    }

    try {
      return Buffer.from(selected.data, 'base64url').toString('utf8');
    } catch {
      return null;
    }
  }

  private hasParsedAmount(amount: unknown): boolean {
    if (typeof amount === 'number') {
      return Number.isFinite(amount);
    }

    if (typeof amount === 'string') {
      const normalized = amount.trim();
      if (!normalized) {
        return false;
      }
      return Number.isFinite(Number(normalized));
    }

    return false;
  }

  private withValidationIssue(existing: unknown, issue: string): string[] {
    if (!Array.isArray(existing)) {
      return [issue];
    }

    const issues = existing.filter(value => typeof value === 'string');
    if (issues.includes(issue)) {
      return issues;
    }

    return [...issues, issue];
  }
}
