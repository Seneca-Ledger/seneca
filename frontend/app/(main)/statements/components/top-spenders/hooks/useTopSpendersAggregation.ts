import { useMemo } from 'react';
import type {
  AggregateSortKey,
  TopSpenderAggregateRow,
  TopSpenderFlowType,
  TopSpenderRecord,
} from '@/app/(main)/statements/components/top-spenders/top-spenders.types';
import {
  buildTopSpendersBarChart,
  buildTopSpendersSourceChart,
  buildTopSpendersTrendChart,
} from '@/app/(main)/statements/components/top-spenders.chart';
import {
  buildPreviousPeriodRange,
  getComparisonDelta,
  sortAggregateRows,
} from '@/app/(main)/statements/components/top-spenders.utils';
import { getRecordDate, resolveCurrencyCode } from '@/app/lib/analytics-common';
import { useCurrencyConversion } from '@/app/lib/useCurrencyConversion';

type Params = {
  flowFilteredRecords: TopSpenderRecord[];
  flowRecordsWithoutDateFilter: TopSpenderRecord[];
  activeFlowType: TopSpenderFlowType;
  sortKey: AggregateSortKey;
  workspaceCurrency: string;
  resolvedTheme: string | undefined;
  sourceStatementLabel: string;
  sourceGmailLabel: string;
  totalIncomeLabel: string;
  totalSpendLabel: string;
};

type Totals = { total: number; statementTotal: number; receiptTotal: number; operations: number };
type PeriodRange = { start: Date; end: Date } | null;

export type TopSpendersAggregationReturn = {
  sortedAggregatedRows: TopSpenderAggregateRow[];
  totals: Totals;
  comparison: {
    total: ReturnType<typeof getComparisonDelta>;
    statementTotal: ReturnType<typeof getComparisonDelta>;
    receiptTotal: ReturnType<typeof getComparisonDelta>;
    operations: ReturnType<typeof getComparisonDelta>;
  } | null;
  topCompaniesChart: unknown;
  sourceChart: unknown;
  trendChart: unknown;
};

const buildTotals = (records: TopSpenderRecord[]): Totals => ({
  total:
    records.filter(r => r.sourceType === 'statement').reduce((s, r) => s + r.amount, 0) +
    records.filter(r => r.sourceType === 'gmail').reduce((s, r) => s + r.amount, 0),
  statementTotal: records
    .filter(r => r.sourceType === 'statement')
    .reduce((s, r) => s + r.amount, 0),
  receiptTotal: records.filter(r => r.sourceType === 'gmail').reduce((s, r) => s + r.amount, 0),
  operations: records.length,
});

const updateAggregateEntry = (
  existing: TopSpenderAggregateRow,
  record: TopSpenderRecord,
  date: string,
): void => {
  existing.count += 1;
  existing.total += record.amount;
  existing.average = existing.total / existing.count;
  existing.lastDate =
    new Date(date).getTime() > new Date(existing.lastDate || 0).getTime()
      ? date
      : existing.lastDate;
};

const computeAggregatedRows = (
  records: TopSpenderRecord[],
  workspaceCurrency: string,
): TopSpenderAggregateRow[] => {
  const aggregate = new Map<string, TopSpenderAggregateRow>();
  records.forEach(record => {
    const normalizedCompany = (record.company || '').trim() || 'Unknown';
    const recordCurrency = resolveCurrencyCode(record.currencyValue, workspaceCurrency);
    const key = `${record.flowType}:${record.sourceChannel}:${recordCurrency}:${normalizedCompany.toLowerCase()}`;
    const existing = aggregate.get(key);
    const date = record.dateValue || record.createdAt || '';
    if (!existing) {
      aggregate.set(key, {
        id: key,
        company: normalizedCompany,
        sourceType: record.sourceType,
        sourceChannel: record.sourceChannel,
        flowType: record.flowType,
        count: 1,
        total: record.amount,
        average: record.amount,
        lastDate: date,
        currency: recordCurrency,
      });
      return;
    }
    updateAggregateEntry(existing, record, date);
  });
  return Array.from(aggregate.values());
};

