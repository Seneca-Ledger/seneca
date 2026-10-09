import { describe, expect, it } from 'vitest';
import {
  cursorAfterRemoval,
  dateFilterToRange,
  groupByPayee,
  moveCursor,
  type ReviewTransactionItem,
  targetIds,
  toggleSelection,
} from './review-inbox-model';

const tx = (id: string, counterpartyName: string): ReviewTransactionItem => ({
  kind: 'transaction',
  id,
  date: '2026-06-01',
  counterpartyName,
  paymentPurpose: '',
  amount: 10,
  currency: 'EUR',
  transactionType: 'expense',
  categoryId: null,
  categoryName: null,
  categorySource: null,
  categoryReason: null,
  statementId: null,
  receiptId: null,
});

describe('review inbox model', () => {
  it('groups by payee, biggest group first, case-insensitively', () => {
    const groups = groupByPayee([tx('a', '7-Eleven'), tx('b', 'Lidl'), tx('c', '7-eleven')]);
    expect(groups.map(g => [g.payee, g.items.map(i => i.id)])).toEqual([
      ['7-Eleven', ['a', 'c']],
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
