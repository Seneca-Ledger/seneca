'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { formatMoney } from '@/app/lib/format-money';
import type { GoalFlowBudget } from '@/app/lib/goals-api';
import { tokens } from '@/lib/theme-tokens';
import { formatGoalDate } from './goal-dates';

export interface GoalBudgetListProps {
  budgets: GoalFlowBudget[];
  title: React.ReactNode;
  /** Prefix for the reconciliation line, e.g. "Over the budget's own period". */
  nativePeriodLabel: React.ReactNode;
  locale: string;
  /** Formats an amount already converted to the workspace currency. */
  formatAmount: (value: number) => string;
}

export function GoalBudgetList({
  budgets,
  title,
  nativePeriodLabel,
  locale,
  formatAmount,
}: GoalBudgetListProps): React.JSX.Element {
  return (
    <Box sx={{ mt: 4 }}>
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {budgets.map(budget => (
          <Box
            key={budget.id}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: tokens.radius.md,
              bgcolor: 'background.paper',
              p: 2,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                }}
              >
                {budget.name}
              </Typography>
              <Typography variant="body2">
                <PrivateAmount>{formatAmount(budget.actualMonthly)}</PrivateAmount>{' '}
                <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                  / <PrivateAmount>{formatAmount(budget.plannedMonthly)}</PrivateAmount>
                </Typography>
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(budget.percentUsed, 100)}
              color={progressColor(budget.percentUsed)}
              sx={{ height: 6, borderRadius: tokens.radius.full, my: 1 }}
            />
            {/* The chart puts every budget on a monthly axis; this line is the
                budget's own window, which is what /budgets shows. Printing both
                keeps the two screens reconcilable instead of leaving the monthly
                figure looking like a discrepancy. */}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {nativePeriodLabel}:{' '}
              <PrivateAmount>{formatAmount(budget.nativePeriod.actual)}</PrivateAmount> /{' '}
              <PrivateAmount>
                {formatMoney(budget.limitAmount, budget.limitCurrency, locale)}
              </PrivateAmount>{' '}
              · {formatGoalDate(budget.nativePeriod.start, locale)} —{' '}
              {formatGoalDate(budget.nativePeriod.end, locale)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Same three bands the budgets page uses, so a bar means the same thing there and here. */
function progressColor(percent: number): 'success' | 'warning' | 'error' {
  if (percent >= 100) {
    return 'error';
  }
  if (percent >= 80) {
    return 'warning';
  }
  return 'success';
}
