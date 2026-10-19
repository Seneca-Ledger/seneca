import { beforeEach, describe, expect, it } from 'vitest';
import {
  COLUMN_FILTER_MAP,
  DEFAULT_STATEMENT_COLUMNS,
  STATEMENT_COLUMNS_STORAGE_KEY,
  type StatementColumn,
  getAllowedStatementFilterKeys,
  loadStatementColumns,
  reorderStatementColumns,
  saveStatementColumns,
} from './statement-columns';

describe('statement column storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when storage is empty', () => {
    const result = loadStatementColumns();
    expect(result).toEqual(DEFAULT_STATEMENT_COLUMNS);
  });

  it('merges stored columns with defaults', () => {
    const stored = [
      { id: 'amount', visible: false, order: 0 },
      { id: 'merchant', visible: true, order: 1 },
    ];
    localStorage.setItem(STATEMENT_COLUMNS_STORAGE_KEY, JSON.stringify(stored));

    const result = loadStatementColumns();
    const amount = result.find((column: StatementColumn) => column.id === 'amount');
    const receipt = result.find((column: StatementColumn) => column.id === 'receipt');

    expect(amount?.visible).toBe(false);
    expect(receipt).toBeTruthy();
    expect(result.map((column: StatementColumn) => column.id)).toContain('merchant');
  });

  it('saves columns to storage', () => {
    saveStatementColumns(DEFAULT_STATEMENT_COLUMNS);
    const stored = localStorage.getItem(STATEMENT_COLUMNS_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored || '[]')).toEqual(DEFAULT_STATEMENT_COLUMNS);
  });

  it('reorders columns and updates order values', () => {
    const columns = [
      { id: 'receipt', label: 'Receipt', visible: true, order: 0 },
      { id: 'merchant', label: 'Merchant', visible: true, order: 1 },
      { id: 'amount', label: 'Amount', visible: true, order: 2 },
    ] as StatementColumn[];

    const result = reorderStatementColumns(columns, 'amount', 'receipt');

    expect(result.map((column: StatementColumn) => column.id)).toEqual([
      'amount',
      'receipt',
      'merchant',
    ]);
    expect(result.map((column: StatementColumn) => column.order)).toEqual([0, 1, 2]);
  });

  it('returns original array when drag target is the same column', () => {
    const columns = [
      { id: 'receipt', label: 'Receipt', visible: true, order: 0 },
      { id: 'merchant', label: 'Merchant', visible: true, order: 1 },
    ] as StatementColumn[];

    const result = reorderStatementColumns(columns, 'merchant', 'merchant');

    expect(result).toBe(columns);
  });

  it('returns original array when drop target is missing', () => {
    const columns = [
      { id: 'receipt', label: 'Receipt', visible: true, order: 0 },
      { id: 'merchant', label: 'Merchant', visible: true, order: 1 },
    ] as StatementColumn[];

    const result = reorderStatementColumns(columns, 'merchant', 'amount');

    expect(result).toBe(columns);
  });

  it('maps visible columns to allowed filter keys', () => {
    const result = getAllowedStatementFilterKeys(['amount', 'approved']);

    expect(result).toEqual([
      'amountMax',
      'amountMin',
      'approved',
      'date',
      'exported',
      'groupBy',
      'has',
      'keywords',
      'limit',
      'paid',
      'statuses',
      'type',
    ]);
  });

  it('exposes column filter mapping for optional filters only', () => {
    expect(COLUMN_FILTER_MAP.amount).toEqual(['amountMin', 'amountMax']);
    expect(COLUMN_FILTER_MAP.approved).toEqual(['approved']);
    expect(COLUMN_FILTER_MAP.exported).toEqual(['exported']);
    expect(COLUMN_FILTER_MAP.receipt).toEqual(['type', 'statuses']);
  });
});
