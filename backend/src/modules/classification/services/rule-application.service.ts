import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, type Repository } from 'typeorm';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import type { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import { AuditService } from '../../audit/audit.service';
import { hasDecidedCategory } from '../engine/category-decision';
import { explainMatch, matchesConditions } from '../engine/rule-conditions';
import type { ClassificationCondition } from '../interfaces/classification-rule.interface';
import { ClassificationService } from './classification.service';

/** How many of a workspace's most recent rows a rule preview or apply looks at. */
const RULE_SCAN_LIMIT = 5000;
/** How many matching rows the preview hands back as examples. */
const RULE_PREVIEW_MATCHES = 20;

/** What the rules page does with a rule before and after it is saved: preview it, apply it. */
@Injectable()
export class RuleApplicationService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private readonly classificationService: ClassificationService,
    private readonly auditService: AuditService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * The workspace's rows a rule would be tried on, newest first: not duplicates,
   * not split parts, not in a trashed statement. `transactionIds` narrows it to
   * those rows. One row more than the limit is read to tell a full page from
   * a truncated one.
   */
  private async rowsForRule(
    workspaceId: string,
    transactionIds?: readonly string[],
  ): Promise<{ rows: Transaction[]; truncated: boolean }> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.isDuplicate = false')
      .andWhere('transaction.splitGroupId IS NULL')
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = transaction.statementId AND trashed.deleted_at IS NOT NULL)',
      )
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .take(RULE_SCAN_LIMIT + 1);
    if (transactionIds) {
      query.andWhere('transaction.id IN (:...transactionIds)', { transactionIds });
    }
    const rows = await query.getMany();
    return { rows: rows.slice(0, RULE_SCAN_LIMIT), truncated: rows.length > RULE_SCAN_LIMIT };
  }

  /**
   * What a rule would match, as the caller sees the rows: another member's
   * private row is left out entirely, since even its amount would answer a
   * question about it.
   */
  async previewRule(input: {
    workspaceId: string;
    viewerMemberId: string | null;
    conditions: ClassificationCondition[];
    transactionIds?: readonly string[];
  }) {
    const { rows, truncated } = await this.rowsForRule(input.workspaceId, input.transactionIds);
    const readable = rows.filter(row => canReadPrivate(row, input.viewerMemberId));
    const matches = readable.filter(row => matchesConditions(row, input.conditions));
    return {
      totalTransactions: readable.length,
      matchedTransactions: matches.length,
      overridable: matches.filter(row => !hasDecidedCategory(row)).length,
      truncated,
      matches: matches.slice(0, RULE_PREVIEW_MATCHES).map(row => ({
        id: row.id,
        date: row.transactionDate ? String(row.transactionDate) : null,
        amount: row.debit || row.credit || row.amount,
        counterparty: row.counterpartyName,
        purpose: row.paymentPurpose,
        matchReason: explainMatch(row, input.conditions),
      })),
    };
  }

  /**
   * Files the workspace's existing matches under the rule's category. Only rows
   * nobody decided: a category picked by hand, or put there by a rule, stays.
   * Wallet and owner are not touched on old rows: moving a row between
   * accounts changes balances, and that is not what "apply" promises.
   */
  async applyRuleToExisting(input: {
    rule: CategorizationRule;
    userId: string;
    viewerMemberId: string | null;
  }): Promise<{ applied: number; skippedManual: number }> {
    const { rule, userId, viewerMemberId } = input;
    const categoryId = rule.result.categoryId;
    if (!categoryId) {
      return { applied: 0, skippedManual: 0 };
    }
    const { rows } = await this.rowsForRule(rule.workspaceId);
    const matches = rows.filter(
      row => canReadPrivate(row, viewerMemberId) && matchesConditions(row, rule.conditions),
    );
    const open = matches.filter(row => !hasDecidedCategory(row));
    if (open.length > 0) {
      await this.transactionRepository.update(
        { id: In(open.map(row => row.id)), workspaceId: rule.workspaceId },
        { categoryId, categorySource: TransactionCategorySource.RULE, categoryReason: rule.name },
      );
      await this.auditService.createBatchEvents(
        open.map(row => ({
          workspaceId: rule.workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.TRANSACTION,
          entityId: row.id,
          action: AuditAction.APPLY_RULE,
          diff: {
            before: { categoryId: row.categoryId, categorySource: row.categorySource },
            after: { categoryId, categorySource: TransactionCategorySource.RULE },
          },
          meta: { ruleId: rule.id, ruleName: rule.name, confidence: 1 },
        })),
      );
      await this.classificationService.recordRuleMatch(rule.id, rule.workspaceId, open.length);
      await this.cacheManager.set(`reports:version:${rule.workspaceId}`, Date.now().toString(), 0);
    }
    return { applied: open.length, skippedManual: matches.length - open.length };
  }
}
