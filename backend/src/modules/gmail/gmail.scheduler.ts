import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import {
  GmailWatchSubscription,
  Integration,
  IntegrationStatus,
  WatchSubscriptionStatus,
} from '../../entities';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailWatchService } from './services/gmail-watch.service';

@Injectable()
export class GmailScheduler {
  private readonly logger = new Logger(GmailScheduler.name);

  constructor(
    @InjectRepository(GmailWatchSubscription)
    private readonly watchSubscriptionRepository: Repository<GmailWatchSubscription>,
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly gmailWatchService: GmailWatchService,
    private readonly gmailSyncService: GmailSyncService,
  ) {}

  @Cron('0 */3 * * *')
  async runDailySync(): Promise<void> {
    try {
      this.logger.log('Starting Gmail receipts sync (every 3 hours)...');

      const result = await this.gmailSyncService.syncAllIntegrations();

      this.logger.log(
        `Periodic sync completed: ${result.synced} integrations, ` +
          `${result.messagesFound} messages found, ${result.jobsCreated} jobs created`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(
          `Periodic sync had ${result.errors.length} errors`,
          JSON.stringify(result.errors),
        );
      }
    } catch (error) {
      this.logger.error('Error in periodic sync cron job', error);
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async renewExpiringWatches(): Promise<void> {
    try {
      this.logger.log('Checking for expiring Gmail watches...');

      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);

      // Find watches expiring in the next 24 hours
      const expiringWatches = await this.watchSubscriptionRepository.find({
        where: {
          expiration: LessThan(tomorrow),
          status: WatchSubscriptionStatus.ACTIVE,
          integration: { workspace: STANDARD_WORKSPACE },
        },
        relations: ['integration'],
      });

      this.logger.log(`Found ${expiringWatches.length} expiring watches`);

      for (const watch of expiringWatches) {
        try {
          const integration = await this.integrationRepository.findOne({
            where: { id: watch.integrationId },
          });

          if (!integration) {
            this.logger.warn(`Integration not found for watch ${watch.id}`);
            continue;
          }

          if (integration.status !== IntegrationStatus.CONNECTED) {
            this.logger.warn(
              `Integration ${integration.id} is not connected, skipping watch renewal`,
            );
            continue;
          }

          if (!integration.connectedByUserId) {
            this.logger.warn(
              `No connected user for integration ${integration.id}, skipping watch renewal`,
            );
            continue;
          }

          await this.gmailWatchService.renewWatch(integration);

          this.logger.log(`Successfully renewed watch for integration ${integration.id}`);
        } catch (error) {
          this.logger.error(`Failed to renew watch ${watch.id}`, error);

          // Mark watch as error
          watch.status = WatchSubscriptionStatus.ERROR;
          await this.watchSubscriptionRepository.save(watch);

          // Mark integration as needs reauth if token refresh failed
          const integration = await this.integrationRepository.findOne({
            where: { id: watch.integrationId },
          });
          if (integration) {
            integration.status = IntegrationStatus.NEEDS_REAUTH;
            await this.integrationRepository.save(integration);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error in renewExpiringWatches cron job', error);
    }
  }
}
