import type { SpendOverTimeFlowType, SpendOverTimePoint } from './spend-over-time.utils';

type ViewType = 'bar' | 'line' | 'stacked';

type TrendChartRow = { label: string; income: number; expense: number };

type SourceChartTotals = { statementAmount: number; receiptAmount: number };

export function buildSpendOverTimeTrendChart(
  points: SpendOverTimePoint[],
  viewType: ViewType,
  activeFlowType: SpendOverTimeFlowType,
  labels: { totalIncome: string; totalSpend: string },
  resolvedTheme: string | undefined,
  // Privacy mode: the canvas is out of reach of the CSS redaction, so the value axes drop their figures.
  privacy = false,
): unknown {
  const labelsList = points.map(point => point.label);

  if (viewType === 'stacked') {
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { top: 0 },
      grid: { left: 30, right: 30, bottom: 30, top: 38 },
      xAxis: { type: 'category', data: labelsList },
      yAxis: { type: 'value', axisLabel: { show: !privacy } },
      series: [
        {
          name: labels.totalIncome,
          type: 'bar',
          stack: 'flow',
          data: points.map(point => Number(point.income.toFixed(2))),
          itemStyle: {
            color: resolvedTheme === 'dark' ? '#4ade80' : '#16a34a',
            borderRadius: [0, 0, 0, 0],
          },
        },
        {
          name: labels.totalSpend,
          type: 'bar',
          stack: 'flow',
          data: points.map(point => Number(point.expense.toFixed(2))),
          itemStyle: {
            color: resolvedTheme === 'dark' ? '#f87171' : '#dc2626',
            borderRadius: [0, 0, 0, 0],
          },
        },
      ],
    };
  }

  const values = points.map(point =>
    Number((activeFlowType === 'income' ? point.income : point.expense).toFixed(2)),
  );
  const color = activeFlowType === 'income' ? '#16a34a' : '#dc2626';
  const darkColor = activeFlowType === 'income' ? '#4ade80' : '#f87171';

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 30, right: 30, bottom: 30, top: 30 },
    xAxis: { type: 'category', data: labelsList },
    yAxis: { type: 'value', axisLabel: { show: !privacy } },
    series: [
      viewType === 'bar'
        ? {
            name: activeFlowType === 'income' ? labels.totalIncome : labels.totalSpend,
            type: 'bar',
            data: values,
            barWidth: 24,
            itemStyle: {
              color: resolvedTheme === 'dark' ? darkColor : color,
              borderRadius: [0, 0, 0, 0],
            },
          }
        : {
            name: activeFlowType === 'income' ? labels.totalIncome : labels.totalSpend,
            type: 'line',
            smooth: true,
            data: values,
            areaStyle: {
              color:
                activeFlowType === 'income'
                  ? resolvedTheme === 'dark'
                    ? 'rgba(74,222,128,0.18)'
                    : 'rgba(22,163,74,0.14)'
                  : resolvedTheme === 'dark'
                    ? 'rgba(248,113,113,0.18)'
                    : 'rgba(220,38,38,0.12)',
            },
            lineStyle: { color: resolvedTheme === 'dark' ? darkColor : color },
            itemStyle: { color: resolvedTheme === 'dark' ? darkColor : color },
          },
    ],
  };
}

export function buildSpendOverTimeSourceChart(
  totals: SourceChartTotals,
  labels: { statementsAmount: string; receiptsAmount: string },
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
          { name: labels.statementsAmount, value: Number(totals.statementAmount.toFixed(2)) },
          { name: labels.receiptsAmount, value: Number(totals.receiptAmount.toFixed(2)) },
        ],
      },
    ],
  };
}

export function buildSpendOverTimePeriodsChart(
  rows: TrendChartRow[],
  activeFlowType: SpendOverTimeFlowType,
  resolvedTheme: string | undefined,
  privacy = false,
): unknown {
  const top = rows.slice(0, 12).reverse();
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 20, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { show: !privacy } },
    yAxis: {
      type: 'category',
      data: top.map(item => item.label),
    },
    series: [
      {
        type: 'bar',
        data: top.map(item => ({
          value: Number((activeFlowType === 'income' ? item.income : item.expense).toFixed(2)),
          itemStyle: {
            color:
              activeFlowType === 'income'
                ? resolvedTheme === 'dark'
                  ? '#4ade80'
                  : '#16a34a'
                : resolvedTheme === 'dark'
                  ? '#f87171'
                  : '#dc2626',
            borderRadius: [0, 0, 0, 0],
          },
        })),
      },
    ],
  };
}
