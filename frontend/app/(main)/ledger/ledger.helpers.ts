import type { DraftLine, LedgerAccount, TrialBalanceRow } from './ledger.types';

export const LEDGER_TABS = ['accounts', 'journal', 'trial-balance', 'account'] as const;
export type LedgerTab = (typeof LEDGER_TABS)[number];

export function parseTab(value: string | null): LedgerTab {
  return LEDGER_TABS.find(tab => tab === value) ?? 'journal';
}

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isDateOnly(value: string | null | undefined): value is string {
  return typeof value === 'string' && DATE_ONLY.test(value);
}

/** The reports' own default period: 1 January of this year through today. */
export function defaultPeriod(today: Date = new Date()): { dateFrom: string; dateTo: string } {
  const dateTo = today.toISOString().slice(0, 10);
  return { dateFrom: `${dateTo.slice(0, 4)}-01-01`, dateTo };
}

/**
 * Accounts in display order: each header followed by its children, with the
 * depth for indentation. The API already sorts by position and code; this
 * only nests. An account whose parent is missing is shown at the top level.
 */
export function buildAccountTree<T extends Pick<LedgerAccount, 'id' | 'parentId'>>(
  accounts: T[],
): Array<T & { depth: number }> {
  const known = new Set(accounts.map(account => account.id));
  const children = new Map<string | null, T[]>();
  for (const account of accounts) {
    const parent = account.parentId && known.has(account.parentId) ? account.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), account]);
  }
  const out: Array<T & { depth: number }> = [];
  const walk = (parent: string | null, depth: number): void => {
    for (const account of children.get(parent) ?? []) {
      out.push({ ...account, depth });
      if (depth < 10) {
        walk(account.id, depth + 1);
      }
    }
  };
  walk(null, 0);
  return out;
}

/** Trial balance rows come depth-first already; this adds the indentation depth. */
export function withDepth(rows: TrialBalanceRow[]): Array<TrialBalanceRow & { depth: number }> {
  const depthOf = new Map<string, number>();
  return rows.map(row => {
    const depth =
      row.parentId !== null && depthOf.has(row.parentId) ? (depthOf.get(row.parentId) ?? 0) + 1 : 0;
    depthOf.set(row.accountId, depth);
    return { ...row, depth };
  });
}

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;

/** A typed amount in minor units, or null when it is not a positive decimal with up to 2 places. */
export function amountToMinor(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!AMOUNT.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return minor > 0 ? minor : null;
}

/** Normalises what the user typed ("12,5") into what the API accepts ("12.50"). */
export function normaliseAmount(value: string): string {
  const minor = amountToMinor(value);
  return minor === null ? value.trim() : formatMinor(minor);
}

export function formatMinor(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export interface DraftBalance {
  debitMinor: number;
  creditMinor: number;
  differenceMinor: number;
  /** Lines with an account and a valid amount. */
  validLines: number;
  /**
   * False when a line is in another currency: its base amount is only known
   * once the server has converted it, so the local total is not the final word.
   */
  exact: boolean;
}

/** The running difference the form shows while the user types, before anything is saved. */
export function draftBalance(lines: DraftLine[], baseCurrency: string): DraftBalance {
  let debitMinor = 0;
  let creditMinor = 0;
  let validLines = 0;
  let exact = true;
  for (const line of lines) {
    const minor = amountToMinor(line.amount);
    if (minor === null || !line.accountId) {
      continue;
    }
    validLines += 1;
    if (line.currency && line.currency.toUpperCase() !== baseCurrency.toUpperCase()) {
      exact = false;
      continue;
    }
    if (line.side === 'debit') {
      debitMinor += minor;
    } else {
      creditMinor += minor;
    }
  }
  return { debitMinor, creditMinor, differenceMinor: debitMinor - creditMinor, validLines, exact };
}

/**
 * Posting is offered only for a saved draft the server has confirmed balances.
 * Unsaved edits would be posted as they were last saved, which is not what
 * the user is looking at.
 */
export function canPostEntry(state: {
  savedDifference: string | null;
  savedLines: number;
  dirty: boolean;
}): boolean {
  return !state.dirty && state.savedLines >= 2 && state.savedDifference === '0.00';
}

/** System accounts are named by code in the UI's language; the stored English name is the fallback. */
export function accountDisplayName(
  account: Pick<LedgerAccount, 'code' | 'name' | 'isSystem'>,
  systemNames: Record<string, string>,
): string {
  return (account.isSystem && systemNames[account.code]) || account.name;
}

/** Accounts a journal line may book to: postable ones, cash accounts only in their own currency. */
export function postableAccounts(accounts: LedgerAccount[]): LedgerAccount[] {
  return accounts.filter(account => account.isPostable);
}

let lineCounter = 0;
export function newDraftLine(side: DraftLine['side'], currency: string): DraftLine {
  lineCounter += 1;
  return { key: `line-${Date.now()}-${lineCounter}`, accountId: '', side, amount: '', currency };
}

/**
 * Mirrors the server's guard for ledger writes: the global permission, or
 * being an owner or admin of this workspace (who hold no global write
 * permission but manage their own workspace's books).
 */
export function canWriteLedger(
  hasGlobalPermission: boolean,
  memberRole: string | undefined,
): boolean {
  return hasGlobalPermission || memberRole === 'owner' || memberRole === 'admin';
}

/** A draft can be saved once it has a date and every line has an account and a valid amount. */
export function isDraftSavable(entryDate: string, lines: DraftLine[]): boolean {
  return (
    isDateOnly(entryDate) &&
    lines.every(line => line.accountId && amountToMinor(line.amount) !== null)
  );
}
