import type { SelectQueryBuilder } from 'typeorm';
import { type OwnerFilter, parseOwnerFilter } from '../../common/utils/transaction-owner.util';
import type { PaymentType, TransactionListQuery } from '../../contracts';
import type { Transaction } from '../../entities/transaction.entity';

/** What `GET /transactions` narrows the list by. */
export interface TransactionListFilters {
  statementId?: string;
  walletId?: string;
  payeeId?: string;
  paymentType?: PaymentType;
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

/** `GET /transactions` query to filters; the snake_case spelling wins, the camelCase one is the fallback. */
export function listFiltersFromQuery(
  query: TransactionListQuery,
  selfMemberId: string | null,
): TransactionListFilters {
  const dateFrom = query.date_from || query.startDate;
  const dateTo = query.date_to || query.endDate;
  return {
    statementId: query.statement_id || query.statementId,
    walletId: query.walletId,
    payeeId: query.payeeId,
    paymentType: query.paymentType,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    type: query.type,
    categoryId: query.category_id || query.categoryId,
    currency: query.currency,
    convertTo: query.convert_to,
    owner: parseOwnerFilter(query.owner, selfMemberId),
    page: query.page ?? 1,
    limit: query.limit ?? 50,
  };
}

/** The list's filters other than the owner, on a query aliased `transaction`. */
export function applyListFilters(
  query: SelectQueryBuilder<Transaction>,
  filters: TransactionListFilters,
  viewerMemberId: string | null = null,
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

  if (filters.paymentType) {
    query.andWhere('transaction.paymentType = :paymentType', {
      paymentType: filters.paymentType,
    });
    // Another member's private row hides its type, so the filter must not reveal it either.
    query.andWhere(
      '(transaction.isPrivate = false OR transaction.ownerMemberId = :viewerMemberId)',
      { viewerMemberId },
    );
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
