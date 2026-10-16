import type { Repository, SelectQueryBuilder } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import { type Receipt, ReceiptSource, ReceiptStatus } from '../../entities/receipt.entity';
import type { Transaction } from '../../entities/transaction.entity';

/**
 * What the Review queue holds, as queries the queue and the dashboard share, so
 * a count on the dashboard is always the number of things Review will show.
 * Each joins the statement as `s` (rows of a deleted statement are gone with it).
 */

/** Rows nobody has confirmed yet: the queue's main list. */
export function unconfirmedRowsQuery(
  transactions: Repository<Transaction>,
  workspaceId: string,
): SelectQueryBuilder<Transaction> {
  return transactions
    .createQueryBuilder('t')
    .leftJoin('t.statement', 's')
    .where('t.workspaceId = :workspaceId', { workspaceId })
    .andWhere('t.isDuplicate = false')
    .andWhere('t.isVerified = false')
    .andWhere('(t.statementId IS NULL OR s.deletedAt IS NULL)');
}

/** Rows flagged as possible duplicates and not settled yet. */
export function reviewDuplicatesQuery(
  transactions: Repository<Transaction>,
  workspaceId: string,
): SelectQueryBuilder<Transaction> {
  return transactions
    .createQueryBuilder('t')
    .leftJoin('t.statement', 's')
    .where('t.workspaceId = :workspaceId', { workspaceId })
    .andWhere('t.isDuplicate = true')
    .andWhere('t.isVerified = false')
    .andWhere("(t.duplicateMatchType IS NULL OR t.duplicateMatchType != 'manual')")
    .andWhere('(t.statementId IS NULL OR s.deletedAt IS NULL)');
}

/**
 * Rows with no category, confirmed or not: the "categorised" step of the month
 * close. Only rows that count once confirmed (no duplicates, transfers, rows of
 * a trashed or unread statement, crypto that settles nothing), so every row here
 * changes a number when it gets one.
 */
export function uncategorizedRowsQuery(
  transactions: Repository<Transaction>,
  workspaceId: string,
): SelectQueryBuilder<Transaction> {
  const query = transactions
    .createQueryBuilder('t')
    .leftJoin('t.statement', 's')
    .where('t.workspaceId = :workspaceId', { workspaceId })
    .andWhere('t.categoryId IS NULL')
    .andWhere('t.transferPairId IS NULL');
  return onlyFlows(query, 't', { includeUnconfirmed: true });
}

/**
 * The date each queue's items are counted by, for a month on the dashboard and
 * a date range in Review: a row by its own date, a receipt by when it came in
 * (not when it was imported).
 */
export const QUEUE_DATE_COLUMN = {
  row: 't.transactionDate',
  receipt: 'receipt.receivedAt',
} as const;

/**
 * Receipts not yet turned into a transaction. A flagged one is always listed;
 * the rest once something was parsed from them (an email with no amount is
 * not a receipt yet), or when it is a scan the user uploaded. A scan that
 * already booked its row is asked about as that row, not a second time here.
 */
export function pendingReceiptsQuery(
  receipts: Repository<Receipt>,
  workspaceId: string,
): SelectQueryBuilder<Receipt> {
  return receipts
    .createQueryBuilder('receipt')
    .where('receipt.workspaceId = :workspaceId', { workspaceId })
    .andWhere('receipt.isDuplicate = false')
    .andWhere('receipt.transactionId IS NULL')
    .andWhere(
      `(receipt.statement_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM transactions scan_row
           WHERE scan_row.statement_id = receipt.statement_id
             AND scan_row.workspace_id = receipt.workspace_id))`,
    )
    .andWhere(
      `(receipt.status = :flagged OR (receipt.status IN (:...ready) AND (
          NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL
          OR (receipt.source = :scan AND receipt.statement_id IS NOT NULL))))`,
      {
        flagged: ReceiptStatus.NEEDS_REVIEW,
        ready: [
          ReceiptStatus.NEW,
          ReceiptStatus.PARSED,
          ReceiptStatus.DRAFT,
          ReceiptStatus.REVIEWED,
        ],
        scan: ReceiptSource.SCAN,
      },
    );
}
