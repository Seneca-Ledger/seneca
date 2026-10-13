'use client';

import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import LinearProgress from '@mui/material/LinearProgress';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type React from 'react';
import { useIsWideSection } from '@/app/components/dashboard/section-span';
import { CardEmpty, CardLink, DashboardCard } from '@/app/components/dashboard/ui';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { queryKeys } from '@/app/lib/query-keys';
import { type BudgetItem as BudgetSummary, fetchBudgets } from '../../budgets/hooks/useBudgetsPage';

/** A half-width card shows the most used few; with the row to itself, every budget. */
const VISIBLE_BUDGETS = 5;

function getColor(percent: number): 'success' | 'warning' | 'error' {
  if (percent >= 100) {
    return 'error';
  }
  if (percent >= 80) {
    return 'warning';
  }
  return 'success';
}

const PERCENT_CLASS: Record<ReturnType<typeof getColor>, string> = {
  success: 'lumio-dashboard__amount--positive',
  warning: 'lumio-dashboard__stat-value--warning',
  error: 'lumio-dashboard__amount--negative',
};

function mostUsed(budgets: BudgetSummary[]): BudgetSummary[] {
  return [...budgets].sort((a, b) => b.percentUsed - a.percentUsed);
}

/**
 * The same cache entry as the budgets page, so the widget is drawn at once when
 * Overview is opened again — and is already fresh after a budget is edited there.
 */
function useBudgets(): { budgets: BudgetSummary[]; loaded: boolean } {
  const workspaceId = useWorkspaceId();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.budgets(workspaceId),
    queryFn: ({ signal }) => fetchBudgets(signal),
    enabled: Boolean(workspaceId),
    select: mostUsed,
  });
  // A failed fetch simply shows the empty state.
  return { budgets: data ?? [], loaded: !isPending };
}

export function BudgetSummaryWidget(): React.JSX.Element | null {
  const t = useIntlayer('budgetSummaryWidget');
  const wideText = useIntlayer('dashboardWideView');
  const { locale } = useLocale();
  const { budgets, loaded } = useBudgets();
  const wide = useIsWideSection();

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
      action={
        <CardLink href={hasBudgets ? '/budgets#budget-list' : '/budgets'}>
          {hasBudgets ? t.viewAll : t.setUpBudgets}
        </CardLink>
      }
    >
      {hasBudgets ? (
        <div className={clsx('lumio-dashboard__list', wide && 'lumio-dashboard__list--columns')}>
          {shown.map(b => {
            const color = getColor(b.percentUsed);
            return (
              <div key={b.id} className="lumio-dashboard__budget-row">
                <div className="lumio-dashboard__budget-head">
                  <span className="lumio-dashboard__row-primary">{b.category?.name ?? b.name}</span>
                  <span className={clsx('lumio-dashboard__budget-pct', PERCENT_CLASS[color])}>
                    {Math.round(b.percentUsed)}%
                  </span>
                </div>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(b.percentUsed, 100)}
                  color={color}
                  sx={{ height: 6, borderRadius: 3 }}
                />
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
