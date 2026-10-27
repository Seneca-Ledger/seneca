import type { Repository } from 'typeorm';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import type { Transaction } from '../../entities/transaction.entity';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';

/** What the documents list says about a statement's rows. */
export type StatementTransactionSummary = {
  description: string | null;
  exchangeRate: string | null;
  exchangeRateMixed: boolean;
  cardLabel: string | null;
  /** Rows still waiting for a category; transfers and duplicates need none. */
  uncategorizedCount: number;
};

type StatementTransactionSummaryRow = {
  statementId: string;
  description: string | null;
  exchangeRate: string | null;
  exchangeRateCount: string;
  cardLabel: string | null;
  uncategorizedCount: string;
};

export const EMPTY_TRANSACTION_SUMMARY: StatementTransactionSummary = {
  description: null,
  exchangeRate: null,
  exchangeRateMixed: false,
  cardLabel: null,
  uncategorizedCount: 0,
};

/**
 * A row has no category while it has none at all (a receipt's) or still sits
 * in the Uncategorized fallback that statement processing gives every row it
 * cannot place by payee.
 */
const UNCATEGORIZED_ROW = `(transaction.categoryId IS NULL OR LOWER(category.name) = :uncategorizedName)
  AND transaction.transferPairId IS NULL
  AND transaction.isDuplicate = false`;

export async function loadTransactionSummaries(
  transactions: Repository<Transaction>,
  workspaceId: string,
  statementIds: string[],
  viewerMemberId: string | null,
): Promise<Map<string, StatementTransactionSummary>> {
  if (statementIds.length === 0) {
    return new Map();
  }

  const queryBuilder = transactions.createQueryBuilder('transaction');
  if (
    typeof queryBuilder.leftJoin !== 'function' ||
    typeof queryBuilder.addSelect !== 'function' ||
    typeof queryBuilder.getRawMany !== 'function'
  ) {
    return new Map();
  }

  const rows = await queryBuilder
    .leftJoin('transaction.wallet', 'wallet')
    .leftJoin('transaction.category', 'category')
    .select('transaction.statementId', 'statementId')
    .addSelect(
      // The first purpose the viewer may read: another member's private row
      // does not get to describe the whole document.
      `(ARRAY_REMOVE(ARRAY_AGG(NULLIF(transaction.paymentPurpose, '') ORDER BY transaction.transactionDate ASC, transaction.createdAt ASC) FILTER (WHERE ${readablePrivateSql('transaction')}), NULL))[1]`,
      'description',
    )
    .addSelect(
      'MIN(transaction.exchangeRate) FILTER (WHERE transaction.exchangeRate IS NOT NULL)',
      'exchangeRate',
    )
    .addSelect(
      'COUNT(DISTINCT transaction.exchangeRate) FILTER (WHERE transaction.exchangeRate IS NOT NULL)',
      'exchangeRateCount',
    )
    .addSelect(
      "(ARRAY_REMOVE(ARRAY_AGG(NULLIF(wallet.name, '') ORDER BY transaction.transactionDate ASC, transaction.createdAt ASC), NULL))[1]",
      'cardLabel',
    )
    .addSelect(
      `COUNT(*) FILTER (WHERE ${UNCATEGORIZED_ROW} AND ${readablePrivateSql('transaction')})`,
      'uncategorizedCount',
    )
    .where('transaction.workspaceId = :workspaceId', { workspaceId })
    .andWhere('transaction.statementId IN (:...statementIds)', { statementIds })
    .groupBy('transaction.statementId')
    .setParameter(PRIVACY_VIEWER_PARAM, viewerMemberId)
    .setParameter('uncategorizedName', UNCATEGORIZED_CATEGORY_NAME.toLowerCase())
    .getRawMany<StatementTransactionSummaryRow>();

  return new Map(
    rows.map(row => [
      row.statementId,
      {
        description: row.description ?? null,
        exchangeRate: row.exchangeRate ?? null,
        exchangeRateMixed: Number(row.exchangeRateCount || 0) > 1,
        cardLabel: row.cardLabel ?? null,
        uncategorizedCount: Number(row.uncategorizedCount || 0),
      },
    ]),
  );
}
