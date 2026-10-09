import type { Repository } from 'typeorm';
import { countedSql } from '../../../common/utils/counted-transactions.util';
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

    const transactions = await qb.getMany();
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
          currency: tx.currency || '',
          statement: tx.statement?.fileName ?? '',
        },
      };
    });
  }
}
