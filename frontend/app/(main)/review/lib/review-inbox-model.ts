import { addDays, format, isValid, parseISO } from 'date-fns';
import { monthDeepLinkFilters } from '@/app/(main)/statements/components/filters/month-deep-link';
import { getPresetRange } from '@/app/(main)/statements/components/filters/statement-filter-internals';
import type { StatementFilterDate } from '@/app/(main)/statements/components/filters/statement-filters';
import type { ReviewInboxDocument, ReviewInboxItem, ReviewInboxKind } from '@/app/lib/contracts';

/** The queue's rows, one union narrowed by `kind`. */
export type {
  ReviewDuplicateItem,
  ReviewInboxCounts,
  ReviewInboxDocument,
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

/** The file behind a row, shown as its thumbnail and opened by a click on the row. */
export function documentOf(item: ReviewInboxItem): ReviewInboxDocument | null {
  switch (item.kind) {
    case 'transaction':
    case 'duplicate':
      return item.document ?? null;
    case 'receipt':
      return { source: 'receipt', id: item.id, fileName: null, fileType: null };
    case 'subscription':
      return null;
  }
}

/** Where a row's document opens, the way Documents opens it. */
export function documentHref(document: ReviewInboxDocument): string {
  return document.source === 'receipt'
    ? `/storage/receipts/${document.id}?from=review`
    : `/statements/${document.id}/edit`;
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

export interface DocumentGroup<T extends ReviewInboxItem = ReviewInboxItem> {
  /** Set only on a statement's group; every other row stands alone. */
  document: ReviewInboxDocument | null;
  items: T[];
}

/**
 * Rows by the statement they came from, so an import of a hundred rows is one
 * line in the queue. A statement sits where its newest row would, the page's
 * order kept inside it; a receipt or a row of no document stands alone.
 */
export function groupByDocument<T extends ReviewInboxItem>(items: T[]): DocumentGroup<T>[] {
  const groups: DocumentGroup<T>[] = [];
  const byStatement = new Map<string, DocumentGroup<T>>();
  for (const item of items) {
    const document = documentOf(item);
    if (document?.source !== 'statement') {
      groups.push({ document: null, items: [item] });
      continue;
    }
    const group = byStatement.get(document.id);
    if (group) {
      group.items.push(item);
    } else {
      const created = { document, items: [item] };
      byStatement.set(document.id, created);
      groups.push(created);
    }
  }
  return groups;
}

/** A statement with more than one waiting row: one line, its rows in a panel under it. */
export function isFolded(group: DocumentGroup): group is DocumentGroup & {
  document: ReviewInboxDocument;
} {
  return group.document !== null && group.items.length > 1;
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
 * The date filter a link naming a month (`?month=YYYY-MM`, from the dashboard's
 * month close) opens Review with: that whole month, as the dropdown names it.
 */
export function monthDateFilter(month: string | null): StatementFilterDate | null {
  return monthDeepLinkFilters(month)?.date ?? null;
}

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