const computePeriodRange = (records: TopSpenderRecord[]): PeriodRange => {
  const points = records
    .map(r => getRecordDate(r))
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime());
  if (points.length === 0) {
    return null;
  }
  return { start: points[0], end: points[points.length - 1] };
};

const computePreviousTotals = (range: PeriodRange, records: TopSpenderRecord[]): Totals | null => {
  if (!range) {
    return null;
  }
  const prev = buildPreviousPeriodRange(range.start, range.end);
  if (!prev) {
    return null;
  }
  const prevRecords = records.filter(r => {
    const d = getRecordDate(r);
    return d && d >= prev.start && d <= prev.end;
  });
  return buildTotals(prevRecords);
};

export const useTopSpendersAggregation = ({
  flowFilteredRecords,
  flowRecordsWithoutDateFilter,
  activeFlowType,
  sortKey,
  workspaceCurrency,
  resolvedTheme,
  sourceStatementLabel,
  sourceGmailLabel,
  totalIncomeLabel,
  totalSpendLabel,
}: Params): TopSpendersAggregationReturn => {
  const aggregatedRows = useMemo(
    () => computeAggregatedRows(flowFilteredRecords, workspaceCurrency),
    [flowFilteredRecords, workspaceCurrency],
  );
  const sortedAggregatedRows = useMemo(
    () => sortAggregateRows(aggregatedRows, sortKey),
    [aggregatedRows, sortKey],
  );
  const { convert } = useCurrencyConversion(flowRecordsWithoutDateFilter, workspaceCurrency);
  const convertedFlowRecords = useMemo(
    () => flowFilteredRecords.map(r => ({ ...r, amount: convert(r.amount, r.currencyValue) })),
    [flowFilteredRecords, convert],
  );
  const convertedRecordsWithoutDateFilter = useMemo(
    () =>
      flowRecordsWithoutDateFilter.map(r => ({ ...r, amount: convert(r.amount, r.currencyValue) })),
    [flowRecordsWithoutDateFilter, convert],
  );
  const totals = useMemo(() => buildTotals(convertedFlowRecords), [convertedFlowRecords]);
  const currentPeriodRange = useMemo(
    () => computePeriodRange(convertedFlowRecords),
    [convertedFlowRecords],
  );
  const previousPeriodTotals = useMemo(
    () => computePreviousTotals(currentPeriodRange, convertedRecordsWithoutDateFilter),
    [currentPeriodRange, convertedRecordsWithoutDateFilter],
  );
  const comparison = useMemo(() => {
    if (!previousPeriodTotals) {
      return null;
    }
    return {
      total: getComparisonDelta(totals.total, previousPeriodTotals.total),
      statementTotal: getComparisonDelta(
        totals.statementTotal,
        previousPeriodTotals.statementTotal,
      ),
      receiptTotal: getComparisonDelta(totals.receiptTotal, previousPeriodTotals.receiptTotal),
      operations: getComparisonDelta(totals.operations, previousPeriodTotals.operations),
    };
  }, [totals, previousPeriodTotals]);
  const topCompaniesChart = useMemo(
    () => buildTopSpendersBarChart(sortedAggregatedRows, resolvedTheme),
    [sortedAggregatedRows, resolvedTheme],
  );
  const sourceChart = useMemo(
    () =>
      buildTopSpendersSourceChart(totals, {
        sourceStatement: sourceStatementLabel,
        sourceGmail: sourceGmailLabel,
      }),
    [totals, sourceStatementLabel, sourceGmailLabel],
  );
  const trendChart = useMemo(
    () =>
      buildTopSpendersTrendChart(
        convertedFlowRecords,
        activeFlowType,
        { totalIncome: totalIncomeLabel, totalSpend: totalSpendLabel },
        resolvedTheme,
      ),
    [convertedFlowRecords, activeFlowType, totalIncomeLabel, totalSpendLabel, resolvedTheme],
  );
  return { sortedAggregatedRows, totals, comparison, topCompaniesChart, sourceChart, trendChart };
};
