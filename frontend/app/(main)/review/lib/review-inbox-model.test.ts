import { describe, expect, it } from 'vitest';
import {
  cursorAfterRemoval,
  dateFilterToRange,
  documentHref,
  documentOf,
  groupByDocument,
  groupByPayee,
  monthDateFilter,
  moveCursor,
  type ReviewTransactionItem,
  targetIds,
  toggleSelection,
} from './review-inbox-model';

const tx = (
  id: string,
  counterpartyName: string,
  payee: ReviewTransactionItem['payee'] = null,
): ReviewTransactionItem => ({
  kind: 'transaction',
  id,
  date: '2026-06-01',
  counterpartyName,
  paymentPurpose: '',
  payee,
  amount: 10,
  currency: 'EUR',
  transactionType: 'expense',
  categoryId: null,
  categoryName: null,
  categorySource: null,
  categoryReason: null,
  statementId: null,
  receiptId: null,
  document: null,
});

describe('review inbox model', () => {
  it('opens a row at its receipt, else its statement, the way Documents does', () => {
    const scan = {
      ...tx('a', 'Lidl'),
      document: { source: 'receipt' as const, id: 'r1', fileName: 'scan.jpg', fileType: 'image' },
    };
    const bank = {
      ...tx('b', 'Bank'),
      document: { source: 'statement' as const, id: 's1', fileName: 'bank.pdf', fileType: 'pdf' },
    };
    expect(documentOf(scan)).toEqual(scan.document);
    expect(documentOf(bank)).toEqual(bank.document);
    expect(documentHref(scan.document)).toBe('/storage/receipts/r1?from=review');
    expect(documentHref(bank.document)).toBe('/statements/s1/edit');
    expect(documentOf(tx('c', 'Cash'))).toBeNull();
    expect(
      documentOf({
        kind: 'receipt',
        id: 'r2',
        date: null,
        vendor: null,
        amount: null,
        currency: null,
        issues: [],
      }),
    ).toEqual({ source: 'receipt', id: 'r2', fileName: null, fileType: null });
  });

  it('groups by payee, biggest group first, case-insensitively', () => {
    const groups = groupByPayee([tx('a', '7-Eleven'), tx('b', 'Lidl'), tx('c', '7-eleven')]);
    expect(groups.map(g => [g.payee, g.items.map(i => i.id)])).toEqual([
      ['7-Eleven', ['a', 'c']],
      ['Lidl', ['b']],
    ]);
  });

  it('groups by payee across the descriptors it came in with, under its name', () => {
    const rewe = { id: 'payee-rewe', name: 'REWE' };
    const groups = groupByPayee([
      tx('a', 'REWE SAGT DANKE 6334', rewe),
      tx('b', 'Lidl'),
      tx('c', 'REWE MARKT GMBH', rewe),
    ]);
    expect(groups.map(g => [g.payee, g.items.map(i => i.id)])).toEqual([
      ['REWE', ['a', 'c']],
      ['Lidl', ['b']],
    ]);
  });

  it('moves the cursor inside the list and stops at the ends', () => {
    expect(moveCursor(-1, 1, 3)).toBe(0);
    expect(moveCursor(0, -1, 3)).toBe(0);
    expect(moveCursor(2, 1, 3)).toBe(2);
    expect(moveCursor(-1, -1, 3)).toBe(2);
    expect(moveCursor(1, 1, 0)).toBe(-1);
  });

  it('keeps the cursor on the row that replaced the removed one', () => {
    expect(cursorAfterRemoval(2, 2)).toBe(1);
    expect(cursorAfterRemoval(0, 5)).toBe(0);
    expect(cursorAfterRemoval(3, 0)).toBe(-1);
  });

  it('toggles a selection without mutating the previous set', () => {
    const first = toggleSelection(new Set(), 'a');
    const second = toggleSelection(first, 'a');
    expect([...first]).toEqual(['a']);
    expect(second.size).toBe(0);
  });

  it('acts on the selection, or on the cursor row when nothing is selected', () => {
    const items = [tx('a', 'x'), tx('b', 'y'), tx('c', 'z')];
    expect(targetIds(new Set(['c', 'a']), items, 1)).toEqual(['a', 'c']);
    expect(targetIds(new Set(), items, 1)).toEqual(['b']);
    expect(targetIds(new Set(), items, -1)).toEqual([]);
  });
});

