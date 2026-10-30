import type { Repository } from 'typeorm';
import { type Receipt, ReceiptStatus } from '../../../entities/receipt.entity';
import type { Transaction } from '../../../entities/transaction.entity';
import {
  type MatchCandidate,
  matchReceiptToTransactions,
  RECEIPT_MULTI_DATE_WINDOW_DAYS,
} from '../../receipts/services/receipt-transaction-match';

/** What a receipt says about the bank row it documents. */
export type ReceiptEvidence = {
  receiptId: string;
  vendor: string | null;
  categoryId: string | null;
  /** Who picked `categoryId` on the receipt; only a person's or a rule's pick is taken as is. */
  categorySource: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (value: Date | string): string => new Date(value).toISOString().slice(0, 10);

/**
 * The receipt behind each row, where there is one: a receipt already attached
 * to the row, or one the receipt matcher pairs with it alone (amount, date,
 * currency; two rows that fit equally get none). Banks that print only "POS
 * Purchase" still have the shop on the receipt. A row two receipts point at
 * is left out: which one it is cannot be told.
 */
export async function receiptEvidence(
  receipts: Repository<Receipt>,
  workspaceId: string,
  rows: Transaction[],
): Promise<Map<string, ReceiptEvidence>> {
  const found = new Map<string, ReceiptEvidence>();
  if (rows.length === 0) {
    return found;
  }
  const times = rows.map(row => new Date(row.transactionDate).getTime());
  const window = RECEIPT_MULTI_DATE_WINDOW_DAYS * DAY_MS;
  const since = dayOf(new Date(Math.min(...times) - window));
  const until = dayOf(new Date(Math.max(...times) + window));
  const rowIds = new Set(rows.map(row => row.id));

  const candidates: MatchCandidate[] = rows.map(row => ({
    id: row.id,
    transactionDate: row.transactionDate,
    amount: Math.abs(Number(row.amount) || Number(row.debit) || Number(row.credit) || 0),
    currency: row.currency,
    counterpartyName: row.counterpartyName,
    vendorNormalized: row.vendorNormalized,
    transactionType: row.transactionType,
  }));

  // The receipt's date lives in what was read off it; `YYYY-MM-DD…` compares as text.
  const list = await receipts
    .createQueryBuilder('r')
    .where('r.workspaceId = :workspaceId', { workspaceId })
    .andWhere('r.status NOT IN (:...closed)', {
      closed: [ReceiptStatus.REJECTED, ReceiptStatus.FAILED],
    })
    .andWhere("LEFT(r.parsed_data->>'date', 10) BETWEEN :since AND :until", { since, until })
    .getMany();

  const claims = new Map<string, ReceiptEvidence[]>();
  for (const receipt of list) {
    const data = receipt.parsedData ?? {};
    let rowId: string | undefined;
    if (receipt.transactionId) {
      rowId = rowIds.has(receipt.transactionId) ? receipt.transactionId : undefined;
    } else if (Number(data.amount) > 0 && data.date) {
      const match = matchReceiptToTransactions(
        {
          amount: Number(data.amount),
          currency: data.currency ?? null,
          date: data.date.slice(0, 10),
          vendor: data.vendor ?? null,
          transactionType: data.transactionType,
        },
        candidates,
      );
      rowId = match?.kind === 'single' ? match.transactionIds[0] : undefined;
    }
    if (rowId) {
      claims.set(rowId, [
        ...(claims.get(rowId) ?? []),
        {
          receiptId: receipt.id,
          vendor: data.vendor?.trim() || null,
          categoryId: data.categoryId ?? null,
          categorySource: data.categorySource ?? null,
        },
      ]);
    }
  }
  for (const [rowId, evidence] of claims) {
    const [only] = evidence;
    if (evidence.length === 1 && only) {
      found.set(rowId, only);
    }
  }
  return found;
}
