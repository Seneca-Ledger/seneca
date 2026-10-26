import { In, type Repository } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import type { Category } from '../../entities/category.entity';
import type { Transaction } from '../../entities/transaction.entity';

const MONTHS_LISTED = 12;

/** The money of a row, whichever side it is on. */
export const AMOUNT_SQL =
  'ABS(COALESCE(transaction.amount, COALESCE(transaction.credit, 0) - COALESCE(transaction.debit, 0)))';

export const round2 = (value: number) => Math.round(value * 100) / 100;
export const toDateOnly = (value: string | Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

/** The twelve `YYYY-MM` months ending with `end`'s, newest first. */
export function monthsTo(end: Date): string[] {
  return Array.from({ length: MONTHS_LISTED }, (_, back) =>
    new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back, 1)).toISOString().slice(0, 7),
  );
}

export function lastDayOf(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
}

/**
 * Rows of payees that count, for the viewer: counted like every income and
 * spending figure (`onlyFlows`, no transfers between own accounts), and without
 * another member's private rows.
 */
export function payeeFlows(
  transactionRepository: Repository<Transaction>,
  workspaceId: string,
  viewerMemberId: string | null,
) {
  const query = transactionRepository
    .createQueryBuilder('transaction')
    .where('transaction.workspaceId = :workspaceId', { workspaceId })
    .andWhere('transaction.payeeId IS NOT NULL')
    .andWhere('transaction.transferPairId IS NULL')
    .andWhere(readablePrivateSql('transaction'), { [PRIVACY_VIEWER_PARAM]: viewerMemberId });
  return onlyFlows(query, 'transaction');
}

/** Names of the workspace's categories among `ids`. */
export async function categoryNamesOf(
  categoryRepository: Repository<Category>,
  workspaceId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return new Map();
  }
  const categories = await categoryRepository.find({
    where: { id: In(unique), workspaceId },
    select: { id: true, name: true },
  });
  return new Map(categories.map(category => [category.id, category.name]));
}
