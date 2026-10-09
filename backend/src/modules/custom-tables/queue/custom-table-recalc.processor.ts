import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CustomTablesCacheService } from '../custom-tables-cache.service';
import { FormulaRecalcService } from '../formula-recalc.service';
import { CUSTOM_TABLE_RECALC_QUEUE, type CustomTableRecalcJob } from './custom-table-recalc.queue';

/** Big tables are recalculated off the request path; the cache is bumped once the values land. */
@Processor(CUSTOM_TABLE_RECALC_QUEUE, { concurrency: 1 })
export class CustomTableRecalcProcessor extends WorkerHost {
  private readonly logger = new Logger(CustomTableRecalcProcessor.name);

  constructor(
    private readonly recalc: FormulaRecalcService,
    private readonly cache: CustomTablesCacheService,
  ) {
    super();
  }

  async process(job: Job<CustomTableRecalcJob>): Promise<void> {
    const { tableId, workspaceId } = job.data;
    const result = await this.recalc.recalcTable(tableId);
    await this.cache.bumpRows(workspaceId, tableId);
    this.logger.log(`Recalculated table ${tableId}: ${result.updated}/${result.rows} rows changed`);
  }
}
