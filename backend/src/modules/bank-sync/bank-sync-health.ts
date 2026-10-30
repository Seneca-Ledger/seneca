import type { BankSyncAccountSetting, BankSyncHealth } from './bank-sync.config';
import type { BankSyncAccount, BankSyncTransaction } from './bank-sync-provider.interface';

/** How far back the first pull of an account reaches. */
const FIRST_SYNC_DAYS = 90;
/** Later pulls start this far before the previous one: posted dates settle late. */
const OVERLAP_DAYS = 7;
/** A balance this old means the provider stopped hearing from the bank. */
const STALE_BALANCE_DAYS = 14;
/** Money differences below this are rounding, not a missing row. */
const DRIFT_EPSILON = 0.01;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the balance gap is new this pull or was already there last time. */
export type DriftState = 'none' | 'new' | 'persisting';

/**
 * The window this account is pulled over. `syncFrom` wins when it is set: a
 * feed that has just moved to another provider must not replay history the
 * wallet already holds.
 */
export function sinceOf(account: BankSyncAccountSetting, now: Date): Date {
  if (account.syncFrom) return new Date(account.syncFrom);
  if (account.lastSyncAt) {
    return new Date(new Date(account.lastSyncAt).getTime() - OVERLAP_DAYS * DAY_MS);
  }
  return new Date(now.getTime() - FIRST_SYNC_DAYS * DAY_MS);
}

/**
 * Compares how far the provider's balance moved against the rows that arrived
 * to explain the move. A gap that is still there on the next pull is a row
 * that never came: the failure that otherwise hides behind a green dot.
 */
export function recordDrift(
  account: BankSyncAccountSetting,
  remote: BankSyncAccount,
  candidates: BankSyncTransaction[],
  now: Date,
): DriftState {
  const carriedOver = account.driftSince !== null;
  const previousBalance = account.balance;
  const previousBalanceDate = account.balanceDate ? new Date(account.balanceDate) : null;
  if (previousBalance === null || remote.balance === null || !previousBalanceDate) {
    account.balanceDrift = null;
    account.driftSince = null;
    return 'none';
  }
  const explained = candidates
    .filter(row => row.posted.getTime() > previousBalanceDate.getTime())
    .reduce((sum, row) => sum + row.amount, 0);
  const drift = Number((remote.balance - previousBalance - explained).toFixed(2));
  if (Math.abs(drift) <= DRIFT_EPSILON) {
    account.balanceDrift = null;
    account.driftSince = null;
    return 'none';
  }
  account.balanceDrift = drift;
  account.driftSince = account.driftSince ?? now.toISOString();
  return carriedOver ? 'persisting' : 'new';
}

export function healthOf(
  account: BankSyncAccountSetting,
  drift: DriftState,
  now: Date,
): BankSyncHealth {
  if (drift === 'persisting') return 'incomplete';
  if (account.balanceDate) {
    const age = now.getTime() - new Date(account.balanceDate).getTime();
    if (age > STALE_BALANCE_DAYS * DAY_MS) return 'stale';
  }
  return 'ok';
}
