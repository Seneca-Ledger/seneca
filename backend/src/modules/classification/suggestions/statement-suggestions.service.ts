import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { Category } from '../../../entities/category.entity';
import { Receipt } from '../../../entities/receipt.entity';
import { Statement } from '../../../entities/statement.entity';
import { Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import { AuditService } from '../../audit/audit.service';
import { mergeTruncatedPayees } from '../../payees/payee-truncation';
import { TaxAssignmentService } from '../../tax/tax-assignment.service';
import { type AutoCategoryMatch, ClassificationService } from '../services/classification.service';
import { type ReceiptEvidence, receiptEvidence } from './receipt-evidence';
import { recurringBusinessPayers } from './recurring-payers';
import { suggestCategory } from './suggest-category';

/**
 * Sources a fresh suggestion may replace: the fallback and every earlier
 * guess, the payee history's too, which may have learned since.
 */
const REPLACEABLE: readonly TransactionCategorySource[] = [
  TransactionCategorySource.DEFAULT,
  TransactionCategorySource.KIND,
  TransactionCategorySource.BRAND,
  TransactionCategorySource.RECEIPT,
  TransactionCategorySource.KEYWORD,
  TransactionCategorySource.HISTORY,
  TransactionCategorySource.LEARNED,
];

/**
 * Fresh suggestions for a statement, each time it is opened with rows still
 * waiting: what the payees' history learned since, receipts added since, and
 * rules written since all reach it. Only rows nobody decided are touched:
 * never a confirmed row, a hand-picked category, a rule's, a split, a
 * duplicate, a transfer between own accounts or a row whose tax is locked. Each write checks the source is still the one read, so a person's
 * edit made in the meantime is never overwritten, and running it twice is
 * harmless.
 */
@Injectable()
export class StatementSuggestionsService {
  constructor(
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Statement) private readonly statements: Repository<Statement>,
    @InjectRepository(Receipt) private readonly receipts: Repository<Receipt>,
    private readonly classification: ClassificationService,
    private readonly taxAssignment: TaxAssignmentService,
    private readonly audit: AuditService,
  ) {}

  async suggest(
    workspaceId: string,
    userId: string,
    statementId: string,
  ): Promise<{ suggested: number; unchanged: number }> {
    const statement = await this.statements.findOne({
      where: { id: statementId, workspaceId },
      select: { id: true },
    });
    if (!statement) {
      throw new NotFoundException(appError('PARSING_STATEMENT_NOT_FOUND', { statementId }));
    }

    const rows = await this.transactions
      .createQueryBuilder('t')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.statementId = :statementId', { statementId })
      .andWhere('t.isVerified = false')
      .andWhere('t.isDuplicate = false')
      .andWhere('t.taxLocked = false')
      .andWhere('t.splitGroupId IS NULL')
      .andWhere('t.transferPairId IS NULL')
      .andWhere('(t.categoryId IS NULL OR t.categorySource IN (:...replaceable))', {
        replaceable: REPLACEABLE,
      })
      .getMany();

    await this.mergeTruncated(workspaceId, rows);
    const evidence = await receiptEvidence(this.receipts, workspaceId, rows);
    const payroll = await recurringBusinessPayers(this.transactions, workspaceId, rows);
    const changed: string[] = [];
    for (const row of rows) {
      // A rule or the payee's history first; then the receipt of this very
      // purchase; then what the descriptor alone suggests.
      const match =
        (await this.byPayee(workspaceId, userId, row, row.counterpartyName, row.paymentPurpose)) ??
        (await this.fromReceipt(workspaceId, userId, row, evidence.get(row.id))) ??
        (await suggestCategory(this.categories, row, row.transactionType, workspaceId)) ??
        (await this.fromPayroll(workspaceId, row, payroll));
      if (!match || (match.categoryId === row.categoryId && match.source === row.categorySource)) {
        continue;
      }
      const result = await this.transactions.update(
        {
          id: row.id,
          workspaceId,
          isVerified: false,
          categorySource: row.categorySource ?? IsNull(),
        },
        {
          categoryId: match.categoryId,
          categorySource: match.source,
          categoryReason: match.reason,
        },
      );
      if (result.affected) {
        changed.push(row.id);
      }
    }

    if (changed.length > 0) {
      await this.taxAssignment.reassess(workspaceId, { ids: changed });
    }
    return { suggested: changed.length, unchanged: rows.length - changed.length };
  }

  /**
   * Joins payees of these rows that are one name a bank cut short ("MAMTA
   * KUM", "MAMTAKUM", "MAMTA KUMARI DAS"), so their history is one history.
   * The rows then carry the joined payee.
   */
  private async mergeTruncated(workspaceId: string, rows: Transaction[]): Promise<void> {
    const payeeIds = [...new Set(rows.map(row => row.payeeId).filter(Boolean))] as string[];
    const merges = await this.transactions.manager.transaction(manager =>
      mergeTruncatedPayees(manager, workspaceId, payeeIds),
    );
    const into = new Map<string, string>();
    for (const merge of merges) {
      for (const source of merge.sources) {
        into.set(source.id, merge.targetId);
      }
      await this.audit.createEvent({
        workspaceId,
        actorType: ActorType.SYSTEM,
        actorId: null,
        entityType: EntityType.PAYEE,
        entityId: merge.targetId,
        action: AuditAction.UPDATE,
        meta: { mergedPayees: merge.sources, reason: 'truncated_name' },
      });
    }
    for (const row of rows) {
      row.payeeId = (row.payeeId && into.get(row.payeeId)) ?? row.payeeId;
    }
  }

  /** A business that pays this workspace regularly: its money is most likely a salary. */
  private async fromPayroll(
    workspaceId: string,
    row: Transaction,
    payroll: Set<string>,
  ): Promise<AutoCategoryMatch | null> {
    if (
      row.transactionType !== 'income' ||
      !payroll.has(row.counterpartyName.trim().toLowerCase())
    ) {
      return null;
    }
    const salary = await this.categories.findOne({
      where: { workspaceId, systemKey: 'salary', isEnabled: true },
      select: { id: true },
    });
    return salary
      ? {
          categoryId: salary.id,
          source: TransactionCategorySource.KIND,
          reason: 'kind:salary_recurring',
        }
      : null;
  }

  private byPayee(
    workspaceId: string,
    userId: string,
    row: Transaction,
    counterpartyName: string,
    paymentPurpose: string,
  ): Promise<AutoCategoryMatch | null> {
    return this.classification.suggestForPayee({
      workspaceId,
      userId,
      counterpartyName,
      paymentPurpose,
      transactionType: row.transactionType,
      amount: row.amount,
    });
  }

  /**
   * The category a receipt gives its bank row: the one a person or a rule
   * picked on the receipt, else what its vendor is filed as or suggests, else
   * the receipt's own suggestion. Only a category of this workspace that is
   * still enabled.
   */
  private async fromReceipt(
    workspaceId: string,
    userId: string,
    row: Transaction,
    evidence: ReceiptEvidence | undefined,
  ): Promise<AutoCategoryMatch | null> {
    if (!evidence) {
      return null;
    }
    const decided =
      evidence.categorySource === TransactionCategorySource.MANUAL ||
      evidence.categorySource === TransactionCategorySource.RULE;
    let categoryId = decided ? evidence.categoryId : null;
    if (!categoryId && evidence.vendor) {
      const byVendor =
        (await this.byPayee(workspaceId, userId, row, evidence.vendor, evidence.vendor)) ??
        (await suggestCategory(
          this.categories,
          {
            ...row,
            counterpartyName: evidence.vendor,
            paymentPurpose: evidence.vendor,
          } as Transaction,
          row.transactionType,
          workspaceId,
        ));
      categoryId = byVendor?.categoryId ?? null;
    }
    if (!categoryId && evidence.categorySource !== TransactionCategorySource.DEFAULT) {
      categoryId = evidence.categoryId;
    }
    const category = categoryId
      ? await this.categories.findOne({
          where: { id: categoryId, workspaceId, isEnabled: true },
          select: { id: true },
        })
      : null;
    return category
      ? {
          categoryId: category.id,
          source: TransactionCategorySource.RECEIPT,
          reason: `receipt:${evidence.receiptId}`,
        }
      : null;
  }
}
