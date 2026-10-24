import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { type Job, UnrecoverableError } from 'bullmq';
import { LessThan, Repository } from 'typeorm';
import { STANDARD_WORKSPACE } from '../../../common/workspaces/version-workspaces';
import { Statement, StatementStatus } from '../../../entities/statement.entity';
import { WorkspaceKind } from '../../../entities/workspace.entity';
import {
  StatementProcessingService,
  StatementRejected,
} from '../services/statement-processing.service';
import {
  STATEMENT_PARSING_QUEUE,
  type StatementParsingJob,
  StatementParsingQueue,
} from './statement-parsing.queue';

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Worker concurrency replaces the in-process Semaphore that used to bound
 * parsing: this limit is per worker process, so N instances give N x this.
 */
export const STATEMENT_PARSING_CONCURRENCY = parsePositiveInt(
  process.env.STATEMENT_PARSING_CONCURRENCY,
  5,
);

@Processor(STATEMENT_PARSING_QUEUE, { concurrency: STATEMENT_PARSING_CONCURRENCY })
export class StatementParsingProcessor extends WorkerHost {
  private readonly logger = new Logger(StatementParsingProcessor.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly statementProcessingService: StatementProcessingService,
  ) {
    super();
  }

  async process(job: Job<StatementParsingJob>): Promise<void> {
    const { statementId } = job.data;

    // A past version's statements stay as they were copied; a job that still
    // names one (queued before the copy, say) is dropped, not retried.
    const inVersion = await this.statementRepository.exists({
      where: { id: statementId, workspace: { kind: WorkspaceKind.VERSION } },
    });
    if (inVersion) {
      this.logger.log(`Statement ${statementId} belongs to a past version; not parsing it`);
      return;
    }

    await this.statementRepository.increment({ id: statementId }, 'parsingAttempts', 1);
    this.logger.log(`Processing statement ${statementId} (attempt ${job.attemptsMade + 1})`);

    // Errors propagate so BullMQ retries with backoff. processStatement already
    // recorded the failure on the statement itself before rethrowing.
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    try {
      await this.statementProcessingService.processStatement(statementId, { finalAttempt });
    } catch (error) {
      // Another attempt would read the same file and fail the same way.
      if (error instanceof StatementRejected) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }
}

export const MAX_PARSING_ATTEMPTS = parsePositiveInt(process.env.STATEMENT_MAX_PARSING_ATTEMPTS, 3);

export const STALE_PROCESSING_MS = parsePositiveInt(
  process.env.STATEMENT_PROCESSING_STALE_MS,
  15 * 60 * 1000,
);

/**
 * Recovers statements stranded in PROCESSING.
 *
 * BullMQ retries a job whose worker died, but the statement row still reads
 * PROCESSING, and a crash before the job was ever enqueued (or while Redis was
 * unreachable) leaves nothing to retry at all. This sweep is the backstop for
 * both: it resets the row and re-enqueues, giving up once a statement has burned
 * MAX_PARSING_ATTEMPTS so a poison file cannot loop forever.
 */
@Injectable()
export class StaleStatementReaper {
  private readonly logger = new Logger(StaleStatementReaper.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly queue: StatementParsingQueue,
  ) {}

  @Interval(STALE_PROCESSING_MS)
  async reap(): Promise<void> {
    const stale = await this.statementRepository.find({
      where: {
        status: StatementStatus.PROCESSING,
        updatedAt: LessThan(new Date(Date.now() - STALE_PROCESSING_MS)),
        // A past version may hold a copy caught mid-parse; it stays that way.
        workspace: STANDARD_WORKSPACE,
      },
      select: {
        id: true,
        parsingAttempts: true,
      },
      take: 50,
    });

    for (const statement of stale) {
      if (statement.parsingAttempts >= MAX_PARSING_ATTEMPTS) {
        await this.statementRepository.update(
          { id: statement.id, status: StatementStatus.PROCESSING },
          {
            status: StatementStatus.ERROR,
            errorMessage: `Parsing abandoned after ${statement.parsingAttempts} attempts`,
          },
        );
        this.logger.warn(
          `Statement ${statement.id} abandoned after ${statement.parsingAttempts} attempts`,
        );
        continue;
      }

      // Conditional on the row still reading PROCESSING: the initial SELECT
      // and this UPDATE aren't atomic, and processStatementInternal now
      // heartbeats its updatedAt during long-running stages (see
      // statement-processing.service.ts), so a statement that finished (or
      // heartbeated) in that window is no longer actually stale — this
      // WHERE clause turns that race into a no-op instead of clobbering
      // whatever status the still-running (or just-finished) job wrote.
      const { affected } = await this.statementRepository.update(
        { id: statement.id, status: StatementStatus.PROCESSING },
        { status: StatementStatus.UPLOADED },
      );
      if (!affected) {
        this.logger.log(`Statement ${statement.id} no longer stale, skipping re-queue`);
        continue;
      }

      await this.queue.enqueue(statement.id);
      this.logger.warn(`Re-queued stale statement ${statement.id}`);
    }
  }
}
