'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import type { GoalFlowResponse } from '@/app/lib/goals-api';
import { tokens } from '@/lib/theme-tokens';
import { formatGoalDate } from './goal-dates';

export interface GoalProgressHeaderProps {
  goal: GoalFlowResponse['goal'];
  labels: { reached: string; remaining: string };
  locale: string;
  formatAmount: (value: number) => string;
}

export function GoalProgressHeader({
  goal,
  labels,
  locale,
  formatAmount,
}: GoalProgressHeaderProps): React.JSX.Element {
  const isReached = goal.remaining === 0;

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 500,
          }}
        >
          {goal.name}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <PrivateAmount>{formatAmount(goal.currentAmount)}</PrivateAmount>{' '}
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
            / <PrivateAmount>{formatAmount(goal.targetAmount)}</PrivateAmount>
          </Typography>
        </Typography>
      </Box>

      <LinearProgress
        variant="determinate"
        // The bar stops at full even when the goal is overshot; the numbers
        // above it still show the real amount.
        value={progressPercent(goal.currentAmount, goal.targetAmount)}
        sx={{
          height: 6,
          borderRadius: tokens.radius.full,
          my: 1.5,
          bgcolor: 'var(--icon-badge-bg)',
          '& .MuiLinearProgress-bar': {
            borderRadius: tokens.radius.full,
            bgcolor: isReached ? 'var(--money-up)' : 'var(--primary)',
          },
        }}
      />

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {isReached ? (
          labels.reached
        ) : (
          <>
            <PrivateAmount>{formatAmount(goal.remaining)}</PrivateAmount> {labels.remaining}
          </>
        )}
        {goal.targetDate ? ` · ${formatGoalDate(goal.targetDate, locale)}` : ''}
      </Typography>
    </Box>
  );
}

function progressPercent(current: number, target: number): number {
  return target > 0 ? Math.min((current / target) * 100, 100) : 0;
}
