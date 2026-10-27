// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_STATEMENT_FILTERS,
  STATEMENT_FILTERS_STORAGE_KEY,
  type StatementFilterItem,
  type StatementFilters,
  applyStatementsFilters,
  loadStatementFilters,
  resetSingleStatementFilter,
  saveStatementFilters,
} from './statement-filters';

const baseStatement: StatementFilterItem = {
  id: 'stmt-1',
  fileName: 'Kaspi February.pdf',
  status: 'uploaded',
  fileType: 'pdf',
  createdAt: '2025-02-01T12:00:00.000Z',
  statementDateFrom: '2025-02-01',
  statementDateTo: '2025-02-10',
  bankName: 'kaspi',
  totalDebit: 1200,
  totalCredit: 0,
  currency: 'KZT',
  exported: false,
  paid: null,
  user: { id: 'user-1', name: 'Alex', email: 'alex@example.com' },
};

const defaultFilters: StatementFilters = {
  type: null,
  statuses: [],
  date: null,
  from: [],
  to: [],
  keywords: '',
  amountMin: null,
  amountMax: null,
  limit: null,
  approved: null,
  billable: null,
  groupBy: null,
  amountView: null,
  has: [],
  currencies: [],
  exported: null,
  paid: null,
};

describe('applyStatementsFilters', () => {
  it('filters by type', () => {
    const statements = [
      baseStatement,
      { ...baseStatement, id: 'stmt-2', fileType: 'csv', fileName: 'Other.csv' },
    ];
    const result = applyStatementsFilters(statements, { ...defaultFilters, type: 'pdf' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('stmt-1');
  });

  it('filters by multiple statuses', () => {
    const statements = [
      { ...baseStatement, id: 'stmt-1', status: 'processing' },
      { ...baseStatement, id: 'stmt-2', status: 'error' },
      { ...baseStatement, id: 'stmt-3', status: 'uploaded' },
    ];
    const result = applyStatementsFilters(statements, {
      ...defaultFilters,
      statuses: ['processing', 'error'],
    });
    expect(result.map(item => item.id)).toEqual(['stmt-1', 'stmt-2']);
  });

  it('filters by date preset', () => {
    const statements = [
      {
        ...baseStatement,
        id: 'stmt-1',
        statementDateFrom: '2025-02-01',
        statementDateTo: '2025-02-10',
        createdAt: '2025-02-10T00:00:00.000Z',
      },
      {
        ...baseStatement,
        id: 'stmt-2',
        statementDateFrom: '2025-01-01',
        statementDateTo: '2025-01-20',
        createdAt: '2025-01-20T00:00:00.000Z',
      },
    ];
    const result = applyStatementsFilters(
      statements,
      { ...defaultFilters, date: { preset: 'thisMonth' } },
      new Date('2025-02-15T00:00:00.000Z'),
    );
    expect(result.map(item => item.id)).toEqual(['stmt-1']);
  });

  it('filters by date condition', () => {
    const statements = [
      {
        ...baseStatement,
        id: 'stmt-1',
        statementDateFrom: '2025-02-01',
        statementDateTo: '2025-02-10',
        createdAt: '2025-02-10T00:00:00.000Z',
      },
      {
        ...baseStatement,
        id: 'stmt-2',
        statementDateFrom: '2025-02-01',
        statementDateTo: '2025-02-05',
        createdAt: '2025-02-05T00:00:00.000Z',
      },
    ];
    const result = applyStatementsFilters(
      statements,
      { ...defaultFilters, date: { mode: 'before', date: '2025-02-08' } },
      new Date('2025-02-15T00:00:00.000Z'),
    );
    expect(result.map(item => item.id)).toEqual(['stmt-2']);
  });

  it('filters by custom on range when dateTo is provided', () => {
    const statements = [
      {
        ...baseStatement,
        id: 'stmt-1',
        statementDateFrom: '2025-02-01',
        statementDateTo: '2025-02-05',
        createdAt: '2025-02-05T00:00:00.000Z',
      },
      {
        ...baseStatement,
        id: 'stmt-2',
        statementDateFrom: '2025-02-01',
        statementDateTo: '2025-02-08',
        createdAt: '2025-02-08T00:00:00.000Z',
      },
      {
        ...baseStatement,
        id: 'stmt-3',
        statementDateFrom: '2025-02-01',
        statementDateTo: '2025-02-12',
        createdAt: '2025-02-12T00:00:00.000Z',
      },
    ];

    const result = applyStatementsFilters(
      statements,
      {
        ...defaultFilters,
        date: { mode: 'on', date: '2025-02-05', dateTo: '2025-02-10' },
      },
      new Date('2025-02-20T00:00:00.000Z'),
    );

    expect(result.map(item => item.id)).toEqual(['stmt-1', 'stmt-2']);
  });

  it('filters by from tokens', () => {
    const statements = [
      { ...baseStatement, id: 'stmt-1', user: { id: 'user-1', name: 'Alex' } },
      { ...baseStatement, id: 'stmt-2', user: { id: 'user-2', name: 'Dana' } },
    ];
    const result = applyStatementsFilters(statements, {
      ...defaultFilters,
      from: ['user:user-2'],
    });
    expect(result.map(item => item.id)).toEqual(['stmt-2']);
  });

  it('filters by keywords and amount range', () => {
    const statements = [
      { ...baseStatement, id: 'stmt-1', fileName: 'Kaspi February.pdf', totalDebit: 1200 },
      { ...baseStatement, id: 'stmt-2', fileName: 'Halyk report.pdf', totalDebit: 5000 },
    ];
    const result = applyStatementsFilters(statements, {
      ...defaultFilters,
      keywords: 'kaspi',
      amountMin: 1000,
      amountMax: 2000,
    });
    expect(result.map(item => item.id)).toEqual(['stmt-1']);
  });

  it('applies limit after filtering', () => {
    const statements = [
      { ...baseStatement, id: 'stmt-1' },
      { ...baseStatement, id: 'stmt-2' },
      { ...baseStatement, id: 'stmt-3' },
    ];
    const result = applyStatementsFilters(statements, {
      ...defaultFilters,
      limit: 2,
    });
    expect(result.map(item => item.id)).toEqual(['stmt-1', 'stmt-2']);
  });

  it('filters by currency and exported flags', () => {
    const statements = [
      { ...baseStatement, id: 'stmt-1', currency: 'KZT', exported: true },
      { ...baseStatement, id: 'stmt-2', currency: 'USD', exported: false },
    ];
    const result = applyStatementsFilters(statements, {
      ...defaultFilters,
      currencies: ['KZT'],
      exported: true,
    });
    expect(result.map(item => item.id)).toEqual(['stmt-1']);
  });

  it('filters by paid flag', () => {
    const statements = [
      { ...baseStatement, id: 'stmt-1', paid: true },
      { ...baseStatement, id: 'stmt-2', paid: false },
    ];
    const result = applyStatementsFilters(statements, {
      ...defaultFilters,
      paid: false,
    });
    expect(result.map(item => item.id)).toEqual(['stmt-2']);
  });

  it('matches emailed receipts by sender and vendor keywords', () => {
    const statements: StatementFilterItem[] = [
      {
        ...baseStatement,
        id: 'imap-1',
        source: 'scan',
        receiptSource: 'imap',
        fileType: 'receipt',
        bankName: 'receipt',
        sender: 'GitHub <noreply@github.com>',
        subject: '[GitHub] Payment Receipt',
        parsedData: {
          vendor: 'GitHub',
          date: '2025-02-11',
        },
      },
      {
        ...baseStatement,
        id: 'imap-2',
        source: 'scan',
        receiptSource: 'imap',
        fileType: 'receipt',
        bankName: 'receipt',
        sender: 'Acme <billing@acme.com>',
        subject: 'Acme invoice',
      },
    ];

    const result = applyStatementsFilters(statements, {
      ...defaultFilters,
      keywords: 'github',
      type: 'receipt',
      from: ['bank:receipt'],
    });

    expect(result.map(item => item.id)).toEqual(['imap-1']);
  });

  it('matches only scanned and uploaded store receipts when type is receipt', () => {
    const statements: StatementFilterItem[] = [
      {
        ...baseStatement,
        id: 'scan-1',
        source: 'scan',
        receiptSource: 'scan',
        fileType: 'image',
        bankName: 'receipt-scan',
        sender: 'camera-scan',
        subject: 'Store receipt',
      },
      {
        ...baseStatement,
        id: 'upload-1',
        source: 'scan',
        receiptSource: 'upload',
        fileType: 'pdf',
        bankName: 'receipt-upload',
        sender: 'manual-upload',
        subject: 'Uploaded store receipt',
      },
      {
        ...baseStatement,
        id: 'statement-1',
        source: 'statement',
        fileType: 'pdf',
        bankName: 'kaspi',
      },
    ];

    const result = applyStatementsFilters(statements, {
      ...defaultFilters,
      type: 'receipt',
    });

    expect(result.map(item => item.id)).toEqual(['scan-1', 'upload-1']);
  });

  it('uses receivedAt as fallback date for receipts', () => {
    const statements: StatementFilterItem[] = [
      {
        ...baseStatement,
        id: 'receipt-1',
        source: 'scan',
        fileType: 'receipt',
        bankName: 'receipt',
        receivedAt: '2025-02-13T00:00:00.000Z',
        statementDateFrom: null,
        statementDateTo: null,
      },
      {
        ...baseStatement,
        id: 'receipt-2',
        source: 'scan',
        fileType: 'receipt',
        bankName: 'receipt',
        receivedAt: '2025-01-15T00:00:00.000Z',
        statementDateFrom: null,
        statementDateTo: null,
      },
    ];

    const result = applyStatementsFilters(
      statements,
      { ...defaultFilters, date: { preset: 'thisMonth' } },
      new Date('2025-02-20T00:00:00.000Z'),
    );

    expect(result.map(item => item.id)).toEqual(['receipt-1']);
  });
});

describe('statement filters storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads defaults when storage is empty', () => {
    const result = loadStatementFilters();
    expect(result).toEqual(DEFAULT_STATEMENT_FILTERS);
  });

  it('loads saved filters from storage', () => {
    const payload = {
      ...DEFAULT_STATEMENT_FILTERS,
      type: 'pdf',
      statuses: ['processing'],
      keywords: 'kaspi',
      amountMin: 500,
    };
    localStorage.setItem(STATEMENT_FILTERS_STORAGE_KEY, JSON.stringify(payload));
    const result = loadStatementFilters();
    expect(result).toEqual(payload);
  });

  it('saves filters to storage', () => {
    saveStatementFilters(defaultFilters);
    expect(localStorage.getItem(STATEMENT_FILTERS_STORAGE_KEY)).toEqual(
      JSON.stringify(defaultFilters),
    );
  });
});

describe('resetSingleStatementFilter', () => {
  it('resets selected field and keeps other draft values', () => {
    const draft: StatementFilters = {
      ...DEFAULT_STATEMENT_FILTERS,
      type: 'pdf',
      statuses: ['processing'],
      from: ['bank:kaspi'],
      keywords: 'invoice',
    };

    const next = resetSingleStatementFilter(draft, 'type');

    expect(next.type).toBeNull();
    expect(next.statuses).toEqual(['processing']);
    expect(next.from).toEqual(['bank:kaspi']);
    expect(next.keywords).toBe('invoice');
  });

  it('resets array fields to defaults', () => {
    const draft: StatementFilters = {
      ...DEFAULT_STATEMENT_FILTERS,
      statuses: ['processing', 'error'],
    };

    const next = resetSingleStatementFilter(draft, 'statuses');

    expect(next.statuses).toEqual([]);
  });
});
