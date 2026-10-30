import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntitySubscriberInterface,
  QueryRunner,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  UpdateEvent,
} from 'typeorm';
import { Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import { PayeeLearningService } from './payee-learning.service';

/** Sources whose category is only a suggestion until the row is confirmed. */
const SUGGESTED = new Set<string | null>([
  TransactionCategorySource.HISTORY,
  TransactionCategorySource.LEARNED,
  TransactionCategorySource.KEYWORD,
  TransactionCategorySource.KIND,
  TransactionCategorySource.BRAND,
  TransactionCategorySource.RECEIPT,
]);

/**
 * Watches a person deciding a row's category, whichever path writes it (the
 * statement editor, Review, the drawer, a bulk edit): it then (1) teaches the
 * payee's other undecided rows, and (2) counts whether a suggestion was
 * accepted as it was or changed. Both run after the write commits, so a
 * rolled-back edit teaches nothing. Only `save()` reaches a subscriber, and
 * every decision path saves.
 */
@Injectable()
export class PayeeLearningSubscriber implements EntitySubscriberInterface<Transaction> {
  private readonly logger = new Logger(PayeeLearningSubscriber.name);
  private readonly queued = new WeakMap<QueryRunner, Array<() => void>>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly learning: PayeeLearningService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Transaction;
  }

  afterUpdate(event: UpdateEvent<Transaction>): void {
    const row = event.entity as Transaction | undefined;
    const before = event.databaseEntity;
    if (!(row?.workspaceId && before)) {
      return;
    }
    const recategorised = row.categoryId !== before.categoryId;
    const confirmed = row.isVerified === true && !before.isVerified;
    const chose = row.categorySource === TransactionCategorySource.MANUAL && recategorised;

    const wasSuggestion =
      !before.isVerified && Boolean(before.categoryId) && SUGGESTED.has(before.categorySource);
    const outcome = !wasSuggestion
      ? null
      : chose
        ? 'corrected'
        : confirmed && !recategorised
          ? 'accepted'
          : null;
    if (outcome && before.categorySource) {
      const source = before.categorySource;
      this.defer(event, () => {
        this.dataSource
          .query(
            `INSERT INTO "category_suggestion_outcomes" ("workspace_id", "source", "outcome") VALUES ($1, $2, $3)`,
            [row.workspaceId, source, outcome],
          )
          .catch(error => this.logger.warn(`Suggestion outcome not recorded: ${String(error)}`));
      });
    }

    const payeeId = row.payeeId ?? before.payeeId;
    if (payeeId && row.categoryId && (chose || confirmed)) {
      this.defer(event, () => this.learning.schedule(row.workspaceId as string, payeeId));
    }
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    const tasks = this.queued.get(event.queryRunner);
    this.queued.delete(event.queryRunner);
    for (const task of tasks ?? []) {
      task();
    }
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.queued.delete(event.queryRunner);
  }

  /** Runs `task` once the write is committed; at once when it was not in a transaction. */
  private defer(event: UpdateEvent<Transaction>, task: () => void): void {
    const runner = event.queryRunner;
    if (runner?.isTransactionActive) {
      this.queued.set(runner, [...(this.queued.get(runner) ?? []), task]);
    } else {
      task();
    }
  }
}
