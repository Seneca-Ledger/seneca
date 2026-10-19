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

export const DATA_HEALTH_HISTORY_METRICS: HistoryMetricKey[] = [
  'uncategorized',
  'statementErrors',
  'statementsPendingReview',
  'receiptsPendingReview',
  'parsingWarnings',
];

/** One hue for every queue, told apart by strength: the bars count work, not alarms. */
const SERIES_COLOR = 'var(--cat-tone-1)';
const SERIES_OPACITY = [1, 0.7, 0.5, 0.35, 0.22];

/** Fewer months than this with something to fix read better as a line than a chart. */
const CHART_MIN_MONTHS = 3;

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
  // Only the queues the year had anything in: a legend of zeros says nothing.
  const visible = metrics.filter(key => sumOf(months, key) > 0);
  const series = visible.map((key, index) => ({
    key,
    label: t[key].value,
    color: SERIES_COLOR,
    opacity: SERIES_OPACITY[index] ?? SERIES_OPACITY[SERIES_OPACITY.length - 1],
  }));
  const monthsWithWork = months.filter(month => visible.some(key => month[key] > 0));
  const asChart = monthsWithWork.length >= CHART_MIN_MONTHS;
  const pick = (key: string): void => {
    const picked = parseMonthParam(key);
    if (picked) {
      onSelectMonth(picked.getFullYear(), picked.getMonth());
    }
  };

  return (
    <DashboardCard
      title={t.title}
      subtitle={fillTemplate(t.subtitle.value, {
        year: String(year),
        transactions: String(sumOf(months, 'transactions')),
        statements: String(sumOf(months, 'statementsUploaded')),
      })}
    >
      {asChart ? (
        <div className="seneca-chart__box seneca-chart__box--compact">
          <HistoryChart
            data={data}
            isPending={isPending}
            error={error}
            emptyLabel={fillTemplate(t.empty.value, { year: String(year) })}
            series={series}
            activeMonth={formatMonthParam(displayMonth)}
            locale={locale}
            onSelectMonth={pick}
          />
        </div>
      ) : (
        <HistoryLine
          months={monthsWithWork}
          metrics={visible}
          isPending={isPending}
          error={error}
          locale={locale}
          noWork={
            months.some(month => month.transactions > 0 || month.statementsUploaded > 0)
              ? fillTemplate(t.allClear.value, { year: String(year) })
              : fillTemplate(t.empty.value, { year: String(year) })
          }
          onSelectMonth={pick}
        />
      )}
      {series.length > 0 && (
        <ul className="seneca-chart__legend">
          <li className="seneca-chart__legend-item">
            {fillTemplate(t.legendPeriod.value, { year: String(year) })}
          </li>
          {series.map(item => (
            <li key={item.key} className="seneca-chart__legend-item">
              {asChart && (
                <span
                  className="seneca-chart__swatch"
                  style={{ backgroundColor: item.color, opacity: item.opacity }}
                />
              )}
              <span>{item.label}</span>
              <span className="seneca-chart__legend-value">{sumOf(months, item.key)}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/** "September: 1 · October: 8": a year with one or two busy months, without ten empty columns. */
function HistoryLine({
  months,
  metrics,
  isPending,
  error,
  locale,
  noWork,
  onSelectMonth,
}: {
  months: DashboardHealthMonth[];
  metrics: HistoryMetricKey[];
  isPending: boolean;
  error: string | null;
  locale: string;
  noWork: string;
  onSelectMonth: (month: string) => void;
}): React.JSX.Element {
  if (isPending) {
    return <Skeleton variant="text" width="40%" />;
  }
  if (error) {
    return <div className="seneca-chart__empty">{error}</div>;
  }
  if (months.length === 0) {
    return <p className="seneca-history-line">{noWork}</p>;
  }
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long' });
  return (
    <p className="seneca-history-line">
      {months.map((month, index) => {
        const name = monthName.format(
          new Date(Number(month.month.slice(0, 4)), Number(month.month.slice(5, 7)) - 1, 1),
        );
        const total = metrics.reduce((sum, key) => sum + month[key], 0);
        return (
          <span key={month.month}>
            {index > 0 && <span className="seneca-history-line__separator"> · </span>}
            <button
              type="button"
              className="seneca-history-line__month"
              onClick={() => onSelectMonth(month.month)}
            >
              {`${name.charAt(0).toLocaleUpperCase()}${name.slice(1)}: ${total}`}
            </button>
          </span>
        );
      })}
    </p>
  );
}

function HistoryChart({
  data,
  isPending,
  error,
  emptyLabel,
  series,
  activeMonth,
  locale,
  onSelectMonth,
}: {
  data: DashboardHealthHistory | undefined;
  isPending: boolean;
  error: string | null;
  emptyLabel: string;
  series: Array<{ key: string; label: string; color: string; opacity: number }>;
  activeMonth: string;
  locale: string;
  onSelectMonth: (month: string) => void;
}): React.JSX.Element {
  if (isPending) {
    return <Skeleton variant="rounded" width="100%" height="100%" />;
  }
  if (error) {
    return <div className="seneca-chart__empty seneca-dashboard__amount--negative">{error}</div>;
  }
  const months = data?.months ?? [];
  if (months.length === 0) {
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
