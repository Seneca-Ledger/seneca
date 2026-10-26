import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Transaction } from '../../../entities/transaction.entity';

/** A bank row may post a few days after the payment it records. */
const DAYS_APART = 3;
const DAY_MS = 86_400_000;

/** Which side of the ledger a row moves, as cents: comparable across rows. */
function sideOf(
  row: Pick<Transaction, 'debit' | 'credit'>,
): { side: 'debit' | 'credit'; cents: number } | null {
  const debit = Number(row.debit ?? 0);
  const credit = Number(row.credit ?? 0);
  if (debit > 0) {
    return { side: 'debit', cents: Math.round(debit * 100) };
  }
  if (credit > 0) {
    return { side: 'credit', cents: Math.round(credit * 100) };
  }
  return null;
}

const dayOf = (value: Date | string): number => {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

/**
 * Rows from a statement that repeat one booked by hand.
 *
 * A cash payment or an approved receipt is a transaction without a statement,
 * and it counts in every figure. When the bank statement with that payment
 * arrives, its row is the same money; the fingerprint cannot tell (it carries
 * the account, which a hand-booked row lacks). Such a row is compared by
 * currency, side, amount to the cent and a date at most three days apart, and
 * flagged as a suspected duplicate of the hand-booked row: kept, out of every
 * figure, and in Review, where "keep both" undoes it.
 */
@Injectable()
export class ManualRowDuplicateService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /** Flags `drafts` (rows about to be saved) in place; returns how many it flagged. */
  async flagRepeats(drafts: Transaction[], workspaceId: string): Promise<number> {
    const open = drafts.filter(draft => !draft.isDuplicate && sideOf(draft));
    if (open.length === 0) {
      return 0;
    }
    const days = open.map(draft => dayOf(draft.transactionDate));
    const since = new Date(Math.min(...days) - DAYS_APART * DAY_MS);
    const until = new Date(Math.max(...days) + DAYS_APART * DAY_MS);
    const currencies = [...new Set(open.map(draft => draft.currency))];

    // Hand-booked rows: no statement, confirmed, counting, not crypto, and not
    // already standing in for a row an earlier import flagged.
    const booked = await this.transactionRepository
      .createQueryBuilder('t')
      .select(['t.id', 't.transactionDate', 't.currency', 't.debit', 't.credit'])
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.statementId IS NULL')
      .andWhere('t.cryptoWalletId IS NULL')
      .andWhere('t.isVerified = true')
      .andWhere('t.isDuplicate = false')
      .andWhere('t.currency IN (:...currencies)', { currencies })
      .andWhere('t.transactionDate BETWEEN :since AND :until', { since, until })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM transactions paired WHERE paired.duplicate_of_id = t.id AND paired.is_duplicate = true)',
      )
      .getMany();

    const taken = new Set<string>();
    let flagged = 0;
    for (const draft of open) {
      const draftSide = sideOf(draft);
      const draftDay = dayOf(draft.transactionDate);
      // The closest date wins: two payments of one price are two payments.
      const match = booked
        .filter(row => !taken.has(row.id) && row.currency === draft.currency)
        .filter(row => {
          const rowSide = sideOf(row);
          return rowSide?.side === draftSide?.side && rowSide?.cents === draftSide?.cents;
        })
        .map(row => ({ row, apart: Math.abs(dayOf(row.transactionDate) - draftDay) }))
        .filter(({ apart }) => apart <= DAYS_APART * DAY_MS)
        .sort((left, right) => left.apart - right.apart)[0];
      if (!match) {
        continue;
      }
      taken.add(match.row.id);
      draft.isDuplicate = true;
      draft.duplicateOfId = match.row.id;
      draft.duplicateMatchType = 'manual_entry';
      flagged++;
    }
    return flagged;
  }
}
