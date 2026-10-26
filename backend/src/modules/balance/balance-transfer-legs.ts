import type { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { type Transaction, TransferPairKind } from '../../entities';
import { normalizeCurrencyCode } from '../exchange-rates/currency-converter';

/** One leg of a paired transfer, as the cash walk reads it. */
export type TransferLegRow = {
  pairId: string;
  date: string;
  currency: string | null;
  credit: string | null;
  debit: string | null;
};

/** A change to the cash held in one currency on one day. */
export type CashMovement = {
  date: string;
  currency: string;
  amount: number;
};

/** The legs of transfers between the user's own wallets, one row per leg. */
export async function loadTransferLegs(
  transactionRepository: Repository<Transaction>,
  workspaceId: string,
  walletIds: string[],
  to: string,
): Promise<TransferLegRow[]> {
  // The same rows the main query counts, or a correction would move a leg
  // that was never on the chart.
  return (
    onlyCounted(
      transactionRepository
        .createQueryBuilder('transaction')
        .leftJoin('transaction.statement', 'statement')
        .select('transaction.transferPairId', 'pairId')
        .addSelect('transaction.transactionDate', 'date')
        .addSelect('transaction.currency', 'currency')
        .addSelect('COALESCE(transaction.credit, 0)', 'credit')
        .addSelect('COALESCE(transaction.debit, 0)', 'debit')
        .where('transaction.workspaceId = :workspaceId', { workspaceId }),
      'transaction',
    )
      .andWhere('transaction.walletId IN (:...walletIds)', { walletIds })
      .andWhere('transaction.transactionDate <= :to', { to })
      .andWhere('(transaction.statementId IS NULL OR statement.deletedAt IS NULL)')
      .andWhere('transaction.transferPairId IS NOT NULL')
      // A reimbursement is two real events — the money was out and came back,
      // and that gap belongs on the chart. Only a transfer is one event.
      .andWhere('(transaction.transferPairKind IS NULL OR transaction.transferPairKind = :kind)', {
        kind: TransferPairKind.TRANSFER,
      })
      .orderBy('transaction.transactionDate', 'ASC')
      .getRawMany<TransferLegRow>()
  );
}

/**
 * Corrections that move every leg of a transfer back to the day the money
 * left, cancelling the entry the main query made on the day each bank
 * happened to post.
 *
 * Banks rarely post both sides of a transfer on the same day, and until the
 * second one lands the money is nowhere: the chart shows a dip that never
 * happened and that nobody can explain afterwards. A transfer is one event,
 * so it gets one date.
 */
export function alignTransferLegs(legs: TransferLegRow[]): CashMovement[] {
  const byPair = new Map<string, TransferLegRow[]>();
  for (const leg of legs) {
    const bucket = byPair.get(leg.pairId);
    if (bucket) {
      bucket.push(leg);
    } else {
      byPair.set(leg.pairId, [leg]);
    }
  }

  const corrections: CashMovement[] = [];
  for (const pair of byPair.values()) {
    const dates = pair.map(leg => toDateOnly(leg.date));
    const start = dates.reduce((earliest, date) => (date < earliest ? date : earliest));
    pair.forEach((leg, index) => {
      const date = dates[index];
      if (date === start) {
        return;
      }
      const currency = normalizeCurrencyCode(leg.currency);
      const amount = toNumber(leg.credit) - toNumber(leg.debit);
      corrections.push({ date: start, currency, amount });
      corrections.push({ date, currency, amount: -amount });
    });
  }
  return corrections;
}

function toDateOnly(value: string | Date): string {
  return new Date(value).toISOString().split('T')[0];
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
