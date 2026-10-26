import type { Repository } from 'typeorm';
import { countedSql } from '../../../common/utils/counted-transactions.util';
import { canReadPrivate, redactPrivateRows } from '../../../common/utils/transaction-privacy.util';
import { CustomTableColumnType } from '../../../entities/custom-table-column.entity';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';
import type { SourceAdapter, SourceColumnDef, SourceFilters, SourceRow } from './source.types';
import { assertEnumFilter, option, SOURCE_FETCH_LIMIT, toDateOnly, toNumber } from './source.utils';

/**
 * One signed money column instead of debit/credit: sums and formulas stay
 * meaningful, and the type column keeps the direction visible.
 */
export class TransactionsSource implements SourceAdapter {
  readonly kind = 'transactions' as const;

  readonly columns: SourceColumnDef[] = [
    { field: 'date', title: 'Date', type: CustomTableColumnType.DATE },
    { field: 'counterparty', title: 'Counterparty', type: CustomTableColumnType.TEXT },
    { field: 'purpose', title: 'Purpose', type: CustomTableColumnType.TEXT },
    { field: 'amount', title: 'Amount', type: CustomTableColumnType.CURRENCY, money: true },
    {
      field: 'type',
      title: 'Type',
      type: CustomTableColumnType.SELECT,
      config: {
        options: [option(TransactionType.INCOME, 'green'), option(TransactionType.EXPENSE, 'red')],
      },
    },
    { field: 'category', title: 'Category', type: CustomTableColumnType.TEXT },
    { field: 'tags', title: 'Tags', type: CustomTableColumnType.TEXT },
    { field: 'currency', title: 'Currency', type: CustomTableColumnType.TEXT },
    { field: 'statement', title: 'Statement', type: CustomTableColumnType.TEXT },
  ];

  constructor(private readonly transactionRepository: Repository<Transaction>) {}

  async fetchRows(workspaceId: string, filters: SourceFilters): Promise<SourceRow[]> {
    const qb = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.statement', 'statement')
      .leftJoinAndSelect('tx.category', 'category')
      .where('tx.workspaceId = :workspaceId', { workspaceId })
      .andWhere('(tx.statementId IS NULL OR statement.deletedAt IS NULL)')
      .andWhere(countedSql('tx'))
      .orderBy('tx.transactionDate', 'ASC')
      .addOrderBy('tx.createdAt', 'ASC')
      .take(SOURCE_FETCH_LIMIT);

    if (filters.dateFrom) {
      qb.andWhere('tx.transactionDate >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('tx.transactionDate <= :dateTo', { dateTo: filters.dateTo });
    }
    const type = assertEnumFilter(filters.type, Object.values(TransactionType));
    if (type) {
      qb.andWhere('tx.transactionType = :type', { type });
    }
    if (filters.categoryIds?.length) {
      qb.andWhere('tx.categoryId IN (:...categoryIds)', { categoryIds: filters.categoryIds });
    }
    if (filters.currency) {
      qb.andWhere('UPPER(tx.currency) = :currency', { currency: filters.currency.toUpperCase() });
    }
    if (filters.statementIds?.length) {
      qb.andWhere('tx.statementId IN (:...statementIds)', { statementIds: filters.statementIds });
    }
    if (filters.ids?.length) {
      qb.andWhere('tx.id IN (:...ids)', { ids: filters.ids });
    }

    // A table is read by the whole workspace (and can be shared publicly), so
    // whoever fills it, private rows go in as everyone else sees them: date and
    // amount, no merchant, purpose or tags.
    const transactions = redactPrivateRows(await qb.getMany(), null);
    const tagNames = await this.loadTagNames(
      workspaceId,
      transactions.filter(tx => canReadPrivate(tx, null)).map(tx => tx.id),
    );
    return transactions.map(tx => {
      const magnitude = Math.abs(
        toNumber(tx.amount) ?? toNumber(tx.credit) ?? toNumber(tx.debit) ?? 0,
      );
      return {
        sourceKey: tx.id,
        values: {
          date: toDateOnly(tx.transactionDate),
          counterparty: tx.counterpartyName || '',
          purpose: tx.paymentPurpose || '',
          amount: tx.transactionType === TransactionType.EXPENSE ? -magnitude : magnitude,
          type: tx.transactionType,
          category: tx.category?.name ?? '',
          tags: tagNames.get(tx.id) ?? '',
          currency: tx.currency || '',
          statement: tx.statement?.fileName ?? '',
        },
      };
    });
  }

  /**
   * The tags a row carries: its own, its statement's and those of the receipts
   * attached to it, by name, each once, sorted, joined with ", ".
   */
  private async loadTagNames(
    workspaceId: string,
    transactionIds: string[],
  ): Promise<Map<string, string>> {
    if (transactionIds.length === 0) {
      return new Map();
    }
    const rows: Array<{ transactionId: string; name: string }> =
      await this.transactionRepository.query(
        `SELECT DISTINCT x.transaction_id AS "transactionId", t.name AS name
           FROM (
             SELECT tt.transaction_id, tt.tag_id
               FROM transaction_tags tt
              WHERE tt.transaction_id = ANY($1::uuid[])
             UNION
             SELECT tx.id, st.tag_id
               FROM transactions tx
               JOIN statement_tags st ON st.statement_id = tx.statement_id
              WHERE tx.id = ANY($1::uuid[]) AND tx.workspace_id = $2
             UNION
             SELECT r.transaction_id, rt.tag_id
               FROM receipts r
               JOIN receipt_tags rt ON rt.receipt_id = r.id
              WHERE r.transaction_id = ANY($1::uuid[]) AND r.workspace_id = $2
           ) x
           JOIN tags t ON t.id = x.tag_id
          WHERE t.workspace_id = $2`,
        [transactionIds, workspaceId],
      );
    const byTransaction = new Map<string, Set<string>>();
    for (const row of rows) {
      const names = byTransaction.get(row.transactionId) ?? new Set<string>();
      names.add(row.name);
      byTransaction.set(row.transactionId, names);
    }
    return new Map(
      [...byTransaction].map(([id, names]) => [
        id,
        [...names].sort((a, b) => a.localeCompare(b)).join(', '),
      ]),
    );
  }
}
