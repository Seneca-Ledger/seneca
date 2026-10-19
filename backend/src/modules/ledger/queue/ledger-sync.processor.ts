import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Job } from 'bullmq';
import { LedgerSyncService } from '../ledger-sync.service';
import { LEDGER_SYNC_QUEUE, type LedgerSyncJob, LedgerSyncQueue } from './ledger-sync.queue';

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** How often the sweep looks for dirty rows. The ledger lags writes by about this much. */
export const LEDGER_SWEEP_MS = parsePositiveInt(process.env.LEDGER_SWEEP_MS, 30_000);

@Processor(LEDGER_SYNC_QUEUE, { concurrency: 2 })
export class LedgerSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(LedgerSyncProcessor.name);

  constructor(private readonly syncService: LedgerSyncService) {
    super();
  }

  async process(job: Job<LedgerSyncJob>): Promise<void> {
    const report = await this.syncService.syncWorkspace(job.data.workspaceId);
    if (report.processed || report.failed || report.orphansReversed) {
      this.logger.log(
        `Ledger sync ${report.workspaceId}: ${report.processed} posted, ${report.failed} failed, ` +
          `${report.retryLater} changed mid-posting, ${report.orphansReversed} orphans reversed`,
      );
    }
  }
}

/**
 * Finds work. Dirty flags are set by database triggers, which cannot talk to
 * the queue, so the sweep is what turns a flag into a job — and the backstop
 * when Redis was down or a job died.
 */
@Injectable()
export class LedgerSyncSweeper {
  private readonly logger = new Logger(LedgerSyncSweeper.name);
  private running = false;

  constructor(
    private readonly syncService: LedgerSyncService,
    private readonly queue: LedgerSyncQueue,
  ) {}

  @Interval(LEDGER_SWEEP_MS)
  async sweep(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      for (const workspaceId of await this.syncService.workspacesNeedingSync()) {
        await this.queue.enqueue(workspaceId);
      }
    } catch (error) {
      this.logger.warn(`Ledger sweep failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
