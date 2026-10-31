import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import { TaxAssignmentService } from '../../tax/tax-assignment.service';
import { ClassificationService } from '../services/classification.service';

/** Sources a payee's history may replace on a row nobody confirmed. */
const UNDECIDED: readonly TransactionCategorySource[] = [
  TransactionCategorySource.DEFAULT,
  TransactionCategorySource.KIND,
  TransactionCategorySource.BRAND,
  TransactionCategorySource.RECEIPT,
  TransactionCategorySource.KEYWORD,
  TransactionCategorySource.HISTORY,
  TransactionCategorySource.LEARNED,
];

/** Decisions on one payee arriving this close together are learned from once. */
const SETTLE_MS = 400;

/**
 * Carries what a person just decided about a payee to the payee's other rows,
 * in every statement: file one "MEMBER ONE" row and the others waiting
 * anywhere get that suggestion now, not when their statement is next opened.
 * Only unconfirmed rows nobody decided are touched; they stay suggestions
 * until accepted.
 */
@Injectable()
export class PayeeLearningService {
  private readonly logger = new Logger(PayeeLearningService.name);
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    private readonly classification: ClassificationService,
    private readonly taxAssignment: TaxAssignmentService,
  ) {}

  /** Learns from the payee shortly, once a burst of decisions (a whole statement approved) settles. */
  schedule(workspaceId: string, payeeId: string): void {
    const key = `${workspaceId}:${payeeId}`;
    clearTimeout(this.pending.get(key));
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        this.learn(workspaceId, payeeId).catch(error =>
          this.logger.warn(
            `Payee learning failed for ${payeeId} in ${workspaceId}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }, SETTLE_MS),
    );
  }

  /** Suggests the payee's category on its undecided rows; answers how many changed. */
  async learn(workspaceId: string, payeeId: string): Promise<number> {
    const match = await this.classification.categoryForPayee(workspaceId, payeeId);
    if (!match) {
      return 0;
    }
    const result = await this.transactions
      .createQueryBuilder()
      .update(Transaction)
      .set({
        categoryId: match.categoryId,
        categorySource: match.source,
        categoryReason: match.reason,
      })
      .where('workspace_id = :workspaceId AND payee_id = :payeeId', { workspaceId, payeeId })
      .andWhere('is_verified = false AND is_duplicate = false AND tax_locked = false')
      .andWhere('split_group_id IS NULL AND transfer_pair_id IS NULL')
      .andWhere('(category_id IS NULL OR category_source IN (:...undecided))', {
        undecided: UNDECIDED,
      })
      .andWhere('category_id IS DISTINCT FROM :categoryId', { categoryId: match.categoryId })
      .returning(['id'])
      .execute();
    const ids = (result.raw as Array<{ id: string }>).map(row => row.id);
    if (ids.length > 0) {
      await this.taxAssignment.reassess(workspaceId, { ids });
    }
    return ids.length;
  }
}
