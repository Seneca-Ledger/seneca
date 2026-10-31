import { hasChosenCategory } from '@/app/components/categories/NoCategoryBadge';
import { isSuggestion } from '@/app/lib/category-suggestion';
import type { Transaction } from '../editHelpers';

/** A row still waiting for a category: none at all, or the workspace's fallback. */
export function needsCategory(tx: Transaction): boolean {
  return !hasChosenCategory(tx.category?.name);
}

/**
 * The payee a row belongs to, or null. A row has none when the bank printed
 * only the kind of operation ("POS Purchase", "Direct Debit"): those rows are
 * different shops, never one group, and a pick on one does not spread.
 */
export function payeeKeyOfRow(tx: Transaction): string | null {
  return tx.payee?.id ?? null;
}

/** Rows with no payee to group them by, still waiting for a decision. */
export function unnamedRows(transactions: Transaction[]): Transaction[] {
  return transactions.filter(
    row => payeeKeyOfRow(row) === null && (needsCategory(row) || isSuggestion(row)),
  );
}

/**
 * The other rows of the same payee nobody decided yet: no category, or only a
 * suggested one. A person's pick beats a guess.
 */
export function sameUnfiledPayeeRows(transactions: Transaction[], tx: Transaction): Transaction[] {
  const key = payeeKeyOfRow(tx);
  if (key === null) {
    return [];
  }
  return transactions.filter(
    row =>
      row.id !== tx.id && payeeKeyOfRow(row) === key && (needsCategory(row) || isSuggestion(row)),
  );
}

/**
 * The statement's main action. While rows carry suggestions it accepts them:
 * confirming a row keeps its category, so "Confirm all" is "accept them all".
 */
export function confirmButtonLabel(
  transactions: Transaction[],
  labels: Record<string, { value?: string } | undefined>,
): string {
  const count = transactions.filter(isSuggestion).length;
  return count > 0
    ? (labels.acceptSuggestions?.value ?? 'Accept all suggestions ({count})').replace(
        '{count}',
        String(count),
      )
    : (labels.confirmAll?.value ?? 'Confirm all');
}

/** The category the drawer ticks: the one every row shares, else none. */
export function sharedCategoryId(rows: Transaction[]): string {
  const ids = new Set(rows.map(row => row.categoryId ?? ''));
  return ids.size === 1 ? ([...ids][0] ?? '') : '';
}

export type PayeeGroup = {
  key: string;
  name: string;
  rows: Transaction[];
  /** Signed: income adds, spending subtracts. */
  total: number;
  /** How many of the rows still wait for a category. */
  unfiled: number;
  /** How many carry a suggested category nobody accepted yet. */
  suggested: number;
  /** The category every row shares, when they all share one someone chose. */
  category: Transaction['category'] | null;
};

function signedAmount(tx: Transaction): number {
  return (Number(tx.credit) || 0) - (Number(tx.debit) || 0);
}

/**
 * A statement's rows by payee (rows without one are left out: see unnamedRows):
 * the payees still to file first, then the ones
 * with suggestions to check, each by the most rows and the most money, so a few
 * picks file most of the rows.
 */
export function groupByPayee(transactions: Transaction[]): PayeeGroup[] {
  const groups = new Map<string, PayeeGroup>();
  for (const tx of transactions) {
    const key = payeeKeyOfRow(tx);
    if (key === null) {
      continue;
    }
    const group = groups.get(key) ?? {
      key,
      name: tx.payee?.name ?? tx.counterpartyName,
      rows: [],
      total: 0,
      unfiled: 0,
      suggested: 0,
      category: null,
    };
    group.rows.push(tx);
    group.total += signedAmount(tx);
    group.unfiled += needsCategory(tx) ? 1 : 0;
    group.suggested += !needsCategory(tx) && isSuggestion(tx) ? 1 : 0;
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const first = group.rows[0]?.category;
    const shared = group.unfiled === 0 && group.rows.every(row => row.category?.id === first?.id);
    group.category = shared ? (first ?? null) : null;
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.unfiled > 0) - Number(a.unfiled > 0) ||
      Number(b.suggested > 0) - Number(a.suggested > 0) ||
      b.rows.length - a.rows.length ||
      Math.abs(b.total) - Math.abs(a.total),
  );
}