describe('groupByDocument', () => {
  const statement = (id: string) => ({
    source: 'statement' as const,
    id,
    fileName: `${id}.pdf`,
    fileType: 'pdf',
  });
  const onStatement = (id: string, statementId: string, date: string) => ({
    ...tx(id, 'ACME Store'),
    date,
    statementId,
    document: statement(statementId),
  });

  it("keeps a statement's rows together under its newest one, in the page's order", () => {
    const groups = groupByDocument([
      onStatement('a', 'jan', '2026-01-30'),
      tx('manual', 'Corner Bakery'),
      onStatement('b', 'feb', '2026-01-20'),
      onStatement('c', 'jan', '2026-01-10'),
    ]);
    expect(groups.map(g => [g.document?.id ?? null, g.items.map(i => i.id)])).toEqual([
      ['jan', ['a', 'c']],
      [null, ['manual']],
      ['feb', ['b']],
    ]);
  });

  it('leaves receipts and rows without a document on their own', () => {
    const receipt = { source: 'receipt' as const, id: 'r-1', fileName: null, fileType: null };
    const groups = groupByDocument([
      { ...tx('a', 'ACME Store'), document: receipt },
      { ...tx('b', 'ACME Store'), document: receipt },
      tx('c', 'Corner Bakery'),
      tx('d', 'Corner Bakery'),
    ]);
    expect(groups.map(g => g.items.map(i => i.id))).toEqual([['a'], ['b'], ['c'], ['d']]);
  });
});

describe('dateFilterToRange', () => {
  const now = new Date(2026, 9, 4);

  it('is open on both ends without a filter', () => {
    expect(dateFilterToRange(null, now)).toEqual({ from: '', to: '' });
  });

  it('turns a preset into its inclusive days', () => {
    expect(dateFilterToRange({ preset: 'thisMonth' }, now)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(dateFilterToRange({ preset: 'lastMonth' }, now)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(dateFilterToRange({ preset: 'yearToDate' }, now)).toEqual({
      from: '2026-01-01',
      to: '2026-10-04',
    });
  });

  it('keeps "on" a range in either order', () => {
    expect(
      dateFilterToRange({ mode: 'on', date: '2026-09-20', dateTo: '2026-09-10' }, now),
    ).toEqual({ from: '2026-09-10', to: '2026-09-20' });
    expect(dateFilterToRange({ mode: 'on', date: '2026-09-20' }, now)).toEqual({
      from: '2026-09-20',
      to: '2026-09-20',
    });
  });

  it('leaves the day itself out of "after" and "before"', () => {
    expect(dateFilterToRange({ mode: 'after', date: '2026-09-30' }, now)).toEqual({
      from: '2026-10-01',
      to: '',
    });
    expect(dateFilterToRange({ mode: 'before', date: '2026-10-01' }, now)).toEqual({
      from: '',
      to: '2026-09-30',
    });
  });
});

describe('monthDateFilter', () => {
  it('opens a dashboard link on the whole month it names', () => {
    const filter = monthDateFilter('2024-02');
    expect(filter).toEqual({ mode: 'on', date: '2024-02-01', dateTo: '2024-02-29' });
    expect(dateFilterToRange(filter, new Date(2026, 9, 16))).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
  });

  it('opens unfiltered on anything that is not a month', () => {
    expect(monthDateFilter(null)).toBeNull();
    expect(monthDateFilter('2026-13')).toBeNull();
  });
});
