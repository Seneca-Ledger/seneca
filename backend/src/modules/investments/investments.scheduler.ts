import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvestmentsService } from './investments.service';

/**
 * Prices used to move only when someone opened the page and pressed refresh,
 * so an account's value — and with it the net worth line — stood still for as
 * long as nobody looked. Once a day is enough for daily closes, which is all
 * the free sources quote anyway.
 */
@Injectable()
export class InvestmentsScheduler {
  private readonly logger = new Logger(InvestmentsScheduler.name);

  constructor(private readonly investmentsService: InvestmentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async refreshAllPrices(): Promise<void> {
    const workspaceIds = await this.investmentsService.workspacesWithPricedHoldings();
    for (const workspaceId of workspaceIds) {
      try {
        // No user is behind this, so the snapshot is written as the system.
        const updated = await this.investmentsService.refreshPrices(null, workspaceId);
        if (updated > 0) {
          this.logger.log(`Repriced ${updated} holdings in workspace ${workspaceId}`);
        }
      } catch (error) {
        // One unreachable quote source must not stop the other workspaces.
        this.logger.error(
          `Price refresh failed for workspace ${workspaceId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
