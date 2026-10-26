import type { SelectQueryBuilder } from 'typeorm';
import type { OwnerFilter } from '../../common/utils/transaction-owner.util';
import type { Transaction } from '../../entities/transaction.entity';

/** What `GET /transactions` narrows the list by. */
export interface TransactionListFilters {
  statementId?: string;
  walletId?: string;
  payeeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  type?: string;
  categoryId?: string;
  currency?: string;
  convertTo?: string;
  owner?: OwnerFilter;
  page?: number;
  limit?: number;
}

/** The list's filters other than the owner, on a query aliased `transaction`. */
export function applyListFilters(
  query: SelectQueryBuilder<Transaction>,
  filters: TransactionListFilters,
): void {
  if (filters.statementId) {
    query.andWhere('transaction.statementId = :statementId', {
      statementId: filters.statementId,
    });
  }

  if (filters.walletId) {
    query.andWhere('transaction.walletId = :walletId', { walletId: filters.walletId });
  }

  if (filters.payeeId) {
    query.andWhere('transaction.payeeId = :payeeId', { payeeId: filters.payeeId });
  }

  if (filters.dateFrom) {
    query.andWhere('transaction.transactionDate >= :dateFrom', {
      dateFrom: filters.dateFrom,
    });
  }

  if (filters.dateTo) {
    query.andWhere('transaction.transactionDate <= :dateTo', {
      dateTo: filters.dateTo,
    });
  }

  if (filters.type === 'transfer') {
    query.andWhere('transaction.transferPairId IS NOT NULL');
  } else if (filters.type) {
    query.andWhere('transaction.transactionType = :type', { type: filters.type });
  }

  if (filters.categoryId) {
    query.andWhere('transaction.categoryId = :categoryId', {
      categoryId: filters.categoryId,
    });
  }

  if (filters.currency) {
    query.andWhere('UPPER(transaction.currency) = :currency', {
      currency: filters.currency.toUpperCase(),
    });
  }
}
