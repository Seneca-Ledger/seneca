import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import type { CaptureLocation } from '../../common/utils/capture-location.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { normalizePagination } from '../../common/utils/pagination.util';
import {
  Category,
  Receipt,
  ReceiptJobStatus,
  ReceiptProcessingJob,
  ReceiptSource,
  ReceiptStatus,
  Statement,
  Transaction,
  TransactionType,
} from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { TransactionCategorySource } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { ReceiptApprovedEvent } from '../notifications/events/notification-events';
import { TransactionAttachmentsService } from '../transactions/services/transaction-attachments.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { ReceiptQueryDto } from './dto/receipt-query.dto';
import {
  attachReceiptCategories,
  type ReceiptWithCategory,
} from './helpers/attach-receipt-categories';
import { ReceiptProcessorService } from './services/receipt-processor.service';

export interface ApproveReceiptOptions {
  /** Bank row to attach to; `null` forces a new transaction; omitted uses the stored suggestion. */
  attachTo?: string | null;
  /** Who approved; needed to record the copied file attachment. */
  userId?: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

function mimeTypeOf(fileName: string): string {
  return MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
}

type UploadParams = {
  userId: string;
  workspaceId: string;
  files: Express.Multer.File[];
  language?: string;
  captureLocation?: CaptureLocation;
};

type ScanParams = {
  userId: string;
  workspaceId: string;
  file: Express.Multer.File;
  language?: string;
  captureLocation?: CaptureLocation;
  /** Where the file came from; defaults to the in-app camera scan. */
  source?: ReceiptSource;
};

const MANUAL_RECEIPT_WORKER_ID = 'manual-receipt-sync';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptProcessingJob)
    private readonly jobRepository: Repository<ReceiptProcessingJob>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly receiptProcessor: ReceiptProcessorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    @Optional()
    private readonly attachmentsService?: TransactionAttachmentsService,
  ) {}

  async createFromUpload(params: UploadParams): Promise<Receipt> {
    const [file] = params.files;
    const receipt = this.buildReceipt({
      userId: params.userId,
      workspaceId: params.workspaceId,
      source: ReceiptSource.UPLOAD,
      file,
      language: params.language,
      captureLocation: params.captureLocation,
    });

    const savedReceipt = await this.receiptRepository.save(receipt);
    const job = await this.createManualJob(
      savedReceipt.id,
      params.userId,
      'manual-upload',
      params.language,
    );
    await this.receiptProcessor.processReceipt(job);

    const result =
      (await this.receiptRepository.findOne({
        where: { id: savedReceipt.id, workspaceId: params.workspaceId },
      })) ?? savedReceipt;
    await this.recordCreate(result, params.userId, params.workspaceId);
    return result;
  }

  async createFromScan(params: ScanParams): Promise<Receipt> {
    const receipt = this.buildReceipt({
      userId: params.userId,
      workspaceId: params.workspaceId,
      source: params.source ?? ReceiptSource.SCAN,
      file: params.file,
      language: params.language,
      captureLocation: params.captureLocation,
    });

    const savedReceipt = await this.receiptRepository.save(receipt);
    const job = await this.createManualJob(
      savedReceipt.id,
      params.userId,
      'manual-scan',
      params.language,
    );
    await this.receiptProcessor.processReceipt(job);

    const result =
      (await this.receiptRepository.findOne({
        where: { id: savedReceipt.id, workspaceId: params.workspaceId },
      })) ?? savedReceipt;
    await this.recordCreate(result, params.userId, params.workspaceId);
    return result;
  }

  async findAll(workspaceId: string, query: ReceiptQueryDto) {
    const { page, limit, skip } = normalizePagination(query);
    const where: Record<string, unknown> = { workspaceId };

    if (query.source) {
      where.source = query.source;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await this.receiptRepository.findAndCount({
      where,
      order: { receivedAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data: await this.withCategories(data, workspaceId), total, page, limit };
  }

  async findOne(id: string, workspaceId: string): Promise<ReceiptWithCategory | null> {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }
    const [withCategory] = await this.withCategories([receipt], workspaceId);
    return withCategory;
  }

  private withCategories(receipts: Receipt[], workspaceId: string): Promise<ReceiptWithCategory[]> {
    return attachReceiptCategories(receipts, this.categoryRepository, workspaceId);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: {
      status?: ReceiptStatus;
      parsedData?: Record<string, unknown>;
      statementId?: string | null;
    },
    // Only a user's edit is audited; the scan linking its own statement passes none.
    userId?: string,
  ) {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }
    const before = this.changedFields(receipt, dto);

    if (dto.status) {
      receipt.status = dto.status;
    }

    if (dto.parsedData) {
      receipt.parsedData = {
        ...(receipt.parsedData ?? {}),
        ...dto.parsedData,
      };
    }

    if (dto.statementId !== undefined) {
      receipt.statementId = dto.statementId;
    }

    const saved = await this.receiptRepository.save(receipt);
    await this.syncStatementCategory(saved, workspaceId);

    if (userId) {
      await this.recordAudit({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.RECEIPT,
        entityId: saved.id,
        action: AuditAction.UPDATE,
        diff: { before, after: this.changedFields(saved, dto) },
      });
    }

    return saved;
  }

  /**
   * A scan receipt is converted into a statement before the user ever opens it,
   * so the statement carries the fallback category picked at conversion time.
   * When the user then picks a category on the receipt, the statement has to
   * follow — otherwise the choice is invisible everywhere the statement is shown.
   */
  private async syncStatementCategory(receipt: Receipt, workspaceId: string): Promise<void> {
    const categoryId = receipt.parsedData?.categoryId;
    if (!(receipt.statementId && categoryId)) {
      return;
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, workspaceId },
      select: ['id'],
    });
    if (!category) {
      return;
    }

    const statement = await this.statementRepository.findOne({
      where: { id: receipt.statementId, workspaceId },
    });
    if (!statement) {
      return;
    }

    await this.statementRepository.update(
      { id: statement.id, workspaceId },
      { categoryId: category.id },
    );

    // The dashboard aggregates by transaction category, so the transaction the
    // scan produced has to follow the receipt too — otherwise the spend stays
    // filed under the fallback category picked at conversion time. Statements
    // parsed from a bank file carry unrelated transactions and are left alone.
    if (statement.parsingDetails?.detectedBy === 'receipt-scan') {
      await this.transactionRepository.update(
        { statementId: statement.id, workspaceId },
        { categoryId: category.id },
      );
    }
  }

  async approve(
    id: string,
    workspaceId: string,
    userId: string,
    options: { attachTo?: string | null } = {},
  ) {
    const workspaceCurrency = await this.workspaceCurrency.resolve(workspaceId);
    const result = await this.approveOnce(
      id,
      workspaceId,
      receipt => this.buildTransactionFromReceipt(receipt, workspaceId, workspaceCurrency),
      { ...options, userId },
    );
    if (!result) {
      return null;
    }
    if (result.created || result.attached) {
      await this.recordAudit(this.approveEvent(result, userId, workspaceId));
    }
    return { receipt: result.receipt, transaction: result.transaction, attached: result.attached };
  }

  /**
   * Turns a receipt into its transaction at most once. The receipt row is locked
   * for the duration, so a repeated or concurrent approve finds the transaction
   * the first one made and returns it instead of booking the expense twice.
   * Every approve path (here and the Gmail receipts endpoints) goes through it;
   * `buildTransaction` only decides the new transaction's fields.
   */
  async approveOnce(
    receiptId: string,
    workspaceId: string,
    buildTransaction: (receipt: Receipt) => Partial<Transaction>,
    options: ApproveReceiptOptions = {},
  ): Promise<{
    receipt: Receipt;
    transaction: Transaction;
    created: boolean;
    /** The receipt was attached to a transaction that already existed: a bank row, or its scan's own. */
    attached: boolean;
    previousStatus: ReceiptStatus;
  } | null> {
    const result = await this.receiptRepository.manager.transaction(async manager => {
      const receipts = manager.getRepository(Receipt);
      const transactions = manager.getRepository(Transaction);
      const receipt = await receipts.findOne({
        where: { id: receiptId, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!receipt) {
        return null;
      }
      if (receipt.transactionId) {
        const existing = await transactions.findOne({
          where: { id: receipt.transactionId, workspaceId },
        });
        if (existing) {
          return {
            receipt,
            transaction: existing,
            created: false,
            attached: false,
            previousStatus: receipt.status,
          };
        }
      }

      const scanTransaction = await this.findScanTransaction(manager, receipt, workspaceId);

      // Attach to the bank row the receipt documents (the suggestion, or the
      // one the user picked) instead of booking the expense a second time.
      // `attachTo: null` is the explicit "no, this is a new expense".
      const attachTo =
        options.attachTo === undefined
          ? (receipt.metadata?.transactionMatch?.transactionIds?.[0] ?? null)
          : options.attachTo;
      if (attachTo) {
        const target = await transactions.findOne({ where: { id: attachTo, workspaceId } });
        if (!target) {
          throw new NotFoundException('Transaction to attach to was not found');
        }
        const taken = await receipts.findOne({
          where: { transactionId: attachTo, workspaceId },
          select: ['id'],
        });
        if (taken && taken.id !== receipt.id) {
          throw new ConflictException('Another receipt is already attached to that transaction');
        }
        // The bank row is the real payment; the transaction the scan booked
        // would count it twice. Flagged, not deleted, like any duplicate.
        if (scanTransaction && scanTransaction.id !== target.id) {
          await transactions.update(
            { id: scanTransaction.id, workspaceId },
            { isDuplicate: true, duplicateOfId: target.id },
          );
        }
        // Approving the receipt confirms the bank row it documents.
        await transactions.update(
          { id: target.id },
          !target.categoryId && receipt.parsedData?.categoryId
            ? {
                isVerified: true,
                categoryId: receipt.parsedData.categoryId,
                categorySource: TransactionCategorySource.HISTORY,
                categoryReason: receipt.parsedData.vendor ?? 'receipt',
              }
            : { isVerified: true },
        );
        const previousStatus = receipt.status;
        receipt.status = ReceiptStatus.APPROVED;
        receipt.transactionId = target.id;
        const saved = await receipts.save(receipt);
        return {
          receipt: saved,
          transaction: target,
          created: false,
          attached: true,
          previousStatus,
        };
      }

      // A scan booked its transaction at upload; approving confirms it with the
      // receipt as it stands now instead of booking the expense again.
      if (scanTransaction) {
        await transactions.update(
          { id: scanTransaction.id, workspaceId },
          {
            ...scanTransactionUpdate(buildTransaction(receipt), Boolean(receipt.parsedData?.date)),
            isVerified: true,
          },
        );
        const previousStatus = receipt.status;
        receipt.status = ReceiptStatus.APPROVED;
        receipt.transactionId = scanTransaction.id;
        const saved = await receipts.save(receipt);
        const confirmed = await transactions.findOneOrFail({
          where: { id: scanTransaction.id, workspaceId },
        });
        return {
          receipt: saved,
          transaction: confirmed,
          created: false,
          attached: true,
          previousStatus,
        };
      }

      const transaction = await transactions.save(
        transactions.create({ ...buildTransaction(receipt), isVerified: true }),
      );
      const previousStatus = receipt.status;
      receipt.status = ReceiptStatus.APPROVED;
      receipt.transactionId = transaction.id;
      const saved = await receipts.save(receipt);
      return { receipt: saved, transaction, created: true, attached: false, previousStatus };
    });

    if (result?.attached) {
      await this.copyFileToTransaction(result.receipt, result.transaction.id, options.userId);
    }

    if (result?.created) {
      this.eventEmitter
        .emitAsync('receipt.approved', {
          workspaceId: result.receipt.workspaceId,
          receiptId: result.receipt.id,
          transactionId: result.transaction.id,
        } satisfies ReceiptApprovedEvent)
        .catch(err => this.logger.error('Failed to emit receipt.approved event', err));
    }
    return result;
  }

  /**
   * The transaction a scan upload booked for this receipt. Only a scan's own
   * statement qualifies: a bank statement uploaded through the scan holds
   * unrelated rows.
   */
  private async findScanTransaction(
    manager: EntityManager,
    receipt: Receipt,
    workspaceId: string,
  ): Promise<Transaction | null> {
    if (!receipt.statementId) {
      return null;
    }
    const statement = await manager.getRepository(Statement).findOne({
      where: { id: receipt.statementId, workspaceId },
      select: ['id', 'parsingDetails'],
    });
    if (statement?.parsingDetails?.detectedBy !== 'receipt-scan') {
      return null;
    }
    return manager
      .getRepository(Transaction)
      .findOne({ where: { statementId: statement.id, workspaceId } });
  }

  async bulkApprove(
    receiptIds: string[],
    workspaceId: string,
    userId: string,
    categoryId?: string,
  ) {
    // Resolved once for the batch: a receipt whose parse found no currency is
    // booked in the workspace's own.
    const workspaceCurrency = await this.workspaceCurrency.resolve(workspaceId);
    const results = {
      approved: 0,
      failed: 0,
      errors: [] as Array<{ receiptId: string; error: string }>,
    };
    const auditEvents: CreateAuditEventDto[] = [];

    for (const receiptId of receiptIds) {
      try {
        const receipt = await this.receiptRepository.findOne({
          where: { id: receiptId, workspaceId },
        });

        if (!receipt) {
          results.failed += 1;
          results.errors.push({ receiptId, error: 'Receipt not found' });
          continue;
        }

        if (!(receipt.parsedData?.amount && receipt.parsedData?.date)) {
          results.failed += 1;
          results.errors.push({ receiptId, error: 'Missing required data' });
          continue;
        }

        const approved = await this.approveOnce(
          receiptId,
          workspaceId,
          locked =>
            this.buildTransactionFromReceipt(locked, workspaceId, workspaceCurrency, categoryId),
          { userId },
        );
        if (!approved) {
          results.failed += 1;
          results.errors.push({ receiptId, error: 'Receipt not found' });
          continue;
        }
        results.approved += 1;
        if (approved.created || approved.attached) {
          auditEvents.push(this.approveEvent(approved, userId, workspaceId));
        }
      } catch (error) {
        results.failed += 1;
        results.errors.push({
          receiptId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.recordBatchAudit(auditEvents);

    return results;
  }

  async delete(id: string, workspaceId: string, userId: string) {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    let statementDeleted = false;

    if (receipt?.statementId) {
      const statement = await this.statementRepository.findOne({
        where: { id: receipt.statementId, workspaceId },
      });

      if (statement && !statement.deletedAt) {
        statement.deletedAt = new Date();
        await this.statementRepository.save(statement);
        statementDeleted = true;
      }
    }

    for (const attachmentPath of receipt?.attachmentPaths ?? []) {
      try {
        await fs.unlink(attachmentPath);
      } catch {
        // Best-effort cleanup: missing or already-removed files should not block deletion.
      }
    }

    await this.receiptRepository.delete({ id, workspaceId });

    if (receipt) {
      await this.recordAudit({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.RECEIPT,
        entityId: receipt.id,
        action: AuditAction.DELETE,
        diff: { before: receiptAuditSnapshot(receipt), after: null },
        meta: { statementId: receipt.statementId ?? null, statementDeleted },
      });
    }
    return { success: true };
  }

  private async recordCreate(receipt: Receipt, userId: string, workspaceId: string) {
    await this.recordAudit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.RECEIPT,
      entityId: receipt.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: receiptAuditSnapshot(receipt) },
      meta: { source: receipt.source, fileName: receipt.subject },
    });
  }

  private approveEvent(
    result: { receipt: Receipt; transaction: Transaction; previousStatus: ReceiptStatus },
    userId: string,
    workspaceId: string,
  ): CreateAuditEventDto {
    return {
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.RECEIPT,
      entityId: result.receipt.id,
      action: AuditAction.UPDATE,
      diff: {
        before: { status: result.previousStatus, transactionId: null },
        after: { status: result.receipt.status, transactionId: result.transaction.id },
      },
      meta: { approved: true },
    };
  }

  /** The fields an update touches, so the diff shows only what the user changed. */
  private changedFields(
    receipt: Receipt,
    dto: {
      status?: ReceiptStatus;
      parsedData?: Record<string, unknown>;
      statementId?: string | null;
    },
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    if (dto.status) {
      fields.status = receipt.status;
    }
    if (dto.statementId !== undefined) {
      fields.statementId = receipt.statementId ?? null;
    }
    if (dto.parsedData) {
      const parsed = (receipt.parsedData ?? {}) as Record<string, unknown>;
      fields.parsedData = Object.fromEntries(
        Object.keys(dto.parsedData).map(key => [key, parsed[key] ?? null]),
      );
    }
    return fields;
  }

  private async recordBatchAudit(events: CreateAuditEventDto[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    try {
      await this.auditService.createBatchEvents(events, randomUUID());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit events failed for bulk receipt approval: ${message}`);
    }
  }

  // An audit failure must never fail the user's operation.
  private async recordAudit(event: CreateAuditEventDto): Promise<void> {
    try {
      await this.auditService.createEvent(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for receipt ${event.entityId}: ${message}`);
    }
  }

  async getFilePayload(id: string, workspaceId: string) {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }

    const attachment = receipt.metadata?.attachments?.[0];
    const filePath = receipt.attachmentPaths?.[0];

    if (!(attachment && filePath)) {
      return null;
    }

    const buffer = await fs.readFile(filePath);

    return {
      buffer,
      fileName: attachment.filename || receipt.subject,
      mimeType: attachment.mimeType || 'application/octet-stream',
    };
  }

  private async createManualJob(
    receiptId: string,
    userId: string,
    integrationId: 'manual-upload' | 'manual-scan',
    language?: string,
  ): Promise<ReceiptProcessingJob> {
    const job = this.jobRepository.create({
      userId,
      receiptId,
      status: ReceiptJobStatus.PROCESSING,
      progress: 0,
      lockedAt: new Date(),
      lockedBy: MANUAL_RECEIPT_WORKER_ID,
      payload: {
        integrationId,
        gmailMessageId: receiptId,
        historyId: language ?? 'auto',
      },
    });

    return this.jobRepository.save(job);
  }

  private buildReceipt(params: {
    userId: string;
    workspaceId: string;
    source: ReceiptSource;
    file: Express.Multer.File;
    language?: string;
    captureLocation?: CaptureLocation;
  }): Receipt {
    return this.receiptRepository.create({
      userId: params.userId,
      workspaceId: params.workspaceId,
      source: params.source,
      gmailMessageId: null,
      gmailThreadId: null,
      subject: params.file.originalname,
      sender:
        params.source === ReceiptSource.SCAN
          ? 'camera-scan'
          : params.source === ReceiptSource.TELEGRAM
            ? 'telegram'
            : 'manual-upload',
      receivedAt: new Date(),
      status: ReceiptStatus.NEW,
      attachmentPaths: [params.file.path],
      metadata: {
        attachments: [
          {
            id: params.file.filename,
            filename: params.file.originalname,
            mimeType: params.file.mimetype,
            size: params.file.size,
          },
        ],
        ...(params.captureLocation
          ? {
              captureLocation: {
                ...params.captureLocation,
                source: 'device' as const,
                capturedAt: new Date().toISOString(),
              },
            }
          : {}),
      },
      language: params.language && params.language !== 'auto' ? params.language : null,
      extractionMethod: null,
      confidence: null,
      isDuplicate: false,
    });
  }

  /**
   * The receipt image goes onto the bank row as an attachment, so it is found
   * where the expense is. Best effort: a missing file must not undo an approve.
   */
  private async copyFileToTransaction(
    receipt: Receipt,
    transactionId: string,
    userId: string | undefined,
  ): Promise<void> {
    const filePath = receipt.attachmentPaths?.[0];
    if (!(filePath && userId && this.attachmentsService)) {
      return;
    }
    try {
      const buffer = await fs.readFile(filePath);
      const originalname = path.basename(filePath);
      await this.attachmentsService.create(transactionId, receipt.workspaceId, userId, {
        originalname,
        mimetype: mimeTypeOf(originalname),
        size: buffer.length,
        buffer,
      } as Express.Multer.File);
    } catch (error) {
      this.logger.warn(
        `Could not attach receipt ${receipt.id} file to transaction ${transactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private buildTransactionFromReceipt(
    receipt: Receipt,
    workspaceId: string,
    workspaceCurrency: string,
    categoryId?: string,
  ): Partial<Transaction> {
    const transactionType =
      receipt.parsedData?.transactionType === 'income'
        ? TransactionType.INCOME
        : TransactionType.EXPENSE;

    return {
      statementId: null,
      workspaceId,
      transactionDate: receipt.parsedData?.date ? new Date(receipt.parsedData.date) : new Date(),
      counterpartyName: receipt.parsedData?.vendor || receipt.subject || 'Unknown',
      paymentPurpose: receipt.parsedData?.vendor || receipt.subject || '',
      amount: receipt.parsedData?.amount ?? null,
      currency: currencyCodeOrDefault(receipt.parsedData?.currency, workspaceCurrency),
      categoryId: categoryId ?? (receipt.parsedData?.categoryId || null),
      transactionType,
    };
  }
}

/** Plain fields of a receipt for the audit diff: no file paths, metadata or relations. */
export function receiptAuditSnapshot(receipt: Receipt): Record<string, unknown> {
  return {
    source: receipt.source,
    status: receipt.status,
    subject: receipt.subject,
    vendor: receipt.parsedData?.vendor ?? null,
    amount: receipt.parsedData?.amount ?? null,
    currency: receipt.parsedData?.currency ?? null,
    date: receipt.parsedData?.date ?? null,
    categoryId: receipt.parsedData?.categoryId ?? null,
    statementId: receipt.statementId ?? null,
    transactionId: receipt.transactionId ?? null,
  };
}

/**
 * The receipt's fields for its scan's transaction. The transaction keeps its
 * statement, and a field the receipt lacks keeps its value: no amount parsed,
 * or no date (the builder would fall back to today).
 */
function scanTransactionUpdate(
  fields: Partial<Transaction>,
  hasDate: boolean,
): Partial<Transaction> {
  const { statementId: _statementId, workspaceId: _workspaceId, transactionDate, ...rest } = fields;
  const update: Partial<Transaction> = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== null && value !== undefined),
  );
  if (hasDate) {
    update.transactionDate = transactionDate;
  }
  if (typeof update.amount === 'number') {
    const isExpense = update.transactionType !== TransactionType.INCOME;
    update.debit = isExpense ? update.amount : null;
    update.credit = isExpense ? null : update.amount;
  }
  return update;
}
