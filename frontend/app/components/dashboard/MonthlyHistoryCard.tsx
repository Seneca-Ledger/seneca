'use client';

import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { fillTemplate } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import {
  formatMonthParam,
  parseMonthParam,
} from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { LazyMonthlyStackedBars } from '@/app/components/charts/lazy-charts';
import {
  type DashboardHealthHistory,
  type DashboardHealthMonth,
  useDashboardHealthHistory,
} from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { CardEmpty, DashboardCard } from './ui';

export type HistoryMetricKey = Exclude<
  keyof DashboardHealthMonth,
  'month' | 'transactions' | 'statementsUploaded'
>;

const METRIC_COLOR: Record<HistoryMetricKey, string> = {
  uncategorized: 'var(--ff-dash-warning)',
  statementErrors: 'var(--ff-dash-critical)',
  statementsPendingReview: 'var(--ff-dash-info)',
  statementsPendingSubmit: 'var(--muted-foreground)',
  receiptsPendingReview: 'var(--ff-dash-primary)',
  parsingWarnings: 'var(--color-warning-soft-text)',
  overduePayments: 'var(--ff-dash-critical)',
};

export const DATA_HEALTH_HISTORY_METRICS: HistoryMetricKey[] = [
  'uncategorized',
  'statementErrors',
  'statementsPendingReview',
  'receiptsPendingReview',
  'parsingWarnings',
];

export const FINANCE_OPS_HISTORY_METRICS: HistoryMetricKey[] = [
  'statementsPendingSubmit',
  'statementsPendingReview',
  'uncategorized',
  'receiptsPendingReview',
  'overduePayments',
];

interface MonthlyHistoryCardProps {
  displayMonth: Date;
  metrics: HistoryMetricKey[];
  /** Same signature as the header month strip: `month` is 0-based. */
  onSelectMonth: (year: number, month: number) => void;
}

function sumOf(months: DashboardHealthMonth[], key: keyof Omit<DashboardHealthMonth, 'month'>) {
  return months.reduce((total, month) => total + month[key], 0);
}

/** A year of the tab's queues by month, so any past month can be read back and opened. */
export function MonthlyHistoryCard({
  displayMonth,
  metrics,
  onSelectMonth,
}: MonthlyHistoryCardProps): React.JSX.Element {
  const t = useIntlayer('monthlyHistoryCard');
  const { locale } = useLocale();
  const year = displayMonth.getFullYear();
  const { data, isPending, error } = useDashboardHealthHistory(year);
  const months = data?.months ?? [];
  const series = metrics.map(key => ({ key, label: t[key].value, color: METRIC_COLOR[key] }));

  return (
    <DashboardCard
      title={t.title}
      subtitle={fillTemplate(t.subtitle.value, {
        year: String(year),
        transactions: String(sumOf(months, 'transactions')),
        statements: String(sumOf(months, 'statementsUploaded')),
      })}
    >
      <div className="lumio-chart__box lumio-chart__box--compact">
        <HistoryChart
          data={data}
          isPending={isPending}
          error={error}
          emptyLabel={fillTemplate(t.empty.value, { year: String(year) })}
          series={series}
          metrics={metrics}
          activeMonth={formatMonthParam(displayMonth)}
          locale={locale}
          onSelectMonth={key => {
            const picked = parseMonthParam(key);
            if (picked) {
              onSelectMonth(picked.getFullYear(), picked.getMonth());
            }
          }}
        />
      </div>
      <ul className="lumio-chart__legend">
        {series.map(item => (
          <li key={item.key} className="lumio-chart__legend-item">
            <span className="lumio-chart__swatch" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <span className="lumio-chart__legend-value">{sumOf(months, item.key)}</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

function HistoryChart({
  data,
  isPending,
  error,
  emptyLabel,
  series,
  metrics,
  activeMonth,
  locale,
  onSelectMonth,
}: {
  data: DashboardHealthHistory | undefined;
  isPending: boolean;
  error: string | null;
  emptyLabel: string;
  series: Array<{ key: string; label: string; color: string }>;
  metrics: HistoryMetricKey[];
  activeMonth: string;
  locale: string;
  onSelectMonth: (month: string) => void;
}): React.JSX.Element {
  if (isPending) {
    return <Skeleton variant="rounded" width="100%" height="100%" />;
  }
  if (error) {
    return <div className="lumio-chart__empty lumio-dashboard__amount--negative">{error}</div>;
  }
  const months = data?.months ?? [];
  const hasActivity = months.some(
    month =>
      month.transactions > 0 || month.statementsUploaded > 0 || metrics.some(key => month[key] > 0),
  );
  if (!hasActivity) {
    return (
      <CardEmpty icon={CalendarMonthOutlined} fill>
        {emptyLabel}
      </CardEmpty>
    );
  }
  return (
    <LazyMonthlyStackedBars
      points={months}
      series={series}
      activeMonth={activeMonth}
      locale={locale}
      onSelectMonth={onSelectMonth}
    />
  );
}
