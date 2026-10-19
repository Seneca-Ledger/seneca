import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  GmailSettings,
  GmailWatchSubscription,
  Integration,
  ReceiptProcessingJob,
  WatchSubscriptionStatus,
} from '../../../entities';
import { GmailOAuthService } from './gmail-oauth.service';

@Injectable()
export class GmailWatchService {
  private readonly logger = new Logger(GmailWatchService.name);

  constructor(
    @InjectRepository(GmailWatchSubscription)
    private readonly watchSubscriptionRepository: Repository<GmailWatchSubscription>,
    @InjectRepository(GmailSettings)
    private readonly gmailSettingsRepository: Repository<GmailSettings>,
    @InjectRepository(ReceiptProcessingJob)
    jobRepository: Repository<ReceiptProcessingJob>,
    private readonly gmailOAuthService: GmailOAuthService,
  ) {}

  async setupWatch(integration: Integration): Promise<GmailWatchSubscription> {
    try {
      await this.gmailOAuthService.getGmailClient(integration.workspaceId);
      const settings = await this.gmailSettingsRepository.findOne({
        where: { integrationId: integration.id },
      });

      const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const existing = await this.watchSubscriptionRepository.findOne({
        where: { integrationId: integration.id },
      });

      const subscription =
        existing ||
        this.watchSubscriptionRepository.create({
          integrationId: integration.id,
        });

      subscription.topicName = 'imap-polling';
      subscription.subscriptionName = `imap-polling-${integration.id}`;
      subscription.expiration = expiration;
      subscription.historyId = settings?.historyId || null;
      subscription.emailAddress = null;
      subscription.status = WatchSubscriptionStatus.ACTIVE;

      await this.watchSubscriptionRepository.save(subscription);

      if (settings) {
        settings.watchEnabled = true;
        settings.watchExpiration = expiration;
        await this.gmailSettingsRepository.save(settings);
      }

      this.logger.log(
        `IMAP polling watch setup complete for integration ${integration.id}, expires at ${expiration}`,
      );

      return subscription;
    } catch (error) {
      this.logger.error('Failed to setup Gmail watch', error);
      throw error;
    }
  }

  async renewWatch(integration: Integration): Promise<GmailWatchSubscription> {
    this.logger.log(`Renewing Gmail watch for integration ${integration.id}`);
    return this.setupWatch(integration);
  }

  async stopWatch(integration: Integration): Promise<void> {
    try {
      await this.gmailOAuthService.getGmailClient(integration.workspaceId);

      await this.watchSubscriptionRepository.update(
        { integrationId: integration.id },
        { status: WatchSubscriptionStatus.EXPIRED },
      );

      await this.gmailSettingsRepository.update(
        { integrationId: integration.id },
        { watchEnabled: false, watchExpiration: null },
      );

      this.logger.log(`Gmail watch stopped for integration ${integration.id}`);
    } catch (error) {
      this.logger.error('Failed to stop Gmail watch', error);
      throw error;
    }
  }

  async processHistoryUpdate(integration: Integration, newHistoryId: string): Promise<void> {
    try {
      const settings = await this.gmailSettingsRepository.findOne({
        where: { integrationId: integration.id },
      });

      if (!settings?.historyId) {
        this.logger.warn('No history ID found, skipping history processing');
        return;
      }

      await this.gmailOAuthService.getGmailClient(integration.workspaceId);
      settings.historyId = newHistoryId;
      settings.lastSyncAt = new Date();
      await this.gmailSettingsRepository.save(settings);
    } catch (error) {
      this.logger.error('Failed to process history update', error);
    }
  }
}
