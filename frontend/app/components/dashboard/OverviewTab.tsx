'use client';

import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import Skeleton from '@mui/material/Skeleton';
import Link from 'next/link';
import type React from 'react';
import { useMemo } from 'react';
import {
  BudgetSummaryWidget,
  useBudgets,
} from '@/app/(main)/dashboard/components/BudgetSummaryWidget';
import { SubscriptionsMonthWidget } from '@/app/(main)/dashboard/components/SubscriptionsMonthWidget';
import { parseDateOnly, resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { FileUp } from '@/app/components/icons';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { PiggyBank, Scale, TrayArrowDown, WalletArrowUp } from '@/app/lib/category-line-icons';
import { formatMoney } from '@/app/lib/format-money';
import { AdviceCard } from './AdviceCard';
import { CashFlowCard } from './CashFlowCard';
import { CryptoPortfolioCard } from './CryptoPortfolioCard';
import { computeNet, computeSavingsRate, signTone } from './dashboard-stats.util';
import { GettingStartedCard } from './GettingStartedCard';
import { GoalsProgressCard } from './GoalsProgressCard';
import { leftToSpend } from './left-to-spend';
import { MoneyOwedCard } from './MoneyOwedCard';
import { MonthCloseCard } from './MonthCloseCard';
import { NetWorthCard } from './NetWorthCard';
import { OverviewLayout } from './OverviewLayout';
import type { KpiSectionId } from './overview-layout';
import { OverviewMonthProvider } from './overview-month';
import { RecentTransactionsCard } from './RecentTransactionsCard';
import { SafeToSpendTile } from './SafeToSpendTile';
import { SpendCalendarCard } from './SpendCalendarCard';
import { TaxesCard } from './TaxesCard';
import { TopCategoriesCard } from './TopCategoriesCard';
import { UpcomingChargesCard } from './UpcomingChargesCard';
import { CardLink, DashboardCard, KpiCard, type KpiCardProps } from './ui';
import { useMonthLabel } from './use-month-label';
import { WorkspaceActivityCard } from './WorkspaceActivityCard';

interface OverviewTabProps {
  data: DashboardData;
  formatAmount: (value: number) => string;
  isLoading?: boolean;
  displayMonth: Date;
}

const SPARK_POINTS = 10;

function sparkSeries(data: DashboardData): {
  income?: number[];
  expense?: number[];
  net?: number[];
} {
  // The month's last days are still ahead in the month we are in; their zeros are not a fall.
  const points = elapsedDays(data).slice(-SPARK_POINTS);
  if (points.length < 2) {
    return {};
  }
  return {
    income: points.map(p => p.income),
    expense: points.map(p => p.expense),
    net: points.map(p => p.income - p.expense),
  };
}

/** The month so far: days after today carry nothing yet and would thin every average. */
function elapsedDays(data: DashboardData): DashboardData['cashFlow'] {
  // The reader's calendar day: in UTC it is still yesterday for a while after midnight east of it.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return data.cashFlow.filter(point => point.date <= today);
}

function biggestDay(
  days: DashboardData['cashFlow'],
  pick: (point: DashboardData['cashFlow'][number]) => number,
): { date: string; amount: number } | null {
  let best: { date: string; amount: number } | null = null;
  for (const point of days) {
    const amount = pick(point);
    if (amount > 0 && (!best || amount > best.amount)) {
      best = { date: point.date, amount };
    }
  }
  return best;
}

function monthKey(displayMonth: Date): string {
  return `${displayMonth.getFullYear()}-${String(displayMonth.getMonth() + 1).padStart(2, '0')}`;
}

function monthRangeHref(displayMonth: Date): string {
  return `/statements/submit?month=${monthKey(displayMonth)}`;
}

function signed(value: number, formatAmount: (value: number) => string): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatAmount(Math.abs(value))}`;
}

function OverviewEmptyState(): React.JSX.Element {
  const t = useIntlayer('overviewTab');
  return (
    <div className="seneca-dashboard__empty">
      <span
        className="seneca-dashboard__card-empty-icon seneca-dashboard__card-empty-icon--lg"
        aria-hidden="true"
      >
        <UploadFileOutlined sx={{ fontSize: 48 }} />
      </span>
      <h2 className="seneca-dashboard__empty-title">{t.emptyTitle}</h2>
      <p className="seneca-dashboard__empty-desc">{t.emptyDescription}</p>
      <Link href="/statements?openExpenseDrawer=scan" className="seneca-dashboard__empty-cta">
        <FileUp size={16} />
        {t.emptyCta}
      </Link>
    </div>
  );
}

interface KpiTilesProps {
  data: DashboardData;
  formatAmount: (value: number) => string;
  monthLabel: string;
  /** The month shown, `YYYY-MM`. */
  shownMonth: string;
  /** The month shown is the one we are in: its figures are still moving. */
  monthInProgress: boolean;
  isLoading?: boolean;
  /** Formats a `YYYY-MM-DD` day as a short date in the reader's language. */
  formatDay: (day: string) => string;
  labels: {
    income: string;
    spent: string;
    leftToSpend: string;
    net: string;
    netCaption: string;
    savingsRate: string;
    savingsRateCaption: string;
    monthInProgress: string;
    avgPerDay: string;
    biggestDay: string;
  };
}

interface SpentTileProps extends KpiCardProps {
  /** The month shown, `YYYY-MM`. */
  month: string;
  leftLabel: string;
  /** What was spent, kept as a detail once the tile shows what is left. */
  spentValue: string;
}

/**
 * What was spent, until a budget covers the month: from then on what the
 * budgets still allow. A budget that starts after the month or ended before
 * it does not count.
 */
function SpentTile({ month, leftLabel, spentValue, ...spent }: SpentTileProps): React.JSX.Element {
  const { locale } = useLocale();
  const { budgets, loaded } = useBudgets(month);
  // Until the budgets are in it is not known which of the two the tile is.
  if (!loaded) {
    return <KpiCard {...spent} value={<Skeleton variant="text" width={120} />} />;
  }
  const left = leftToSpend(budgets, month);
  if (!left) {
    return <KpiCard {...spent} />;
  }
  return (
    <KpiCard
      {...spent}
      label={leftLabel}
      value={left.map(total => formatMoney(total.amount, total.currency, locale)).join(' · ')}
      // Only an overrun is a signal; what is left stays neutral.
      tone={left.some(total => total.amount < 0) ? 'negative' : 'neutral'}
      details={[{ label: spent.label, value: spentValue }, ...(spent.details ?? [])]}
    />
  );
}

/** The four KPI tiles, each a section of its own that moves on its own. */
function kpiTiles({
  data,
  formatAmount,
  monthLabel,
  shownMonth,
  monthInProgress,
  isLoading,
  formatDay,
  labels,
}: KpiTilesProps): Record<KpiSectionId, React.ReactNode> {
  const { income30d: income, expense30d: expense } = data.snapshot;
  const net = computeNet(income, expense);
  const savingsRate = computeSavingsRate(income, expense);
  const spark = sparkSeries(data);
  const spinner = isLoading ? <Skeleton variant="text" width={120} /> : null;

  // What a tile with room adds: the whole month's line and how the total came about.
  const days = elapsedDays(data);
  const month = days.length >= 2 ? days : null;
  const perDay = (total: number) => formatAmount(days.length > 0 ? total / days.length : 0);
  // The day stays readable in privacy mode; only its amount is redacted.
  const dayLine = (best: { date: string; amount: number } | null) =>
    best ? (
      <>
        <PrivateAmount>{formatAmount(best.amount)}</PrivateAmount> · {formatDay(best.date)}
      </>
    ) : (
      '—'
    );
  const split = [
    { label: labels.income, value: formatAmount(income) },
    { label: labels.spent, value: formatAmount(expense) },
  ];
  return {
    'kpi-income': (
      <KpiCard
        label={labels.income}
        icon={TrayArrowDown}
        value={spinner || formatAmount(income)}
        tone={signTone(income)}
        caption={monthLabel}
        spark={spark.income && { points: spark.income }}
        wideSpark={month ? { points: month.map(p => p.income) } : undefined}
        details={[
          { label: labels.avgPerDay, value: perDay(income) },
          {
            label: labels.biggestDay,
            value: dayLine(biggestDay(days, p => p.income)),
            plain: true,
          },
        ]}
      />
    ),
    'kpi-spent': (
      <SpentTile
        month={shownMonth}
        leftLabel={labels.leftToSpend}
        spentValue={formatAmount(expense)}
        label={labels.spent}
        icon={WalletArrowUp}
        value={spinner || formatAmount(expense)}
        // Spending is not an alarm: the card stays neutral whatever the amount.
        tone="neutral"
        caption={monthLabel}
        spark={spark.expense && { points: spark.expense }}
        wideSpark={month ? { points: month.map(p => p.expense) } : undefined}
        details={[
          { label: labels.avgPerDay, value: perDay(expense) },
          {
            label: labels.biggestDay,
            value: dayLine(biggestDay(days, p => p.expense)),
            plain: true,
          },
        ]}
      />
    ),
    'kpi-net': (
      <KpiCard
        label={labels.net}
        icon={Scale}
        value={spinner || signed(net, formatAmount)}
        tone={signTone(net)}
        caption={labels.netCaption}
        spark={spark.net && { points: spark.net }}
        wideSpark={month ? { points: month.map(p => p.income - p.expense) } : undefined}
        details={split}
      />
    ),
    'kpi-savings': (
      <KpiCard
        label={labels.savingsRate}
        icon={PiggyBank}
        value={spinner || `${Math.round(savingsRate ?? 0)}%`}
        tone={signTone(savingsRate)}
        caption={labels.savingsRateCaption}
        // A share of a month that is not over reads as final; with most of the
        // spending still ahead it is near 100% early in every month.
        note={monthInProgress ? labels.monthInProgress : undefined}
        attentionId="kpi:savings-rate"
        details={split}
      />
    ),
  };
}

export function OverviewTab({
  data,
  formatAmount,
  isLoading,
  displayMonth,
}: OverviewTabProps): React.JSX.Element {
  const t = useIntlayer('overviewTab');
  const wideText = useIntlayer('dashboardWideView');
  const { locale } = useLocale();
  const monthLabel = useMonthLabel(displayMonth);
  const formatDay = useMemo(() => {
    const format = new Intl.DateTimeFormat(resolveLocale(locale), {
      day: 'numeric',
      month: 'short',
    });
    return (day: string) => format.format(parseDateOnly(day));
  }, [locale]);
  const viewAllHref = useMemo(() => monthRangeHref(displayMonth), [displayMonth]);

  // Viewers can't create budgets or goals, so the checklist isn't theirs.
  const gettingStarted = data.role === 'viewer' ? null : <GettingStartedCard />;

  // A workspace that never imported anything gets the onboarding CTA; a month
  // without transactions still shows zeroed KPIs and empty cards. The activity
  // feed stays either way: someone who just joined a household should see that
  // their partner has been working, not an invitation to start from scratch.
  if (!data.dataHealth?.lastUploadDate) {
    return (
      <div className="seneca-dashboard__tab">
        {gettingStarted}
        <OverviewEmptyState />
        <WorkspaceActivityCard />
      </div>
    );
  }

  return (
    <OverviewMonthProvider value={monthKey(displayMonth)}>
      <OverviewLayout
        sections={{
          'getting-started': gettingStarted,
          ...kpiTiles({
            data,
            formatAmount,
            monthLabel,
            shownMonth: monthKey(displayMonth),
            monthInProgress: monthKey(displayMonth) === monthKey(new Date()),
            isLoading,
            labels: {
              income: t.income.value,
              spent: t.spentLabel.value,
              leftToSpend: t.leftToSpendLabel.value,
              net: t.netLabel.value,
              netCaption: t.netCaption.value,
              savingsRate: t.savingsRateLabel.value,
              savingsRateCaption: t.savingsRateCaption.value,
              monthInProgress: t.monthInProgress.value,
              avgPerDay: wideText.avgPerDay.value,
              biggestDay: wideText.biggestDay.value,
            },
            formatDay,
          }),
          'safe-to-spend': <SafeToSpendTile formatAmount={formatAmount} />,
          'cash-flow': (
            <CashFlowCard
              formatAmount={formatAmount}
              activeMonth={monthKey(displayMonth)}
              days={data.cashFlow}
            />
          ),
          'month-close': (
            <MonthCloseCard data={data} formatAmount={formatAmount} displayMonth={displayMonth} />
          ),
          crypto: (
            <CryptoPortfolioCard
              formatAmount={formatAmount}
              month={monthKey(displayMonth)}
              monthLabel={monthLabel}
            />
          ),
          'top-categories': (
            <DashboardCard
              title={t.topCategoriesTitle}
              subtitle={monthLabel}
              action={<CardLink href="/reports?tab=cash-flow">{t.viewAll}</CardLink>}
            >
              <TopCategoriesCard
                categories={data.topCategories ?? []}
                formatAmount={formatAmount}
                month={monthKey(displayMonth)}
              />
            </DashboardCard>
          ),
          'recent-transactions': (
            <RecentTransactionsCard
              transactions={data.recentTransactions ?? []}
              formatAmount={formatAmount}
              viewAllHref={viewAllHref}
            />
          ),
          'spend-calendar': <SpendCalendarCard displayMonth={displayMonth} />,
          goals: <GoalsProgressCard month={monthKey(displayMonth)} monthLabel={monthLabel} />,
          'net-worth': <NetWorthCard month={monthKey(displayMonth)} monthLabel={monthLabel} />,
          budgets: <BudgetSummaryWidget month={monthKey(displayMonth)} monthLabel={monthLabel} />,
          'cash-runway': <SubscriptionsMonthWidget formatAmount={formatAmount} />,
          activity: <WorkspaceActivityCard />,
          'upcoming-charges': <UpcomingChargesCard formatAmount={formatAmount} />,
          'money-owed': (
            <MoneyOwedCard
              payable={data.snapshot.totalPayable}
              overduePayable={data.snapshot.totalOverdue}
              formatAmount={formatAmount}
            />
          ),
          taxes: <TaxesCard />,
          advice: <AdviceCard />,
        }}
      />
    </OverviewMonthProvider>
  );
}
