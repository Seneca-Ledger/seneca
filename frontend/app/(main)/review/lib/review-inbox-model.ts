import { addDays, format, isValid, parseISO } from 'date-fns';
import { getPresetRange } from '@/app/(main)/statements/components/filters/statement-filter-internals';
import type { StatementFilterDate } from '@/app/(main)/statements/components/filters/statement-filters';
import type { ReviewInboxItem, ReviewInboxKind } from '@/app/lib/contracts';

/** The queue's rows, one union narrowed by `kind`. */
export type {
  ReviewDuplicateItem,
  ReviewInboxCounts,
  ReviewInboxItem,
  ReviewInboxKind,
  ReviewInboxPage,
  ReviewReceiptItem,
  ReviewSubscriptionItem,
  ReviewTransactionItem,
} from '@/app/lib/contracts';

export const REVIEW_INBOX_KINDS: ReviewInboxKind[] = [
  'transaction',
  'receipt',
  'duplicate',
  'subscription',
];

export function isReviewInboxKind(value: string | null | undefined): value is ReviewInboxKind {
  return REVIEW_INBOX_KINDS.includes(value as ReviewInboxKind);
}

/** The name a row is grouped and bulk-handled by. */
export function payeeOf(item: ReviewInboxItem): string {
  switch (item.kind) {
    case 'transaction':
      return item.payee?.name.trim() || item.counterpartyName.trim() || '—';
    case 'duplicate':
      return item.counterpartyName.trim() || '—';
    case 'receipt':
      return item.vendor?.trim() || '—';
    case 'subscription':
      return item.vendorName.trim() || '—';
  }
}

export interface PayeeGroup<T extends ReviewInboxItem = ReviewInboxItem> {
  payee: string;
  items: T[];
}

/**
 * Groups rows by payee, biggest group first, keeping the page order inside a
 * group. "All 7-Eleven rows → fast food" is one click instead of seven.
 */
export function groupByPayee<T extends ReviewInboxItem>(items: T[]): PayeeGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    // A payee is one group whatever descriptor each of its rows came in with.
    const key =
      item.kind === 'transaction' && item.payee
        ? `payee:${item.payee.id}`
        : payeeOf(item).toLowerCase();
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return [...groups.values()]
    .map(rows => ({ payee: payeeOf(rows[0]), items: rows }))
    .sort((a, b) => b.items.length - a.items.length || a.payee.localeCompare(b.payee));
}

/** Keyboard cursor: clamps inside the list and wraps nothing, so `j` at the end stays put. */
export function moveCursor(current: number, delta: number, length: number): number {
  if (length === 0) return -1;
  const base = current < 0 ? (delta > 0 ? -1 : length) : current;
  return Math.min(length - 1, Math.max(0, base + delta));
}

/** After rows disappear, the cursor lands on the row that took their place. */
export function cursorAfterRemoval(current: number, remainingLength: number): number {
  if (remainingLength === 0) return -1;
  return Math.min(current, remainingLength - 1);
}

export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/** The rows an action applies to: the selection when there is one, else the row under the cursor. */
export function targetIds(
  selected: ReadonlySet<string>,
  items: ReviewInboxItem[],
  cursor: number,
): string[] {
  if (selected.size > 0) {
    return items.filter(item => selected.has(item.id)).map(item => item.id);
  }
  const current = items[cursor];
  return current ? [current.id] : [];
}

const isoDay = (date: Date): string => format(date, 'yyyy-MM-dd');

/**
 * The statements Date dropdown's value as the inclusive `from`/`to` days the
 * review endpoint filters on. "After" and "before" exclude the day itself, the
 * way the statements list applies them.
 */
export function dateFilterToRange(
  filter: StatementFilterDate | null,
  now: Date,
): { from: string; to: string } {
  if (filter?.preset) {
    const { start, end } = getPresetRange(filter.preset, now);
    return { from: isoDay(start), to: isoDay(end) };
  }
  const day = filter?.date ? parseISO(filter.date) : null;
  if (!(day && isValid(day) && filter?.mode)) return { from: '', to: '' };
  if (filter.mode === 'after') return { from: isoDay(addDays(day, 1)), to: '' };
  const dayTo = filter.dateTo ? parseISO(filter.dateTo) : null;
  const end = dayTo && isValid(dayTo) ? dayTo : day;
  if (filter.mode === 'before') return { from: '', to: isoDay(addDays(end, -1)) };
  const [first, last] = day <= end ? [day, end] : [end, day];
  return { from: isoDay(first), to: isoDay(last) };
}
