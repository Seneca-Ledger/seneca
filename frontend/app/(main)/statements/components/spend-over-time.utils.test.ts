import { describe, expect, it } from 'vitest';

import {
  type SpendOverTimeRecord,
  buildSpendOverTimeReport,
  buildSpendOverTimeSelectedPoint,
  dedupeSpendOverTimeReceiptRecords,
  filterSpendOverTimeDrillDownRecords,
  resolveSpendOverTimeFlow,
} from './spend-over-time.utils';

const createRecord = (overrides: Partial<SpendOverTimeRecord> = {}): SpendOverTimeRecord => ({
  id: 'record-1',
  source: 'statement',
  fileName: 'Anthropic',
  subject: null,
  sender: null,
  status: 'completed',
  fileType: 'expense',
  createdAt: '2026-01-10T00:00:00Z',
  statementDateFrom: '2026-01-10',
  statementDateTo: null,
  bankName: 'Kaspi',
  totalDebit: 120,
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
  flowType: 'expense',
  amount: 120,
  currencyValue: 'USD',
  dateValue: '2026-01-10T00:00:00Z',
  transactionId: 'tx-1',
  workspaceId: 'ws-1',
  workspaceName: 'Main workspace',
  merchant: 'Anthropic',
  paymentPurpose: 'Claude subscription',
  ...overrides,
});

describe('spend over time helpers', () => {
  it('resolves statement and receipt flow values', () => {
    expect(
      resolveSpendOverTimeFlow({
        sourceType: 'statement',
        debit: 320,
        credit: 0,
        amount: 0,
        transactionType: 'expense',
      }),
    ).toEqual({ flowType: 'expense', amount: 320 });

    expect(
      resolveSpendOverTimeFlow({
        sourceType: 'statement',
        debit: 0,
        credit: 150,
        amount: 0,
        transactionType: 'income',
      }),
    ).toEqual({ flowType: 'income', amount: 150 });

    expect(
      resolveSpendOverTimeFlow({
        sourceType: 'receipt',
        amount: 95,
        transactionType: 'income',
      }),
    ).toEqual({ flowType: 'income', amount: 95 });
  });

  it('deduplicates receipts already linked to imported transactions', () => {
    const receipts = [
      createRecord({
        id: 'receipt-1',
        source: 'scan',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        transactionId: 'tx-1',
      }),
      createRecord({
        id: 'receipt-2',
        source: 'scan',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        transactionId: null,
      }),
      createRecord({
        id: 'receipt-3',
        source: 'scan',
        sourceType: 'receipt',
        sourceChannel: 'receipt',
        transactionId: 'tx-3',
      }),
    ];

    expect(dedupeSpendOverTimeReceiptRecords(receipts, new Set(['tx-1']))).toEqual([
      receipts[1],
      receipts[2],
    ]);
  });

  it('builds grouped report points with totals and source split', () => {
    const report = buildSpendOverTimeReport(
      [
        createRecord({
          id: 'statement-expense-jan',
          sourceType: 'statement',
          sourceChannel: 'bank',
          flowType: 'expense',
          amount: 120,
          dateValue: '2026-01-10T00:00:00Z',
          transactionId: 'tx-1',
        }),
        createRecord({
          id: 'receipt-expense-jan',
          source: 'scan',
          sourceType: 'receipt',
          sourceChannel: 'receipt',
          flowType: 'expense',
          amount: 45,
          dateValue: '2026-01-12T00:00:00Z',
          transactionId: null,
        }),
        createRecord({
          id: 'statement-income-feb',
          fileType: 'income',
          sourceType: 'statement',
          sourceChannel: 'bank',
          flowType: 'income',
          amount: 310,
          totalDebit: null,
          totalCredit: 310,
          dateValue: '2026-02-04T00:00:00Z',
          transactionId: 'tx-2',
        }),
      ],
      'month',
    );

    expect(report.points).toMatchObject([
      {
        period: '2026-01',
        label: 'Jan 2026',
        income: 0,
        expense: 165,
        net: -165,
        count: 2,
        statementAmount: 120,
        receiptAmount: 45,
      },
      {
        period: '2026-02',
        label: 'Feb 2026',
        income: 310,
        expense: 0,
        net: 310,
        count: 1,
        statementAmount: 310,
        receiptAmount: 0,
      },
    ]);

    expect(report.totals).toEqual({
      income: 310,
      expense: 165,
      net: 145,
      count: 3,
      avgPerPeriod: 237.5,
      statementAmount: 430,
      receiptAmount: 45,
    });
  });

  it('supports week, quarter, and year groupings', () => {
    const records = [
      createRecord({ id: 'a', dateValue: '2026-01-02T00:00:00Z' }),
      createRecord({ id: 'b', dateValue: '2026-01-08T00:00:00Z' }),
      createRecord({ id: 'c', dateValue: '2026-05-11T00:00:00Z' }),
      createRecord({ id: 'd', dateValue: '2027-03-01T00:00:00Z' }),
    ];

    expect(buildSpendOverTimeReport(records, 'week').points.map(point => point.period)).toEqual([
      '2025-12-29',
      '2026-01-05',
      '2026-05-11',
      '2027-03-01',
    ]);

    expect(buildSpendOverTimeReport(records, 'quarter').points.map(point => point.period)).toEqual([
      '2026-Q1',
      '2026-Q2',
      '2027-Q1',
    ]);

    expect(buildSpendOverTimeReport(records, 'year').points.map(point => point.period)).toEqual([
      '2026',
      '2027',
    ]);
  });

  it('returns all drill-down operations for a clicked calendar day', () => {
    const records = [
      createRecord({ id: 'tx-1', merchant: 'Peakford Ltd', dateValue: '2026-04-09', amount: 15 }),
      createRecord({
        id: 'tx-2',
        merchant: 'Kaspi',
        dateValue: '2026-04-09T18:30:00.000Z',
        amount: 42,
      }),
      createRecord({ id: 'tx-3', merchant: 'Other day', dateValue: '2026-04-10', amount: 9 }),
    ];

    const drillDownRecords = filterSpendOverTimeDrillDownRecords('2026-04-09', 'day', records);
    const selectedPoint = buildSpendOverTimeSelectedPoint('2026-04-09', drillDownRecords);

    expect(drillDownRecords.map(record => record.merchant)).toEqual(['Peakford Ltd', 'Kaspi']);
    expect(selectedPoint).toMatchObject({
      period: '2026-04-09',
      label: '2026-04-09',
      expense: 57,
      count: 2,
      statementAmount: 57,
    });
  });
});
