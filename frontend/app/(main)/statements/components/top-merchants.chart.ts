import type { TopMerchantAggregateRow, TopMerchantFlowType } from './top-merchants.utils';

type TrendPoint = { dateValue: string; createdAt?: string | null; amount: number };

type SourceTotals = { statementTotal: number; receiptTotal: number };

export function buildTopMerchantsBarChart(
  sortedRows: TopMerchantAggregateRow[],
  resolvedTheme: string | undefined,
  // Privacy mode: the canvas is out of reach of the CSS redaction, so the value axis drops its figures.
  privacy = false,
): unknown {
  const top = sortedRows.slice(0, 12).reverse();
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 20, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { show: !privacy } },
    yAxis: {
      type: 'category',
      data: top.map(item => item.merchant),
    },
    series: [
      {
        type: 'bar',
        data: top.map(item => Number(item.total.toFixed(2))),
        itemStyle: {
          color: resolvedTheme === 'dark' ? '#38BDF8' : '#0EA5E9',
          borderRadius: [0, 0, 0, 0],
        },
      },
    ],
  };
}

export function buildTopMerchantsSourceChart(
  totals: SourceTotals,
  labels: { sourceStatement: string; sourceReceipt: string },
): unknown {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { top: 'bottom' },
    series: [
      {
        type: 'pie',
        radius: ['35%', '72%'],
        data: [
          { name: labels.sourceStatement, value: Number(totals.statementTotal.toFixed(2)) },
          { name: labels.sourceReceipt, value: Number(totals.receiptTotal.toFixed(2)) },
        ],
      },
    ],
  };
}

export function buildTopMerchantsTrendChart(
  records: TrendPoint[],
  activeFlowType: TopMerchantFlowType,
  labels: { totalIncome: string; totalSpend: string },
  resolvedTheme: string | undefined,
  privacy = false,
): unknown {
  const points = new Map<string, number>();
  records.forEach(record => {
    const rawDate = record.dateValue || record.createdAt || '';
    if (!rawDate) {
      return;
    }
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const dateKey = parsed.toISOString().split('T')[0];
    points.set(dateKey, (points.get(dateKey) || 0) + record.amount);
  });

  const sorted = Array.from(points.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 30, right: 30, bottom: 30, top: 30 },
    xAxis: { type: 'category', data: sorted.map(point => point.date) },
    yAxis: { type: 'value', axisLabel: { show: !privacy } },
    series: [
      {
        name: activeFlowType === 'income' ? labels.totalIncome : labels.totalSpend,
        type: 'line',
        smooth: true,
        data: sorted.map(point => Number(point.amount.toFixed(2))),
        areaStyle: {
          color: resolvedTheme === 'dark' ? 'rgba(56,189,248,0.16)' : 'rgba(14,165,233,0.14)',
        },
        lineStyle: { color: resolvedTheme === 'dark' ? '#38BDF8' : '#0EA5E9' },
        itemStyle: { color: resolvedTheme === 'dark' ? '#38BDF8' : '#0EA5E9' },
      },
    ],
  };
}
