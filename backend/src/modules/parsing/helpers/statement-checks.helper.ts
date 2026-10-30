import type { ParseCheck, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import type { LayoutTransaction } from './pdf-layout-table.helper';

/**
 * Checks a reading against what the statement itself prints, so a bank that
 * changes its layout (columns swapped, a column moved, a row lost) is caught
 * on the first file, not by the user. Each check applies only when the
 * statement prints what it needs; one that does not apply is left out.
 */

/** Printed figures are in cents: anything closer is the same figure. */
const TOLERANCE = 0.01;
/** Card statements date a purchase days before it posts, so before the period. */
const PERIOD_SLACK_DAYS = 7;

const same = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;
const round = (value: number) => Number(value.toFixed(2));
const netOf = (row: LayoutTransaction) => (row.credit ?? 0) - (row.debit ?? 0) + (row.amount ?? 0);
const accountOf = (row: LayoutTransaction) =>
  row.account ? `${row.account.accountNumber}|${row.account.currency ?? ''}` : '';

type Mode = { direction: 'down' | 'up'; sign: 1 | -1 };

/** A printed balance, the one before it, and the rows' net amount between them either way. */
interface BalancePair {
  index: number;
  previous: number;
  balance: number;
  /** Rows after the previous balance up to this one: a list in date order. */
  down: number;
  /** Rows from the previous balance up to before this one: newest first. */
  up: number;
}

function balancePairs(rows: LayoutTransaction[], indexes: number[]): BalancePair[] {
  const pairs: BalancePair[] = [];
  let from: number | null = null;
  for (const index of indexes) {
    const balance = rows[index].balance;
    if (balance === undefined) {
      continue;
    }
    if (from !== null) {
      const start = from;
      const net = (keep: (other: number) => boolean) =>
        indexes.filter(keep).reduce((sum, other) => sum + netOf(rows[other]), 0);
      pairs.push({
        index,
        previous: rows[start].balance as number,
        balance,
        down: net(other => other > start && other <= index),
        up: net(other => other >= start && other < index),
      });
    }
    from = index;
  }
  return pairs;
}

const expectedOf = (pair: BalancePair, { direction, sign }: Mode) =>
  direction === 'down' ? pair.previous + sign * pair.down : pair.previous - sign * pair.up;

/**
 * The first pair the balance does not follow, and what it should have been.
 * The first pair that moves money sets the direction and sign for the rest.
 */
function brokenPair(pairs: BalancePair[], signs: (1 | -1)[]) {
  const modes: Mode[] = (['down', 'up'] as const).flatMap(direction =>
    signs.map(sign => ({ direction, sign })),
  );
  let mode: Mode | null = null;
  for (const pair of pairs) {
    if (!mode && pair.down === 0 && pair.up === 0) {
      // Nothing moved, so nothing decides the direction yet: the balance must hold.
      if (!same(pair.previous, pair.balance)) {
        return { pair, expected: pair.previous };
      }
      continue;
    }
    mode ??=
      modes.find(
        candidate =>
          pair[candidate.direction] !== 0 && same(expectedOf(pair, candidate), pair.balance),
      ) ?? null;
    if (!mode) {
      return { pair, expected: pair.previous + pair.down };
    }
    if (!same(expectedOf(pair, mode), pair.balance)) {
      return { pair, expected: expectedOf(pair, mode) };
    }
  }
  return null;
}

/**
 * Each printed running balance follows from the one before and the rows in
 * between: "previous + money in - money out". A statement listing its newest
 * row first runs the other way; the first pair of balances that moves decides
 * the direction, and every later pair must agree. Only a card statement may
 * also run with the sign flipped, as it prints what is owed: an account's rows
 * read with money in and out swapped would otherwise pass as a card. Rows that
 * print no balance carry their amounts to the next row that does.
 */
export function checkBalanceChain(rows: LayoutTransaction[], isCard = false): ParseCheck | null {
  const signs: (1 | -1)[] = isCard ? [1, -1] : [1];
  const accounts = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = accountOf(row);
    accounts.set(key, [...(accounts.get(key) ?? []), index]);
  });
  let applies = false;
  for (const indexes of accounts.values()) {
    const pairs = balancePairs(rows, indexes);
    applies ||= pairs.length > 0;
    const broken = brokenPair(pairs, signs);
    if (broken) {
      const { index } = broken.pair;
      return failedRow(rows[index], index, round(broken.expected));
    }
  }
  return applies ? { code: 'balance_chain', passed: true } : null;
}

