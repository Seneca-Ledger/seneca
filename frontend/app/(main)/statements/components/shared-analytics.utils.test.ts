import { describe, expect, it } from 'vitest';

import {
  type AggregateSortKey,
  buildPreviousPeriodRange,
  formatDateISO,
  getComparisonDelta,
  parseAmount,
  resolveAmountFlow,
  resolveSourceChannel,
  sortAggregateRows,
} from './shared-analytics.utils';

type AggregateRow = {
  id: string;
  count: number;
  total: number;
  average: number;
};

describe('shared analytics utils', () => {
  it('parses numeric amounts defensively', () => {
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount(-19)).toBe(19);
    expect(parseAmount('oops')).toBe(0);
  });

  it('resolves source channel from source type and file type', () => {
    expect(resolveSourceChannel({ sourceType: 'gmail', fileType: 'gmail' })).toBe('gmail');
    expect(resolveSourceChannel({ sourceType: 'statement', fileType: 'pdf' })).toBe('receipt');
    expect(resolveSourceChannel({ sourceType: 'statement', fileType: 'expense' })).toBe('bank');
  });

  it('marks wallet-synced rows as crypto instead of bank', () => {
    expect(
      resolveSourceChannel({ sourceType: 'statement', fileType: 'expense', isCrypto: true }),
    ).toBe('crypto');
  });

  it('sorts aggregate rows by selected metric', () => {
    const rows: AggregateRow[] = [
      { id: 'a', count: 7, total: 800, average: 114.28 },
      { id: 'b', count: 2, total: 1100, average: 550 },
      { id: 'c', count: 15, total: 900, average: 60 },
    ];

    const sortBy = (key: AggregateSortKey) => sortAggregateRows(rows, key).map(row => row.id);

    expect(sortBy('amount')).toEqual(['b', 'c', 'a']);
    expect(sortBy('average')).toEqual(['b', 'a', 'c']);
    expect(sortBy('operations')).toEqual(['c', 'a', 'b']);
  });

  it('builds previous period range and comparison deltas', () => {
    const range = buildPreviousPeriodRange(
      new Date('2026-02-10T00:00:00.000Z'),
      new Date('2026-02-19T00:00:00.000Z'),
    );

    expect(range?.start.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(range?.end.toISOString()).toBe('2026-02-09T00:00:00.000Z');
    expect(getComparisonDelta(500, 400)).toEqual({ delta: 100, percentage: 25, trend: 'up' });
    expect(getComparisonDelta(400, 500)).toEqual({ delta: -100, percentage: -20, trend: 'down' });
    expect(getComparisonDelta(100, 0)).toEqual({ delta: 100, percentage: 100, trend: 'up' });
  });

  it('resolves statement and gmail flow amounts with configurable expense labels', () => {
    expect(
      resolveAmountFlow({
        sourceType: 'statement',
        debit: 320,
        credit: 0,
        amount: 0,
        transactionType: 'expense',
        expenseFlowType: 'spend',
      }),
    ).toEqual({ flowType: 'spend', amount: 320 });

    expect(
      resolveAmountFlow({
        sourceType: 'statement',
        debit: 0,
        credit: 150,
        amount: 0,
        transactionType: 'income',
        expenseFlowType: 'spend',
      }),
    ).toEqual({ flowType: 'income', amount: 150 });

    expect(
      resolveAmountFlow({
        sourceType: 'gmail',
        amount: 95,
        transactionType: 'income',
        expenseFlowType: 'expense',
      }),
    ).toEqual({ flowType: 'income', amount: 95 });

    expect(
      resolveAmountFlow({
        sourceType: 'gmail',
        amount: 40,
        transactionType: 'expense',
        expenseFlowType: 'spend',
        gmailUsesTransactionType: false,
      }),
    ).toEqual({ flowType: 'spend', amount: 40 });
  });

  it('formats dates as yyyy-mm-dd', () => {
    expect(formatDateISO(new Date('2026-02-19T15:30:00.000Z'))).toBe('2026-02-19');
  });
});
