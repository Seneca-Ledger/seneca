import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Integration, IntegrationProvider } from '../../../entities';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { AuditService } from '../../audit/audit.service';
import { GmailWatchService } from './gmail-watch.service';

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

@Injectable()
export class GmailWebhookService {
  private readonly logger = new Logger(GmailWebhookService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly gmailWatchService: GmailWatchService,
    private readonly auditService: AuditService,
  ) {}

  async handlePubSubNotification(payload: PubSubMessage): Promise<void> {
    try {
      // Decode base64 data
      const dataString = Buffer.from(payload.message.data, 'base64').toString('utf-8');
      const notification: GmailNotification = JSON.parse(dataString);

      this.logger.log(
        `Received Gmail notification for ${notification.emailAddress}, historyId: ${notification.historyId}`,
      );

      // Find the specific integration by email address via watch subscription
      const integration = await this.integrationRepository
        .createQueryBuilder('integration')
        .innerJoinAndSelect('integration.gmailSettings', 'gmailSettings')
        .innerJoinAndSelect('integration.token', 'token')
        .innerJoin('integration.gmailWatchSubscription', 'watchSubscription')
        .where('integration.provider = :provider', { provider: IntegrationProvider.GMAIL })
        .andWhere('watchSubscription.emailAddress = :emailAddress', {
          emailAddress: notification.emailAddress,
        })
        .andWhere('watchSubscription.status = :status', { status: 'active' })
        .getOne();

      if (!integration) {
        this.logger.warn(`No active integration found for email ${notification.emailAddress}`);
        return;
      }

      if (!integration.connectedByUserId) {
        this.logger.warn(`Integration ${integration.id} has no connectedByUserId`);
        return;
      }

      try {
        // Audit: record webhook-triggered Gmail sync activity.
        await this.auditService.createEvent({
          workspaceId: integration.workspaceId ?? null,
          actorType: ActorType.INTEGRATION,
          actorId: integration.connectedByUserId,
          actorLabel: 'Gmail Import',
          entityType: EntityType.INTEGRATION,
          entityId: integration.id,
          action: AuditAction.IMPORT,
          meta: {
            historyId: notification.historyId,
            emailAddress: notification.emailAddress,
            provider: 'gmail',
          },
        });
      } catch (error) {
        this.logger.warn(
          `Audit event failed for Gmail webhook: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Process history update for this specific integration only
      await this.gmailWatchService.processHistoryUpdate(integration, notification.historyId);
    } catch (error) {
      this.logger.error('Failed to handle Pub/Sub notification', error);
      throw error;
    }
  }
}
