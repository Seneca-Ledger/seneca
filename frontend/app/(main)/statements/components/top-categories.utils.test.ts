import { describe, expect, it } from 'vitest';

import {
  type TopCategoryAggregateRow,
  type TopCategoryRecord,
  createCategoryAggregateRows,
  dedupeCategoryReceiptRecords,
  resolveCategoryFlow,
  resolveCategoryName,
  sortCategoryRows,
} from './top-categories.utils';

const createRecord = (overrides: Partial<TopCategoryRecord> = {}): TopCategoryRecord => ({
  id: 'record-1',
  source: 'statement',
  fileName: 'Software',
  subject: null,
  sender: null,
  status: 'completed',
  fileType: 'expense',
  createdAt: '2026-02-10T00:00:00Z',
  statementDateFrom: '2026-02-10',
  statementDateTo: null,
  bankName: 'Kaspi',
  totalDebit: 100,
  totalCredit: null,
  currency: 'USD',
  exported: null,
  paid: null,
  parsingDetails: null,
  user: null,
  receivedAt: null,
  parsedData: null,
  sourceType: 'statement',
  sourceChannel: 'bank',
  flowType: 'spend',
  category: 'Software',
  amount: 100,
  currencyValue: 'USD',
  dateValue: '2026-02-10',
  transactionId: null,
  color: '#2563eb',
  icon: null,
  ...overrides,
});

describe('top categories helpers', () => {
  it('resolves category flow for statement and receipt records', () => {
    expect(
      resolveCategoryFlow({
        sourceType: 'statement',
        debit: 320,
        credit: 0,
        amount: 0,
        transactionType: 'expense',
      }),
    ).toEqual({ flowType: 'spend', amount: 320 });

    expect(
      resolveCategoryFlow({
        sourceType: 'statement',
        debit: 0,
        credit: 150,
        amount: 0,
        transactionType: 'income',
      }),
    ).toEqual({ flowType: 'income', amount: 150 });

    expect(
      resolveCategoryFlow({
        sourceType: 'receipt',
        amount: 95,
        transactionType: 'income',
      }),
    ).toEqual({ flowType: 'income', amount: 95 });
  });

  it('normalizes category names and falls back to Uncategorized', () => {
    expect(resolveCategoryName('  Travel  ')).toBe('Travel');
    expect(resolveCategoryName('')).toBe('Uncategorized');
    expect(resolveCategoryName(undefined)).toBe('Uncategorized');
  });

  it('deduplicates receipts already linked to transactions', () => {
    const receipts = [
      createRecord({
        id: 'receipt-1',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        transactionId: 'tx-1',
      }),
      createRecord({
        id: 'receipt-2',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        transactionId: null,
      }),
      createRecord({
        id: 'receipt-3',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        transactionId: 'tx-3',
      }),
    ];

    expect(dedupeCategoryReceiptRecords(receipts, new Set(['tx-1']))).toEqual([
      receipts[1],
      receipts[2],
    ]);
  });

  it('aggregates records by category, source, and flow', () => {
    const rows = createCategoryAggregateRows([
      createRecord({ id: 'a', category: 'Software', amount: 500, dateValue: '2026-02-10' }),
      createRecord({ id: 'b', category: 'software', amount: 300, dateValue: '2026-02-11' }),
      createRecord({
        id: 'c',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        category: 'Software',
        amount: 120,
        dateValue: '2026-02-12',
      }),
      createRecord({
        id: 'd',
        flowType: 'income',
        category: 'Sales',
        amount: 900,
        dateValue: '2026-02-13',
        color: '#16a34a',
      }),
    ]);

    expect(rows).toEqual<TopCategoryAggregateRow[]>([
      {
        id: 'spend:bank:USD:software',
        category: 'Software',
        sourceType: 'statement',
        sourceChannel: 'bank',
        flowType: 'spend',
        count: 2,
        total: 800,
        average: 400,
        lastDate: '2026-02-11',
        currency: 'USD',
        color: '#2563eb',
        icon: null,
      },
      {
        id: 'spend:receipt:USD:software',
        category: 'Software',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        flowType: 'spend',
        count: 1,
        total: 120,
        average: 120,
        lastDate: '2026-02-12',
        currency: 'USD',
        color: '#2563eb',
        icon: null,
      },
      {
        id: 'income:bank:USD:sales',
        category: 'Sales',
        sourceType: 'statement',
        sourceChannel: 'bank',
        flowType: 'income',
        count: 1,
        total: 900,
        average: 900,
        lastDate: '2026-02-13',
        currency: 'USD',
        color: '#16a34a',
        icon: null,
      },
    ]);
  });

  it('sorts aggregate rows by selected metric', () => {
    const rows: TopCategoryAggregateRow[] = [
      {
        id: 'a',
        category: 'A',
        sourceType: 'statement',
        sourceChannel: 'bank',
        flowType: 'spend',
        count: 7,
        total: 800,
        average: 114.28,
        lastDate: '2026-02-10',
        currency: 'EUR',
        color: null,
        icon: null,
      },
      {
        id: 'b',
        category: 'B',
        sourceType: 'statement',
        sourceChannel: 'receipt',
        flowType: 'spend',
        count: 2,
        total: 1100,
        average: 550,
        lastDate: '2026-02-11',
        currency: 'EUR',
        color: null,
        icon: null,
      },
      {
        id: 'c',
        category: 'C',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        flowType: 'spend',
        count: 15,
        total: 900,
        average: 60,
        lastDate: '2026-02-12',
        currency: 'EUR',
        color: null,
        icon: null,
      },
    ];

    expect(sortCategoryRows(rows, 'amount').map(row => row.id)).toEqual(['b', 'c', 'a']);
    expect(sortCategoryRows(rows, 'average').map(row => row.id)).toEqual(['b', 'a', 'c']);
    expect(sortCategoryRows(rows, 'operations').map(row => row.id)).toEqual(['c', 'a', 'b']);
  });
});
