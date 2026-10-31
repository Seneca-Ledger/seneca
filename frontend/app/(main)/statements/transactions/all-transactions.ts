import type { TransactionListPage, TransactionsOverview } from '@/app/lib/contracts';

export type ListedRow = TransactionListPage['data'][number];
export type OverviewSlice = TransactionsOverview['categories'][number];
export type Direction = 'expense' | 'income' | 'transfer';

/** Slice keys the backend leaves for the page to name. */
export const UNCATEGORIZED_SLICE = '__uncategorized__';
export const NO_ACCOUNT_SLICE = '__no_account__';
export const OTHER_SLICE = '__other__';

/** Past this many slices a pie rolls the smallest up into one "Other". */
const MAX_SLICES = 9;

/** The period the page shows: one month (`YYYY-MM`) or everything. */
export type Period = { kind: 'month'; month: string } | { kind: 'all' };

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `?month=` when valid, else this month; `?all=1` shows everything. */
export function periodFromParams(
  params: { get(name: string): string | null },
  now: Date = new Date(),
): Period {
  if (params.get('all') === '1') {
    return { kind: 'all' };
  }
  const month = params.get('month');
  return { kind: 'month', month: month && MONTH.test(month) ? month : monthOf(now) };
}

export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** First and last day (`YYYY-MM-DD`) of a `YYYY-MM` month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, index] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** A transfer between own accounts reads as one; a reimbursement stays income. */
export function directionOf(row: ListedRow): Direction {
  if (row.transferPairId && (row.transferPairKind ?? 'transfer') === 'transfer') {
    return 'transfer';
  }
  return row.transactionType;
}

/** The signed amount: income up, spending down. */
export function signedAmount(row: ListedRow): number {
  const debit = Number(row.debit ?? 0);
  const credit = Number(row.credit ?? 0);
  if (debit || credit) {
    return credit - debit;
  }
  const amount = Math.abs(Number(row.amount ?? 0));
  return row.transactionType === 'income' ? amount : -amount;
}

/**
 * Where the money came from and went: an expense leaves its wallet for the
 * counterparty, income arrives from the counterparty, and a transfer's other
 * side is the other leg's wallet. Null when nothing names that side.
 */
export function rowSides(row: ListedRow): { source: string | null; destination: string | null } {
  const own = row.wallet?.name?.trim() || null;
  const other =
    (row.transferPairId ? row.transferPairWallet?.name?.trim() : null) ||
    row.counterpartyName?.trim() ||
    null;
  return row.transactionType === 'expense'
    ? { source: own, destination: other }
    : { source: other, destination: own };
}

/** The largest slices as they are, the rest summed into one marked `isOther`. */
export function rollUpSlices(
  slices: readonly OverviewSlice[],
): Array<OverviewSlice & { isOther?: boolean }> {
  if (slices.length <= MAX_SLICES) {
    return [...slices];
  }
  const kept = slices.slice(0, MAX_SLICES - 1);
  const rest = slices.slice(MAX_SLICES - 1).reduce((sum, slice) => sum + slice.value, 0);
  return [...kept, { key: OTHER_SLICE, name: '', value: rest, isOther: true }];
}

/** The payment types the page offers; the backend knows more, the sample statement showed these. */
export const FILTER_PAYMENT_TYPES = ['card', 'bank_transfer_in'] as const;
export type FilterPaymentType = (typeof FILTER_PAYMENT_TYPES)[number];

/** `?paymentType=` when it is one the page offers, else no filter. */
export function paymentTypeFromParams(params: {
  get(name: string): string | null;
}): FilterPaymentType | undefined {
  const value = params.get('paymentType');
  return FILTER_PAYMENT_TYPES.find(type => type === value);
}
