import { useMemo } from 'react';
import {
  buildPreviousPeriodRange,
  getComparisonDelta,
} from '@/app/(main)/statements/components/shared-analytics.utils';
import {
  buildSpendOverTimePeriodsChart,
  buildSpendOverTimeSourceChart,
  buildSpendOverTimeTrendChart,
} from '@/app/(main)/statements/components/spend-over-time.chart';
import type {
  SpendOverTimeFlowType,
  SpendOverTimeGroupBy,
  SpendOverTimePoint,
  SpendOverTimeRecord,
  SpendOverTimeTotals,
} from '@/app/(main)/statements/components/spend-over-time.utils';
import { buildSpendOverTimeReport } from '@/app/(main)/statements/components/spend-over-time.utils';
import { getRecordDate } from '@/app/lib/analytics-common';

type SortKey = 'amount' | 'average' | 'operations';

type Params = {
  flowFilteredRecords: SpendOverTimeRecord[];
  flowRecordsWithoutDateFilter: SpendOverTimeRecord[];
  activeFlowType: SpendOverTimeFlowType;
  groupBy: SpendOverTimeGroupBy;
  viewType: 'calendar' | 'line' | 'bar' | 'stacked';
  sortKey: SortKey;
  workspaceCurrency: string;
  resolvedTheme: string | undefined;
  totalIncomeLabel: string;
  totalSpendLabel: string;
  statementsAmountLabel: string;
  receiptsAmountLabel: string;
};

type PeriodRange = { start: Date; end: Date } | null;

type Comparison = {
  total: ReturnType<typeof getComparisonDelta>;
  statementsAmount: ReturnType<typeof getComparisonDelta>;
  receiptsAmount: ReturnType<typeof getComparisonDelta>;
  operations: ReturnType<typeof getComparisonDelta>;
  avgPerPeriod: ReturnType<typeof getComparisonDelta>;
} | null;

export type SpendOverTimeAggregationReturn = {
  report: ReturnType<typeof buildSpendOverTimeReport>;
  rows: SpendOverTimePoint[];
  comparison: Comparison;
  trendChart: unknown;
  sourceChart: unknown;
  periodsChart: unknown;
};

const sortRows = (rows: SpendOverTimePoint[], sortKey: SortKey): SpendOverTimePoint[] =>
  [...rows].sort((a, b) => {
    if (sortKey === 'average') {
      const aAvg = a.count > 0 ? (a.income + a.expense) / a.count : 0;
      const bAvg = b.count > 0 ? (b.income + b.expense) / b.count : 0;
      return bAvg - aAvg;
    }
    if (sortKey === 'operations') {
      return b.count - a.count;
    }
    return b.income + b.expense - (a.income + a.expense);
  });

const computePeriodRange = (records: SpendOverTimeRecord[]): PeriodRange => {
  const points = records
    .map(r => getRecordDate(r))
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime());
  if (points.length === 0) {
    return null;
  }
  return { start: points[0], end: points[points.length - 1] };
};

const computePreviousTotals = (
  range: PeriodRange,
  records: SpendOverTimeRecord[],
  groupBy: SpendOverTimeGroupBy,
): SpendOverTimeTotals | null => {
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
  return buildSpendOverTimeReport(prevRecords, groupBy).totals;
};

const buildComparison = (
  totals: SpendOverTimeTotals,
  prevTotals: SpendOverTimeTotals,
  activeFlowType: SpendOverTimeFlowType,
): Comparison => ({
  total: getComparisonDelta(
    activeFlowType === 'income' ? totals.income : totals.expense,
    activeFlowType === 'income' ? prevTotals.income : prevTotals.expense,
  ),
  statementsAmount: getComparisonDelta(totals.statementAmount, prevTotals.statementAmount),
  receiptsAmount: getComparisonDelta(totals.gmailAmount, prevTotals.gmailAmount),
  operations: getComparisonDelta(totals.count, prevTotals.count),
  avgPerPeriod: getComparisonDelta(totals.avgPerPeriod, prevTotals.avgPerPeriod),
});

export const useSpendOverTimeAggregation = ({
  flowFilteredRecords,
  flowRecordsWithoutDateFilter,
  activeFlowType,
  groupBy,
  viewType,
  sortKey,
  resolvedTheme,
  totalIncomeLabel,
  totalSpendLabel,
  statementsAmountLabel,
  receiptsAmountLabel,
}: Params): SpendOverTimeAggregationReturn => {
  const report = useMemo(
    () => buildSpendOverTimeReport(flowFilteredRecords, groupBy),
    [flowFilteredRecords, groupBy],
  );
  const rows = useMemo(() => sortRows(report.points, sortKey), [report.points, sortKey]);
  const currentPeriodRange = useMemo(
    () => computePeriodRange(flowFilteredRecords),
    [flowFilteredRecords],
  );
  const previousPeriodTotals = useMemo(
    () => computePreviousTotals(currentPeriodRange, flowRecordsWithoutDateFilter, groupBy),
    [currentPeriodRange, flowRecordsWithoutDateFilter, groupBy],
  );
  const comparison = useMemo(
    () =>
      previousPeriodTotals
        ? buildComparison(report.totals, previousPeriodTotals, activeFlowType)
        : null,
    [report.totals, previousPeriodTotals, activeFlowType],
  );
  const trendChartView = viewType === 'calendar' ? 'line' : viewType;
  const trendChart = useMemo(
    () =>
      buildSpendOverTimeTrendChart(
        report.points,
        trendChartView,
        activeFlowType,
        { totalIncome: totalIncomeLabel, totalSpend: totalSpendLabel },
        resolvedTheme,
      ),
    [
      report.points,
      trendChartView,
      activeFlowType,
      totalIncomeLabel,
      totalSpendLabel,
      resolvedTheme,
    ],
  );
  const sourceChart = useMemo(
    () =>
      buildSpendOverTimeSourceChart(report.totals, {
        statementsAmount: statementsAmountLabel,
        receiptsAmount: receiptsAmountLabel,
      }),
    [report.totals, statementsAmountLabel, receiptsAmountLabel],
  );
  const periodsChart = useMemo(
    () => buildSpendOverTimePeriodsChart(rows, activeFlowType, resolvedTheme),
    [rows, activeFlowType, resolvedTheme],
  );
  return { report, rows, comparison, trendChart, sourceChart, periodsChart };
};
