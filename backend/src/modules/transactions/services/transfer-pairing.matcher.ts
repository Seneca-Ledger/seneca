import { type Transaction, TransactionType } from '../../../entities/transaction.entity';

/** The subset of a transaction row the matcher reads. */
export type TransferLeg = Pick<
  Transaction,
  | 'id'
  | 'transactionDate'
  | 'transactionType'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'currency'
  | 'statementId'
  | 'walletId'
  | 'cryptoWalletId'
> & { statement?: { accountNumber?: string | null } | null };

export interface TransferPair<T extends TransferLeg = TransferLeg> {
  outgoing: T;
  incoming: T;
}

/** Rate from one currency to another on a date, or null when none is known. */
export type RateLookup = (from: string, to: string, date: Date) => Promise<number | null>;

/** How many days apart the two legs may be booked. */
export const TRANSFER_DATE_WINDOW_DAYS = 3;
/** Cross-currency legs may differ by this fraction after conversion (spread, fees). */
export const TRANSFER_FX_TOLERANCE = 0.02;

const DAY_MS = 24 * 60 * 60 * 1000;

export function absAmount(leg: TransferLeg): number {
  return Math.abs(Number(leg.amount) || Number(leg.debit) || Number(leg.credit) || 0);
}

/**
 * Which account a row belongs to. Null means "unknown": a manual entry with
 * no statement cannot be told apart from any other, so it never pairs
 * automatically. `walletId` is deliberately not a signal: classification
 * assigns the workspace's default wallet to every row that has no rule, so
 * it would make two different bank accounts look like one.
 */
export function accountKey(leg: TransferLeg): string | null {
  if (leg.cryptoWalletId) return `crypto:${leg.cryptoWalletId}`;
  const accountNumber = leg.statement?.accountNumber?.trim();
  if (accountNumber) return `account:${accountNumber}`;
  if (leg.statementId) return `statement:${leg.statementId}`;
  return null;
}

export function daysBetween(a: Date | string, b: Date | string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY_MS;
}

function isCrypto(leg: TransferLeg): boolean {
  return Boolean(leg.cryptoWalletId);
}

function normalizeCurrency(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase();
}

/**
 * Whether two legs carry the same money: equal to the cent in one currency,
 * within `TRANSFER_FX_TOLERANCE` after conversion across currencies. Without a
 * rate the legs do not match: a silent 1:1 guess would pair unrelated rows.
 */
export async function amountsMatch(
  outgoing: TransferLeg,
  incoming: TransferLeg,
  lookupRate: RateLookup,
): Promise<boolean> {
  const out = absAmount(outgoing);
  const inc = absAmount(incoming);
  if (out <= 0 || inc <= 0) return false;

  const from = normalizeCurrency(outgoing.currency);
  const to = normalizeCurrency(incoming.currency);
  if (from === to) {
    // One leg on a chain means the two sides went through a conversion: the card
    // was charged in euro, the wallet received a coin booked at the day's price.
    // The spread and the exchange's cut land between them, so the cent-exact rule
    // that fits two bank accounts would never pair a real purchase.
    const tolerance = isCrypto(outgoing) !== isCrypto(incoming) ? TRANSFER_FX_TOLERANCE : 0;
    return tolerance === 0
      ? Math.abs(out - inc) < 0.005
      : Math.abs(out - inc) / Math.max(out, inc) <= tolerance;
  }

  const rate = await lookupRate(from, to, new Date(outgoing.transactionDate));
  if (rate === null || rate <= 0) return false;
  return Math.abs(out * rate - inc) / inc <= TRANSFER_FX_TOLERANCE;
}

function isOppositeDirection(a: TransferLeg, b: TransferLeg): boolean {
  return (
    (a.transactionType === TransactionType.EXPENSE &&
      b.transactionType === TransactionType.INCOME) ||
    (a.transactionType === TransactionType.INCOME && b.transactionType === TransactionType.EXPENSE)
  );
}

function isDifferentAccount(a: TransferLeg, b: TransferLeg): boolean {
  const keyA = accountKey(a);
  const keyB = accountKey(b);
  return keyA !== null && keyB !== null && keyA !== keyB;
}

function sortKey(leg: TransferLeg): string {
  return `${new Date(leg.transactionDate).toISOString()}|${leg.id}`;
}

/**
 * Pairs each row in `toCheck` with its counterpart in `pool` when, and only
 * when, exactly one row qualifies: opposite direction, a different account,
 * within the date window, same money. Two qualifying rows mean the matcher
 * cannot tell which one is the transfer, so it pairs neither — a wrong pair
 * silently hides real spending, a missing one is visible and fixable by hand.
 *
 * `pool` may include the rows of `toCheck`; a row is used at most once.
 */
export async function matchTransferPairs<T extends TransferLeg>(
  toCheck: T[],
  pool: T[],
  lookupRate: RateLookup,
): Promise<TransferPair<T>[]> {
  const pairs: TransferPair<T>[] = [];
  const used = new Set<string>();
  const ordered = [...toCheck].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  for (const row of ordered) {
    if (used.has(row.id)) continue;

    const candidates = pool.filter(
      other =>
        other.id !== row.id &&
        !used.has(other.id) &&
        isOppositeDirection(row, other) &&
        isDifferentAccount(row, other) &&
        daysBetween(row.transactionDate, other.transactionDate) <= TRANSFER_DATE_WINDOW_DAYS,
    );

    const matches: T[] = [];
    for (const candidate of candidates) {
      const outgoing = row.transactionType === TransactionType.EXPENSE ? row : candidate;
      const incoming = outgoing === row ? candidate : row;
      if (await amountsMatch(outgoing, incoming, lookupRate)) {
        matches.push(candidate);
        if (matches.length > 1) break;
      }
    }

    if (matches.length !== 1) continue;

    const match = matches[0];
    const outgoing = row.transactionType === TransactionType.EXPENSE ? row : match;
    const incoming = outgoing === row ? match : row;
    pairs.push({ outgoing, incoming });
    used.add(row.id);
    used.add(match.id);
  }

  return pairs;
}
