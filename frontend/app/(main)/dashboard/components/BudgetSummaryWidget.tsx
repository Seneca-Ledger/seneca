'use client';

import LinearProgress from '@mui/material/LinearProgress';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type React from 'react';
import { CardLink, DashboardCard } from '@/app/components/dashboard/ui';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';

interface BudgetSummary {
  id: string;
  name: string;
  category?: { name: string };
  limitAmount: number;
  spentAmount: number;
  percentUsed: number;
  currency: string;
}

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
  return [...budgets].sort((a, b) => b.percentUsed - a.percentUsed).slice(0, VISIBLE_BUDGETS);
}

/**
 * The same cache entry as the budgets page, so the widget is drawn at once when
 * Overview is opened again — and is already fresh after a budget is edited there.
 */
function useBudgets(): { budgets: BudgetSummary[]; loaded: boolean } {
  const workspaceId = useWorkspaceId();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.budgets(workspaceId),
    queryFn: ({ signal }) => apiQuery<BudgetSummary[]>({ url: '/budgets', signal }),
    enabled: Boolean(workspaceId),
    select: mostUsed,
  });
  // A failed fetch simply shows the empty state.
  return { budgets: data ?? [], loaded: !isPending };
}

export function BudgetSummaryWidget(): React.JSX.Element | null {
  const t = useIntlayer('budgetSummaryWidget');
  const { budgets, loaded } = useBudgets();

  if (!loaded) {
    return null;
  }

  const hasBudgets = budgets.length > 0;
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
        <div className="lumio-dashboard__list">
          {budgets.map(b => {
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
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lumio-dashboard__card-empty">{t.emptyDescription}</div>
      )}
    </DashboardCard>
  );
}
