import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomTableExportSchedulesService } from './custom-table-export-schedules.service';

@Injectable()
export class CustomTableExportSchedulesScheduler {
  private readonly logger = new Logger(CustomTableExportSchedulesScheduler.name);
  private running = false;

  constructor(private readonly schedulesService: CustomTableExportSchedulesService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runDueExports(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous export run is still in progress, skipping this tick');
      return;
    }
    this.running = true;
    try {
      const due = await this.schedulesService.findDueSchedules();
      for (const schedule of due) {
        try {
          await this.schedulesService.runSchedule(schedule.id);
        } catch (error) {
          this.logger.error(`Scheduled export ${schedule.id} failed: ${String(error)}`);
          await this.schedulesService.recordFailure(schedule.id, error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
