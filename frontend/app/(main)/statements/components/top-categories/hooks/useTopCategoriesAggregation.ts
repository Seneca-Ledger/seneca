import { useMemo } from 'react';
import {
  buildPreviousPeriodRange,
  getComparisonDelta,
} from '@/app/(main)/statements/components/shared-analytics.utils';
import {
  buildTopCategoriesBarChart,
  buildTopCategoriesSourceChart,
  buildTopCategoriesTrendChart,
} from '@/app/(main)/statements/components/top-categories.chart';
import type {
  CategorySortKey,
  TopCategoryAggregateRow,
  TopCategoryFlowType,
  TopCategoryRecord,
} from '@/app/(main)/statements/components/top-categories.utils';
import {
  createCategoryAggregateRows,
  sortCategoryRows,
} from '@/app/(main)/statements/components/top-categories.utils';
import { getRecordDate, resolveCurrencyCode } from '@/app/lib/analytics-common';
import { useCurrencyConversion } from '@/app/lib/useCurrencyConversion';

type Params = {
  flowFilteredRecords: TopCategoryRecord[];
  flowRecordsWithoutDateFilter: TopCategoryRecord[];
  activeFlowType: TopCategoryFlowType;
  sortKey: CategorySortKey;
  workspaceCurrency: string;
  resolvedTheme: string | undefined;
  sourceStatementLabel: string;
  sourceGmailLabel: string;
  totalIncomeLabel: string;
  totalSpendLabel: string;
};

type Totals = { total: number; statementTotal: number; receiptTotal: number; operations: number };
type PeriodRange = { start: Date; end: Date } | null;

export type TopCategoriesAggregationReturn = {
  sortedAggregatedRows: TopCategoryAggregateRow[];
  totals: Totals;
  comparison: {
    total: ReturnType<typeof getComparisonDelta>;
    statementTotal: ReturnType<typeof getComparisonDelta>;
    receiptTotal: ReturnType<typeof getComparisonDelta>;
    operations: ReturnType<typeof getComparisonDelta>;
  } | null;
  topCategoriesChart: unknown;
  sourceChart: unknown;
  trendChart: unknown;
};

const buildTotals = (records: TopCategoryRecord[]): Totals => ({
  total:
    records.filter(r => r.sourceType === 'statement').reduce((s, r) => s + r.amount, 0) +
    records.filter(r => r.sourceType === 'gmail').reduce((s, r) => s + r.amount, 0),
  statementTotal: records
    .filter(r => r.sourceType === 'statement')
    .reduce((s, r) => s + r.amount, 0),
  receiptTotal: records.filter(r => r.sourceType === 'gmail').reduce((s, r) => s + r.amount, 0),
  operations: records.length,
});

const computeAggregatedRows = (
  records: TopCategoryRecord[],
  workspaceCurrency: string,
): TopCategoryAggregateRow[] => {
  const rows = createCategoryAggregateRows(records);
  return rows.map(row => ({
    ...row,
    currency: resolveCurrencyCode(row.currency, workspaceCurrency),
  }));
};

const computePeriodRange = (records: TopCategoryRecord[]): PeriodRange => {
  const points = records
    .map(r => getRecordDate(r))
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime());
  if (points.length === 0) {
    return null;
  }
  return { start: points[0], end: points[points.length - 1] };
};

const computePreviousTotals = (range: PeriodRange, records: TopCategoryRecord[]): Totals | null => {
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

export const useTopCategoriesAggregation = ({
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
}: Params): TopCategoriesAggregationReturn => {
  const aggregatedRows = useMemo(
    () => computeAggregatedRows(flowFilteredRecords, workspaceCurrency),
    [flowFilteredRecords, workspaceCurrency],
  );
  const sortedAggregatedRows = useMemo(
    () => sortCategoryRows(aggregatedRows, sortKey),
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
  const topCategoriesChart = useMemo(
    () => buildTopCategoriesBarChart(sortedAggregatedRows, resolvedTheme),
    [sortedAggregatedRows, resolvedTheme],
  );
  const sourceChart = useMemo(
    () =>
      buildTopCategoriesSourceChart(totals, {
        sourceStatement: sourceStatementLabel,
        sourceGmail: sourceGmailLabel,
      }),
    [totals, sourceStatementLabel, sourceGmailLabel],
  );
  const trendChart = useMemo(
    () =>
      buildTopCategoriesTrendChart(
        convertedFlowRecords,
        activeFlowType,
        { totalIncome: totalIncomeLabel, totalSpend: totalSpendLabel },
        resolvedTheme,
      ),
    [convertedFlowRecords, activeFlowType, totalIncomeLabel, totalSpendLabel, resolvedTheme],
  );
  return { sortedAggregatedRows, totals, comparison, topCategoriesChart, sourceChart, trendChart };
};
