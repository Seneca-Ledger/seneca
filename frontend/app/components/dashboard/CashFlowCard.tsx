'use client';

import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import Skeleton from '@mui/material/Skeleton';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useCallback } from 'react';
import {
  CASH_FLOW_RANGES,
  DEFAULT_CASH_FLOW_RANGE,
  parseCashFlowRangeParam,
  withDashboardParams,
} from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { ChartRangeFooter } from '@/app/components/charts/ChartParts';
import { formatMonthLabel, formatSignedAmount } from '@/app/components/charts/chart-format';
import { LazyCashFlowBars } from '@/app/components/charts/lazy-charts';
import {
  type DashboardCashFlowRange,
  type DashboardMonthlyCashFlow,
  type DashboardMonthlyCashFlowPoint,
  useDashboardCashFlow,
} from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { CardEmpty, Chip, ChipGroup, DashboardCard } from './ui';

const RANGE_LABEL_KEY = {
  all: 'rangeAll',
  '5y': 'range5y',
  '12m': 'range12m',
  this_year: 'rangeThisYear',
} as const satisfies Record<DashboardCashFlowRange, string>;

/** The period lives in `?cf=` so a reload keeps it; the default is left out of the URL. */
function useCashFlowRangeParam(): [
  DashboardCashFlowRange,
  (range: DashboardCashFlowRange) => void,
] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = parseCashFlowRangeParam(searchParams?.get('cf'));
  const setRange = useCallback(
    (next: DashboardCashFlowRange): void => {
      const query = withDashboardParams(searchParams?.toString() ?? '', {
        cf: next === DEFAULT_CASH_FLOW_RANGE ? null : next,
      });
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  return [range, setRange];
}

interface CashFlowCardProps {
  formatAmount: (value: number) => string;
  /**
   * The dashboard's picked month (YYYY-MM): every period ends at it, the headline shows that
   * month alone and its bar is emphasised. Without it the card covers the current month's period.
   */
  activeMonth?: string;
  /** Called with the YYYY-MM of a clicked bar. */
  onSelectMonth?: (month: string) => void;
}

/** One month's figures from the zero-filled series; zeros when the month has no row. */
function monthTotals(
  points: DashboardMonthlyCashFlowPoint[],
  month: string,
): DashboardMonthlyCashFlow['totals'] {
  const point = points.find(item => item.month === month);
  return { income: point?.income ?? 0, expense: point?.expense ?? 0, net: point?.net ?? 0 };
}

export function CashFlowCard({
  formatAmount,
  activeMonth,
  onSelectMonth,
}: CashFlowCardProps): React.JSX.Element {
  const t = useIntlayer('cashFlowCard');
  const { locale } = useLocale();
  const [range, setRange] = useCashFlowRangeParam();
  const { data, isPending, error } = useDashboardCashFlow(range, activeMonth);
  const points = data?.points ?? [];
  const headline = data && (activeMonth ? monthTotals(points, activeMonth) : data.totals);

  return (
    <DashboardCard
      title={t.title}
      subtitle={activeMonth ? formatMonthLabel(activeMonth, locale) : undefined}
      className="lumio-dashboard__cashflow-card"
      action={
        <ChipGroup size="sm" aria-label={t.title.value}>
          {CASH_FLOW_RANGES.map(option => (
            <Chip key={option} size="sm" active={range === option} onClick={() => setRange(option)}>
              {t[RANGE_LABEL_KEY[option]]}
            </Chip>
          ))}
        </ChipGroup>
      }
    >
      <div className="lumio-chart__total">
        {headline ? formatSignedAmount(headline.net, formatAmount) : '…'}
      </div>
      <div className="lumio-chart__breakdown">
        {headline && (
          <>
            <span className="lumio-chart__breakdown-income">
              {`${t.income.value} ${formatAmount(headline.income)}`}
            </span>
            {' · '}
            <span className="lumio-chart__breakdown-expense">
              {`${t.expense.value} ${formatAmount(headline.expense)}`}
            </span>
          </>
        )}
      </div>
      <div className="lumio-chart__box">
        <CashFlowChartBody
          data={data}
          isPending={isPending}
          error={error}
          emptyLabel={t.empty}
          chart={{
            locale,
            labels: { income: t.income.value, expense: t.expense.value, net: t.net.value },
            formatAmount,
            activeMonth,
            onSelectMonth,
          }}
        />
      </div>
      {points.length > 1 && (
        <ChartRangeFooter
          start={formatMonthLabel(points[0].month, locale)}
          end={formatMonthLabel(points[points.length - 1].month, locale)}
        />
      )}
    </DashboardCard>
  );
}

function CashFlowChartBody({
  data,
  isPending,
  error,
  emptyLabel,
  chart,
}: {
  data: DashboardMonthlyCashFlow | undefined;
  isPending: boolean;
  error: string | null;
  emptyLabel: React.ReactNode;
  chart: Omit<React.ComponentProps<typeof LazyCashFlowBars>, 'points'>;
}): React.JSX.Element {
  if (isPending) {
    return <Skeleton variant="rounded" width="100%" height="100%" />;
  }
  if (error) {
    return <div className="lumio-chart__empty lumio-dashboard__amount--negative">{error}</div>;
  }
  if (!data?.points.length) {
    return (
      <CardEmpty icon={BarChartOutlined} fill>
        {emptyLabel}
      </CardEmpty>
    );
  }
  return <LazyCashFlowBars points={data.points} {...chart} />;
}
