'use client';

import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import LinearProgress from '@mui/material/LinearProgress';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type React from 'react';
import { monthEndOrToday } from '@/app/components/dashboard/month-end';
import { useIsWideSection } from '@/app/components/dashboard/section-span';
import { CardEmpty, CardLink, DashboardCard } from '@/app/components/dashboard/ui';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { queryKeys } from '@/app/lib/query-keys';
import { useCategoryName } from '@/app/lib/use-category-name';
import { type BudgetItem as BudgetSummary, fetchBudgets } from '../../budgets/hooks/useBudgetsPage';

/** A half-width card shows the most used few; with the row to itself, every budget. */
const VISIBLE_BUDGETS = 5;

/**
 * Colour only for what needs acting on: a budget in its last tenth turns
 * ochre, one past its limit terracotta, the rest stay a calm sage. At 80% the
 * warning caught half the list, so it starts at 90.
 */
export function budgetTone(percent: number): 'calm' | 'near' | 'over' {
  if (percent > 100) {
    return 'over';
  }
  if (percent >= 90) {
    return 'near';
  }
  return 'calm';
}

const TONE_FILL: Record<ReturnType<typeof budgetTone>, string> = {
  calm: 'var(--primary)',
  near: 'var(--attention)',
  over: 'var(--money-down)',
};

function mostUsed(budgets: BudgetSummary[]): BudgetSummary[] {
  return [...budgets].sort((a, b) => b.percentUsed - a.percentUsed);
}

/**
 * The month in view: the current one shares the budgets page's cache entry, so the
 * widget is drawn at once and is fresh after a budget is edited there; any other
 * month is measured on its last day, so its spending is that month's, not this one's.
 */
function useBudgets(month: string): { budgets: BudgetSummary[]; loaded: boolean } {
  const workspaceId = useWorkspaceId();
  const date = monthEndOrToday(month);
  const { data, isPending } = useQuery({
    queryKey: date ? queryKeys.budgetsAt(workspaceId, date) : queryKeys.budgets(workspaceId),
    queryFn: ({ signal }) => fetchBudgets(signal, date ?? undefined),
    enabled: Boolean(workspaceId),
    select: mostUsed,
    // Another month keeps the bars in place until its figures arrive.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
  // A failed fetch simply shows the empty state.
  return { budgets: data ?? [], loaded: !isPending };
}

interface BudgetSummaryWidgetProps {
  /** The dashboard's month, `YYYY-MM`. */
  month: string;
  monthLabel: string;
}

export function BudgetSummaryWidget({
  month,
  monthLabel,
}: BudgetSummaryWidgetProps): React.JSX.Element | null {
  const t = useIntlayer('budgetSummaryWidget');
  const wideText = useIntlayer('dashboardWideView');
  const { locale } = useLocale();
  const { budgets, loaded } = useBudgets(month);
  const wide = useIsWideSection();
  const categoryName = useCategoryName();

  if (!loaded) {
    return null;
  }

  const hasBudgets = budgets.length > 0;
  const shown = wide ? budgets : budgets.slice(0, VISIBLE_BUDGETS);
  /** With room: what was spent against what the period allows, and what is left or over. */
  const amounts = (b: BudgetSummary): React.ReactNode => {
    const money = (value: number) => formatMoney(value, b.currency, locale);
    const allowed = Number(b.availableAmount ?? b.limitAmount);
    const spent = Number(b.spentAmount);
    const rest = allowed - spent;
    return (
      <div className="lumio-dashboard__budget-amounts">
        <span>
          {String(wideText.spentOfLimit.value)
            .replace('{{spent}}', money(spent))
            .replace('{{limit}}', money(allowed))}
        </span>
        <span className={rest < 0 ? 'lumio-dashboard__amount--negative' : undefined}>
          {String(rest < 0 ? wideText.over.value : wideText.left.value).replace(
            '{{amount}}',
            money(Math.abs(rest)),
          )}
        </span>
      </div>
    );
  };
  return (
    <DashboardCard
      title={t.title}
      subtitle={monthLabel}
      action={
        <CardLink href={hasBudgets ? '/budgets#budget-list' : '/budgets'}>
          {hasBudgets ? t.viewAll : t.setUpBudgets}
        </CardLink>
      }
    >
      {hasBudgets ? (
        <div className={clsx('lumio-dashboard__list', wide && 'lumio-dashboard__list--columns')}>
          {shown.map(b => {
            const tone = budgetTone(b.percentUsed);
            return (
              <div key={b.id} className="lumio-dashboard__budget-row">
                <div className="lumio-dashboard__budget-head">
                  <span className="lumio-dashboard__row-primary">
                    {b.category ? categoryName(b.category.name) : b.name}
                  </span>
                  {/* The figure stays neutral; the bar and "over" carry the signal. */}
                  <span className="lumio-dashboard__budget-pct">{Math.round(b.percentUsed)}%</span>
                </div>
                <div className="lumio-dashboard__budget-bar" data-tone={tone}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(b.percentUsed, 100)}
                    sx={{
                      height: 5,
                      borderRadius: 3,
                      bgcolor: 'var(--icon-badge-bg)',
                      '& .MuiLinearProgress-bar': { bgcolor: TONE_FILL[tone], borderRadius: 3 },
                    }}
                  />
                </div>
                {wide && amounts(b)}
              </div>
            );
          })}
        </div>
      ) : (
        <CardEmpty icon={AccountBalanceWalletOutlined}>{t.emptyDescription}</CardEmpty>
      )}
    </DashboardCard>
  );
}