function failedRow(row: LayoutTransaction, index: number, expected: number): ParseCheck {
  return {
    code: 'balance_chain',
    passed: false,
    detail: { row: index + 1, date: row.dateText, expected, actual: row.balance },
  };
}

/** The rows' sums against the statement's printed money in and money out. */
export function checkPrintedTotals(
  totals: { credits: number | null; debits: number | null },
  transactions: ParsedTransaction[],
): ParseCheck | null {
  const sums = {
    credits: round(transactions.reduce((sum, row) => sum + (row.credit ?? 0), 0)),
    debits: round(transactions.reduce((sum, row) => sum + (row.debit ?? 0), 0)),
  };
  for (const side of ['credits', 'debits'] as const) {
    const printed = totals[side];
    if (printed !== null && !same(printed, sums[side])) {
      return {
        code: 'printed_totals',
        passed: false,
        detail: { side, expected: printed, actual: sums[side] },
      };
    }
  }
  return totals.credits === null && totals.debits === null
    ? null
    : { code: 'printed_totals', passed: true };
}

/** Each section's rows against the totals line that closes it. */
export function checkSectionTotals(
  sections: { sign: 'debit' | 'credit'; printed: number; read: number }[],
): ParseCheck | null {
  const broken = sections.find(section => !same(section.printed, section.read));
  if (broken) {
    return {
      code: 'section_totals',
      passed: false,
      detail: {
        side: broken.sign === 'credit' ? 'credits' : 'debits',
        expected: broken.printed,
        actual: round(broken.read),
      },
    };
  }
  return sections.length > 0 ? { code: 'section_totals', passed: true } : null;
}

/**
 * The opening and closing balances the statement prints beside their labels
 * against those its rows' running balances give. Either side missing leaves
 * nothing to compare.
 */
export function checkPrintedBalances(
  printed: { start: number | null; end: number | null },
  fromRows: { start: number | null; end: number | null },
): ParseCheck | null {
  let applies = false;
  for (const side of ['start', 'end'] as const) {
    const [label, rows] = [printed[side], fromRows[side]];
    if (label === null || rows === null) {
      continue;
    }
    applies = true;
    // A card statement may print what is owed as a plain figure on one side
    // and signed on the other.
    if (!same(Math.abs(label), Math.abs(rows))) {
      return {
        code: 'printed_balances',
        passed: false,
        detail: { side, expected: label, actual: rows },
      };
    }
  }
  return applies ? { code: 'printed_balances', passed: true } : null;
}

/** Rows dated outside the printed period, give or take a few days. */
export function checkDatesInPeriod(
  transactions: ParsedTransaction[],
  period: { from: Date; to: Date } | null,
): ParseCheck | null {
  if (!period || transactions.length === 0) {
    return null;
  }
  const slack = PERIOD_SLACK_DAYS * 24 * 60 * 60 * 1000;
  const index = transactions.findIndex(
    row =>
      row.transactionDate.getTime() < period.from.getTime() - slack ||
      row.transactionDate.getTime() > period.to.getTime() + slack,
  );
  if (index === -1) {
    return { code: 'dates_in_period', passed: true };
  }
  return {
    code: 'dates_in_period',
    passed: false,
    detail: {
      row: index + 1,
      date: transactions[index].transactionDate.toISOString().slice(0, 10),
    },
  };
}
