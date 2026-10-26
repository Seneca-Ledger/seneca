import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportRetentionService } from './report-retention.service';
import { ReportSchedulesService } from './report-schedules.service';

@Injectable()
export class ReportSchedulesScheduler {
  private readonly logger = new Logger(ReportSchedulesScheduler.name);

  constructor(
    private readonly schedules: ReportSchedulesService,
    private readonly retention: ReportRetentionService,
  ) {}

  /**
   * Hourly rather than daily: schedules are due at 06:00 UTC, and an hourly
   * sweep picks them up within the hour even after a restart or downtime,
   * without the thundering herd of a minute-level poll.
   */
  @Cron('0 * * * *')
  async dispatchDueReports(): Promise<void> {
    try {
      const { ran, failed } = await this.schedules.runDue();
      if (ran > 0) {
        this.logger.log(`Scheduled reports: ran ${ran}, failed ${failed}`);
      }
    } catch (error) {
      this.logger.error('Scheduled report sweep failed', error as Error);
    }
  }

  /** Overnight, away from the hours reports are sent. */
  @Cron('30 2 * * *')
  async purgeExpiredReports(): Promise<void> {
    try {
      const { removed } = await this.retention.purgeExpired();
      if (removed > 0) {
        this.logger.log(`Removed ${removed} expired report files`);
      }
    } catch (error) {
      this.logger.error('Report retention sweep failed', error as Error);
    }
  }
}
