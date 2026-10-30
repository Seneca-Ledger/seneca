import type { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import type { NetWorthAttribution, NetWorthAttributionRow, NetWorthSavings } from '../../contracts';
import { type BalanceAccount, BalanceAccountType, type Transaction } from '../../entities';
import { CASH_ACCOUNT_CODE, DEBTS_ACCOUNT_CODE } from '../balance/balance.service';
import { balanceAccountName } from '../balance/balance-account-name';
import { isoDate } from '../balance/snapshot-series';
import {
  type CurrencyConverter,
  normalizeCurrencyCode,
} from '../exchange-rates/currency-converter';
import { round2, toNumber } from './net-worth-math';

/**
 * Where the change over the window came from.
 *
 * For a line worth `A` in its own currency at a rate `R`, the move splits
 * without a remainder into what the line itself did, valued at the rate it
 * started the window on, and what the rate did to what the line ended with:
 *
 *     A₁R₁ − A₀R₀ = (A₁ − A₀)·R₀ + A₁·(R₁ − R₀)
 *
 * The first term is the line's own doing, the second is the currency's. For
 * cash the first term is money that came in or went out; for an investment
 * account it is what was paid in plus what the market did, and the paid-in
 * part is known from the contributions linked to it. Everything else only
 * ever moves when someone types a new value, so that is all revaluation.
 *
 * Money moved between the user's own accounts cancels: it leaves cash and
 * arrives as a contribution, so `money` is what came in from outside.
 */
export function buildAttribution(input: {
  contributions: Map<string, Map<string, number>>;
  leaves: BalanceAccount[];
  nativeAt: (leaf: BalanceAccount, date: string) => Map<string, number>;
  converter: CurrencyConverter;
  from: string;
  to: string;
  change: number;
  locale?: string;
}): NetWorthAttribution {
  const { contributions, leaves, nativeAt, converter, from, to, change, locale } = input;

  const rate = (code: string, date: string): number => converter.convert(1, code, date);
  const byAccount: NetWorthAttributionRow[] = [];
  let money = 0;
  let revaluation = 0;

  for (const leaf of leaves) {
    const sign =
      leaf.accountType === BalanceAccountType.ASSET
        ? 1
        : leaf.accountType === BalanceAccountType.LIABILITY
          ? -1
          : 0;
    if (sign === 0) {
      continue;
    }

    const opening = nativeAt(leaf, from);
    const closing = nativeAt(leaf, to);
    const paidIn = contributions.get(leaf.id) ?? new Map<string, number>();
    let own = 0;
    let rates = 0;
    let contributed = 0;

    for (const code of new Set([...opening.keys(), ...closing.keys(), ...paidIn.keys()])) {
      const before = opening.get(code) ?? 0;
      const after = closing.get(code) ?? 0;
      const opened = rate(code, from);
      const closed = rate(code, to);

      if (opened > 0 && closed > 0) {
        own += (after - before) * opened;
        rates += after * (closed - opened);
      } else {
        // No rate at one end of the window: there is no rate *move* to speak
        // of, and calling the whole thing a currency effect would be a lie.
        // The line simply was not valuable here before, or is not now.
        own += after * closed - before * opened;
      }
      contributed += (paidIn.get(code) ?? 0) * (opened > 0 ? opened : closed);
    }

    // Cash and card or loan debts move with the user's own rows: all of it is money moved.
    const booked = leaf.code === CASH_ACCOUNT_CODE || leaf.code === DEBTS_ACCOUNT_CODE;
    const moved = booked ? own : contributed;
    money += sign * moved;
    revaluation += sign * (own - moved);

    byAccount.push({
      id: leaf.id,
      code: leaf.code,
      name: balanceAccountName(leaf, locale),
      amount: sign * (own + rates),
    });
  }

  const rows = byAccount
    .map(row => ({ ...row, amount: round2(row.amount) }))
    .filter(row => row.amount !== 0)
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount));

  // A table that does not add up to the figure above it is worse than no
  // table: the pennies lost to rounding go to the largest line, and the last
  // kind absorbs them the same way.
  const residual = round2(change - rows.reduce((sum, row) => sum + row.amount, 0));
  if (residual !== 0 && rows.length > 0) {
    rows[0] = { ...rows[0], amount: round2(rows[0].amount + residual) };
  }

  const movedTotal = round2(money);
  const revaluedTotal = round2(revaluation);
  const byKind = [
    { kind: 'money' as const, amount: movedTotal },
    { kind: 'revaluation' as const, amount: revaluedTotal },
    { kind: 'fx' as const, amount: round2(change - movedTotal - revaluedTotal) },
  ].filter(row => row.amount !== 0);

  return { byAccount: rows, byKind };
}

/**
 * What came in over the window, and the share of it still there at the end.
 *
 * `kept` is the money the attribution already found: everything that came
 * in from outside minus everything that went out, with moves between the
 * user's own accounts cancelling. Against income that is the savings rate,
 * the one number the whole early-retirement literature is about.
 *
 * Income is counted on the day it arrived, at that day's rate, and a leg of
 * a transfer or a reimbursement is not income however it is booked.
 */
export async function buildSavings(input: {
  transactionRepository: Repository<Transaction>;
  workspaceId: string;
  converter: CurrencyConverter;
  from: string;
  to: string;
  kept: number;
}): Promise<NetWorthSavings> {
  const { transactionRepository, workspaceId, converter, from, to, kept } = input;
  // Income a person confirmed, the same rows the cash line counts.
  const rows = await onlyCounted(
    transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.statement', 'statement')
      .select('transaction.transactionDate', 'date')
      .addSelect('transaction.currency', 'currency')
      .addSelect('COALESCE(SUM(transaction.credit), 0)', 'credit')
      .where('transaction.workspaceId = :workspaceId', { workspaceId }),
    'transaction',
  )
    .andWhere('transaction.transactionDate > :from', { from })
    .andWhere('transaction.transactionDate <= :to', { to })
    .andWhere('transaction.transferPairId IS NULL')
    .groupBy('transaction.transactionDate')
    .addGroupBy('transaction.currency')
    .getRawMany<{ date: string; currency: string; credit: string }>();

  let income = 0;
  for (const row of rows) {
    income += converter.convert(
      toNumber(row.credit),
      normalizeCurrencyCode(row.currency || converter.target),
      isoDate(new Date(row.date)),
    );
  }

  const rounded = round2(income);
  return {
    income: rounded,
    kept,
    rate: rounded > 0 ? round2((kept / rounded) * 100) : null,
  };
}
