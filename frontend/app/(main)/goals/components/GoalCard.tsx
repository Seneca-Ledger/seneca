'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import NextLink from 'next/link';
import type React from 'react';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import type { Goal } from '../hooks/useGoals';
import { GoalCoverThumb } from './GoalCoverThumb';

interface GoalCardProps {
  goal: Goal;
  locale: string;
  labels: {
    reached: string;
    remaining: string;
  };
  /** An extra line under the progress bar, e.g. what the goal got this month. */
  note?: React.ReactNode;
  /** The card's buttons. A read-only card simply passes none. */
  actions?: React.ReactNode;
}

export function GoalCard({ goal, locale, labels, note, actions }: GoalCardProps) {
  const money = (value: number) => formatMoney(value, goal.currency, locale);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2.5,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <GoalCoverThumb cover={goal.cover} size={56} alt={goal.name} />
          <Box sx={{ minWidth: 0 }}>
            <Link
              component={NextLink}
              href={`/goals/${goal.id}`}
              underline="hover"
              color="inherit"
              variant="body1"
              fontWeight={600}
              noWrap
              sx={{ display: 'block' }}
            >
              {goal.name}
            </Link>
            {goal.targetDate && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {goal.targetDate}
              </Typography>
            )}
          </Box>
        </Box>
        <Typography variant="body1" fontWeight={600}>
          {money(goal.currentAmount)}{' '}
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
            / {money(goal.targetAmount)}
          </Typography>
        </Typography>
      </Box>

      <LinearProgress
        variant="determinate"
        // The bar stops at full even when the goal is overshot; the numbers
        // above it still show the real amount.
        value={Math.min(goal.percent, 100)}
        color={goal.isReached ? 'success' : 'primary'}
        sx={{ height: 8, borderRadius: tokens.radius.full, my: 1.5 }}
      />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ color: goal.isReached ? 'success.main' : 'text.secondary' }}
          >
            {goal.isReached
              ? labels.reached
              : `${money(goal.remaining)} ${labels.remaining} · ${goal.percent}%`}
          </Typography>
          {note && (
            <Typography variant="caption" sx={{ display: 'block', color: 'success.main' }}>
              {note}
            </Typography>
          )}
        </Box>

        {actions && <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box>}
      </Box>
    </Box>
  );
}
