import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GmailSettings,
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  Receipt,
  ReceiptJobStatus,
  ReceiptProcessingJob,
} from '../../../entities';
import { GmailService } from './gmail.service';

interface SyncError {
  integrationId: string;
  error: string;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  messagesFound: number;
  jobsCreated: number;
  errors: SyncError[];
}

export interface UserSyncResult {
  messagesFound: number;
  jobsCreated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class GmailSyncService {
  private readonly logger = new Logger(GmailSyncService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(GmailSettings)
    private readonly gmailSettingsRepository: Repository<GmailSettings>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptProcessingJob)
    private readonly jobRepository: Repository<ReceiptProcessingJob>,
    private readonly gmailService: GmailService,
  ) {}

  async syncAllIntegrations(): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      skipped: 0,
      messagesFound: 0,
      jobsCreated: 0,
      errors: [],
    };

    try {
      const integrations = await this.integrationRepository.find({
        where: {
          provider: IntegrationProvider.GMAIL,
          status: IntegrationStatus.CONNECTED,
        },
        relations: ['gmailSettings'],
      });

      for (const integration of integrations) {
        if (!integration.connectedByUserId) {
          this.logger.warn(`Integration ${integration.id} has no connected user`);
          result.skipped += 1;
          continue;
        }

        try {
          const userResult = await this.syncForIntegration(integration);
          result.synced += 1;
          result.messagesFound += userResult.messagesFound;
          result.jobsCreated += userResult.jobsCreated;
        } catch (error) {
          result.errors.push({
            integrationId: integration.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to sync all Gmail integrations', error);
    }

    return result;
  }

  async syncForWorkspace(workspaceId: string): Promise<UserSyncResult> {
    const integration = await this.integrationRepository.findOne({
      where: {
        workspaceId,
        provider: IntegrationProvider.GMAIL,
        status: IntegrationStatus.CONNECTED,
      },
      relations: ['gmailSettings'],
    });

    if (!integration) {
      throw new Error('No connected Gmail integration found for this workspace');
    }

    return this.syncForIntegration(integration);
  }

  private async syncForIntegration(integration: Integration): Promise<UserSyncResult> {
    const result: UserSyncResult = {
      messagesFound: 0,
      jobsCreated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
    };

    const userId = integration.connectedByUserId;
    if (!userId) {
      throw new Error('Integration has no connected user');
    }

    let effectiveSettings = integration.gmailSettings;
    if (integration.gmailSettings?.lastSyncAt) {
      const existingReceipts = await this.receiptRepository.count({
        where: { workspaceId: integration.workspaceId },
      });
      if (existingReceipts === 0) {
        effectiveSettings = {
          ...integration.gmailSettings,
          lastSyncAt: null,
        } as GmailSettings;
      }
    }

    const query = this.buildSearchQuery(effectiveSettings);
    const useLabelFilter =
      effectiveSettings?.filterEnabled !== false && Boolean(effectiveSettings?.labelId);

    this.logger.log(`Gmail sync query for ${userId}: ${query || '(empty)'}`);
    let messages = await this.gmailService.listMessages(integration.workspaceId, query, {
      includeLabelFilter: useLabelFilter,
    });

    if (messages.length === 0 && useLabelFilter) {
      const fallbackWarning =
        'Gmail label filter returned no emails. Retrying sync without label filter.';
      this.logger.warn(`Gmail sync fallback for ${userId}: ${fallbackWarning}`);
      result.warnings.push(fallbackWarning);

      try {
        await this.gmailService.setupGmailEnvironment(integration);
      } catch (error) {
        result.errors.push(
          `Failed to refresh Gmail label/filter setup: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      messages = await this.gmailService.listMessages(integration.workspaceId, query, {
        includeLabelFilter: false,
      });
    }

    result.messagesFound = messages.length;

    for (const message of messages) {
      // Without an id there is nothing to look up or fetch later.
      if (!message.id) {
        result.skipped += 1;
        continue;
      }
      try {
        // Per workspace: the same mailbox may be connected in several workspaces.
        const existingReceipt = await this.receiptRepository.findOne({
          where: { workspaceId: integration.workspaceId, gmailMessageId: message.id },
        });

        if (existingReceipt) {
          result.skipped += 1;
          continue;
        }

        const job = this.jobRepository.create({
          userId,
          workspaceId: integration.workspaceId,
          status: ReceiptJobStatus.PENDING,
          payload: {
            integrationId: integration.id,
            gmailMessageId: message.id,
          },
        });

        await this.jobRepository.save(job);
        result.jobsCreated += 1;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    this.logger.log(
      `Gmail sync summary for ${userId}: ${result.messagesFound} messages, ${result.jobsCreated} jobs, ${result.skipped} skipped`,
    );

    if (integration.gmailSettings && result.messagesFound > 0) {
      integration.gmailSettings.lastSyncAt = new Date();
      await this.gmailSettingsRepository.save(integration.gmailSettings);
    }

    return result;
  }

  private buildSearchQuery(settings: GmailSettings | null): string {
    const parts: string[] = [];

    if (settings?.filterConfig?.hasAttachment !== false) {
      parts.push('has:attachment');
    }

    if (settings?.filterEnabled !== false && settings?.lastSyncAt) {
      parts.push(`after:${this.formatDateForGmail(settings.lastSyncAt)}`);
    }

    const keywords = settings?.filterConfig?.keywords;
    if (keywords && keywords.length > 0) {
      const keywordQuery = keywords.map(keyword => keyword.trim()).join(' OR ');
      parts.push(`{${keywordQuery}}`);
    }

    const senders = settings?.filterConfig?.senders;
    if (senders && senders.length > 0) {
      const senderQuery = senders.map(sender => `from:${sender.trim()}`).join(' OR ');
      parts.push(`(${senderQuery})`);
    }

    return parts.join(' ');
  }

  private formatDateForGmail(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
  }
}
