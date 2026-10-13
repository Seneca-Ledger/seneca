'use client';

import CategoryOutlined from '@mui/icons-material/CategoryOutlined';
import TimelineOutlined from '@mui/icons-material/TimelineOutlined';
import Skeleton from '@mui/material/Skeleton';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type React from 'react';
import { useMemo } from 'react';
import {
  formatMonthParam,
  parseMonthParam,
} from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { LazyCategoryDonut, LazySpendTrendBars } from '@/app/components/charts/lazy-charts';
import type { DashboardTrends } from '@/app/hooks/useDashboard';
import { useDashboardTrends } from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { categoryColorFor } from '@/app/lib/category-defaults';
import { CashFlowCard } from './CashFlowCard';
import { CategoryIconBadge } from './CategoryIconBadge';
import { CardEmpty, DashboardCard, KpiCard, ListRow } from './ui';
import { useMonthLabel } from './use-month-label';

const LEGEND_LIMIT = 10;

interface TrendsTabProps {
  formatAmount: (value: number) => string;
  /** The dashboard's picked month; every section below the cash flow card is scoped to it. */
  displayMonth: Date;
  /** Switches the dashboard month (0-based `month`), as the header month strip does. */
  onSelectMonth: (year: number, month: number) => void;
}

type Formatter = (value: number) => string;

function TrendsKpis({
  trends,
  formatAmount,
}: {
  trends: DashboardTrends;
  formatAmount: Formatter;
}): React.JSX.Element {
  const t = useIntlayer('trendsTab');
  const { income, expense } = trends.sources.statements;
  const net = income - expense;
  return (
    <div className="lumio-dashboard__stat-grid lumio-dashboard__stat-grid--auto">
      <KpiCard
        label={t.statementsTitle.value}
        value={formatAmount(income)}
        tone="positive"
        caption={`${t.expense.value}: ${formatAmount(expense)}`}
      />
      <KpiCard
        label={t.netFlowTitle.value}
        value={`${net >= 0 ? '+' : '−'}${formatAmount(Math.abs(net))}`}
        tone={net >= 0 ? 'positive' : 'negative'}
        caption={`${t.categories.value}: ${trends.categories.length}`}
      />
      <KpiCard
        label={t.counterpartiesTitle.value}
        value={trends.counterparties.length}
        caption={t.totalFound.value}
      />
    </div>
  );
}

interface SectionState {
  loading: boolean;
  error: string | null;
  trends: DashboardTrends | null;
}

/** Shared loading / error / empty rendering for the two chart cards. */
function CardState({
  state,
  emptyLabel,
  emptyIcon,
  children,
}: {
  state: SectionState;
  emptyLabel: React.ReactNode;
  /** What the card would draw, as the empty state's icon. */
  emptyIcon: React.ComponentType<SvgIconProps>;
  children: React.ReactNode;
}): React.JSX.Element {
  // Та же коробка, что у загруженного графика (min-height 260 против 160 у
  // __card-empty), иначе карточка меняет высоту дважды за загрузку.
  if (state.loading) {
    return (
      <div className="lumio-dashboard__chart">
        <Skeleton variant="rounded" width="100%" height="100%" />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="lumio-dashboard__card-empty lumio-dashboard__amount--negative">
        {state.error}
      </div>
    );
  }
  if (!state.trends) {
    return <CardEmpty icon={emptyIcon}>{emptyLabel}</CardEmpty>;
  }
  return <>{children}</>;
}

function SpendTrendCard({
  state,
  monthLabel,
  formatAmount,
}: {
  state: SectionState;
  monthLabel: string;
  formatAmount: Formatter;
}): React.JSX.Element {
  const t = useIntlayer('trendsTab');
  const { locale } = useLocale();
  return (
    <DashboardCard title={t.spendTrendTitle} subtitle={monthLabel}>
      <CardState state={state} emptyLabel={t.noTrendDataForPeriod} emptyIcon={TimelineOutlined}>
        {state.trends?.dailyTrend.length ? (
          <div className="lumio-dashboard__chart">
            <LazySpendTrendBars
              actual={state.trends.dailyTrend}
              forecast={state.trends.forecast ?? []}
              locale={locale}
              labels={{
                income: t.income.value,
                expense: t.expense.value,
                forecastSuffix: t.forecastSuffix.value,
                forecastLabel: t.forecastLabel.value,
              }}
              formatAmount={formatAmount}
            />
          </div>
        ) : (
          <CardEmpty icon={TimelineOutlined}>{t.noTrendDataForRange}</CardEmpty>
        )}
      </CardState>
    </DashboardCard>
  );
}

function CategoryBreakdownCard({
  state,
  formatAmount,
}: {
  state: SectionState;
  formatAmount: Formatter;
}): React.JSX.Element {
  const t = useIntlayer('trendsTab');
  const top = useMemo(() => state.trends?.categories.slice(0, LEGEND_LIMIT) ?? [], [state.trends]);
  const slices = useMemo(
    () =>
      top.map(c => ({
        key: c.name,
        name: c.name,
        value: c.amount,
        color: categoryColorFor(c.name, c.color),
      })),
    [top],
  );
  return (
    <DashboardCard title={t.categoryBreakdownTitle}>
      <CardState state={state} emptyLabel={t.noTrendDataForPeriod} emptyIcon={CategoryOutlined}>
        {slices.length > 0 ? (
          <>
            <div className="lumio-dashboard__donut lumio-dashboard__donut--wide">
              <LazyCategoryDonut slices={slices} formatAmount={formatAmount} />
            </div>
            <div className="lumio-dashboard__list">
              {top.map(c => (
                <ListRow
                  key={c.name}
                  leading={
                    <CategoryIconBadge name={c.name} color={c.color} icon={c.icon} size={28} />
                  }
                  primary={c.name}
                  trailing={formatAmount(c.amount)}
                />
              ))}
            </div>
          </>
        ) : (
          <CardEmpty icon={CategoryOutlined}>{t.noCategorizedTransactions}</CardEmpty>
        )}
      </CardState>
    </DashboardCard>
  );
}

export function TrendsTab({
  formatAmount,
  displayMonth,
  onSelectMonth,
}: TrendsTabProps): React.JSX.Element {
  const month = formatMonthParam(displayMonth);
  const monthLabel = useMonthLabel(displayMonth);
  const { data: trends, isPending, error } = useDashboardTrends({ month });
  const state: SectionState = { loading: isPending, error, trends: trends ?? null };

  return (
    <div className="lumio-dashboard__tab">
      <CashFlowCard
        formatAmount={formatAmount}
        activeMonth={month}
        onSelectMonth={key => {
          const picked = parseMonthParam(key);
          if (picked) {
            onSelectMonth(picked.getFullYear(), picked.getMonth());
          }
        }}
      />
      {trends && <TrendsKpis trends={trends} formatAmount={formatAmount} />}
      <div className="lumio-dashboard__grid lumio-dashboard__grid--wide">
        <SpendTrendCard state={state} monthLabel={monthLabel} formatAmount={formatAmount} />
        <CategoryBreakdownCard state={state} formatAmount={formatAmount} />
      </div>
    </div>
  );
}
