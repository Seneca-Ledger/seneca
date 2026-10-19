import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export const LEDGER_SYNC_QUEUE = 'ledger-sync';

export interface LedgerSyncJob {
  workspaceId: string;
}

/**
 * One job per workspace drains all of its dirty transactions. The job id is
 * the workspace, so nudges that arrive while one is waiting or running
 * coalesce into it instead of piling up.
 */
@Injectable()
export class LedgerSyncQueue {
  private readonly logger = new Logger(LedgerSyncQueue.name);

  constructor(
    @InjectQueue(LEDGER_SYNC_QUEUE)
    private readonly queue: Queue<LedgerSyncJob>,
  ) {}

  async enqueue(workspaceId: string): Promise<void> {
    try {
      await this.queue.add(
        'sync',
        { workspaceId },
        {
          jobId: `sync-${workspaceId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      // Nothing is lost: the rows stay dirty and the sweep re-enqueues them.
      this.logger.error(
        `Failed to enqueue ledger sync for ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
