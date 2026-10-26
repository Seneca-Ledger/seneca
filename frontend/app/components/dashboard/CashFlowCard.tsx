'use client';

import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import type React from 'react';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { formatMonthLabel, niceCeiling } from '@/app/components/charts/chart-format';
import { LazyCashFlowBars } from '@/app/components/charts/lazy-charts';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import {
  type DashboardCashFlowEntry,
  type DashboardCashFlowPoint,
  useCashFlowEntries,
} from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { CardEmpty, DashboardCard } from './ui';

interface CashFlowCardProps {
  formatAmount: (value: number) => string;
  /** The dashboard's picked month (YYYY-MM): the card shows it day by day. */
  activeMonth: string;
  /** That month's days, from the dashboard answer (zero-filled, one point a day). */
  days: DashboardCashFlowPoint[];
}

/** The app's phone layout (no sidebar). */
const PHONE_QUERY = '(max-width: 1023px)';
/** Room per day on a phone: about six days fit, the rest is a swipe away. */
const PHONE_DAY_WIDTH = 56;

function subscribePhone(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** False on the server and in the first client render, so hydration matches. */
function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/** The reader's calendar day as YYYY-MM-DD (in UTC it can still be yesterday). */
function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The middle of the days with spending: what an ordinary day costs this month. */
export function typicalSpend(days: DashboardCashFlowPoint[]): number {
  const spent = days
    .map(day => day.expense)
    .filter(amount => amount > 0)
    .sort((a, b) => a - b);
  if (!spent.length) {
    return 0;
  }
  const middle = Math.floor(spent.length / 2);
  return spent.length % 2 ? spent[middle] : (spent[middle - 1] + spent[middle]) / 2;
}

/** The month's net: a gain needs no plus, a loss keeps its typographic minus. */
function netFigure(value: number, formatAmount: (value: number) => string): string {
  return value < 0 ? `−${formatAmount(Math.abs(value))}` : formatAmount(value);
}

export function CashFlowCard({
  formatAmount,
  activeMonth,
  days,
}: CashFlowCardProps): React.JSX.Element {
  const t = useIntlayer('cashFlowCard');
  const { locale } = useLocale();
  const income = days.reduce((sum, day) => sum + day.income, 0);
  const expense = days.reduce((sum, day) => sum + day.expense, 0);
  const budgeted = days.reduce((sum, day) => sum + day.budgeted, 0);
  const hasMoney = days.some(day => day.income !== 0 || day.expense !== 0);
  const isPhone = useIsPhone();
  const entries = useCashFlowEntries(activeMonth);
  // A day's tooltip names what made its bars, so the rows are grouped by day once.
  const entriesByDay = useMemo(() => {
    if (!entries) {
      return undefined;
    }
    const byDay = new Map<string, DashboardCashFlowEntry[]>();
    for (const entry of entries) {
      byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry]);
    }
    return byDay;
  }, [entries]);
  // A phone shows wide bars and swipes through the days, so the days still to come are left out.
  const today = todayKey();
  const points = isPhone ? days.filter(day => day.date <= today) : days;
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Open on the latest day; the earlier ones are a swipe to the left.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new set of days is the trigger
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollLeft = scroller.scrollWidth;
    }
  }, [isPhone, activeMonth, points.length]);

  return (
    <DashboardCard
      title={t.title}
      subtitle={formatMonthLabel(activeMonth, locale)}
      className="seneca-dashboard__cashflow-card"
    >
      <div className={`seneca-chart__total ${PRIVATE_CLASS}`}>
        {netFigure(income - expense, formatAmount)}
      </div>
      <div className="seneca-chart__breakdown">
        <span className="seneca-chart__breakdown-series seneca-chart__breakdown-series--income">
          {t.income.value} <PrivateAmount>{formatAmount(income)}</PrivateAmount>
        </span>
        <span className="seneca-chart__breakdown-series seneca-chart__breakdown-series--expense">
          {t.expense.value} <PrivateAmount>{formatAmount(expense)}</PrivateAmount>
        </span>
        {budgeted > 0 && (
          <span className="seneca-chart__breakdown-series seneca-chart__breakdown-series--budgeted">
            {t.budgeted.value} <PrivateAmount>{formatAmount(budgeted)}</PrivateAmount>
          </span>
        )}
      </div>
      <div className="seneca-chart__box">
        {hasMoney ? (
          <div ref={scrollerRef} className="seneca-chart__scroller">
            <div
              className="seneca-chart__scroller-track"
              style={isPhone ? { width: points.length * PHONE_DAY_WIDTH } : undefined}
            >
              <LazyCashFlowBars
                points={points}
                locale={locale}
                labels={{
                  income: t.income.value,
                  expense: t.expense.value,
                  budgeted: t.budgeted.value,
                  noData: t.noData.value,
                }}
                formatAmount={formatAmount}
                formatTick={formatAmount}
                // The month's income, rounded up; a bigger single bar lifts it so none spills over.
                ceiling={niceCeiling(
                  Math.max(income, ...points.map(day => Math.max(day.income, day.expense))),
                )}
                typical={typicalSpend(points)}
                everyDay={isPhone}
                entriesByDay={entriesByDay}
              />
            </div>
          </div>
        ) : (
          <CardEmpty icon={BarChartOutlined} fill>
            {t.empty}
          </CardEmpty>
        )}
      </div>
    </DashboardCard>
  );
}
