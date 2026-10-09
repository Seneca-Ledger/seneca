'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { GoalCard } from '@/app/(main)/goals/components/GoalCard';
import { useMonthGoals } from '@/app/(main)/goals/hooks/useMonthGoals';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { CardLink, DashboardCard } from './ui';

interface GoalsProgressCardProps {
  /** The month the dashboard is showing, `YYYY-MM`. */
  month: string;
  monthLabel: string;
}

/**
 * The goals that were paid into during the shown month, drawn exactly as the
 * goals page draws them — minus the buttons, which belong on that page. A month
 * with no contributions keeps the section and says so.
 */
export function GoalsProgressCard({
  month,
  monthLabel,
}: GoalsProgressCardProps): React.JSX.Element | null {
  const t = useIntlayer('overviewTab');
  const goalsText = useIntlayer('goalsPage');
  const { locale } = useLocale();
  const { goals, isPending, error } = useMonthGoals(month);

  // Nothing is drawn until the answer is in: an empty state shown while the
  // request is still in flight would claim a quiet month that may not be one.
  // A failed request says nothing either, for the same reason.
  if (isPending || error) {
    return null;
  }

  return (
    <DashboardCard
      title={goalsText.title}
      subtitle={monthLabel}
      action={<CardLink href="/goals">{t.goalsViewAll}</CardLink>}
    >
      {goals.length === 0 ? (
        <EmptyState illustration="goals" size="sm" compact description={t.goalsEmptyInMonth} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              locale={locale}
              labels={{
                reached: goalsText.reached.value,
                remaining: goalsText.remaining.value,
              }}
              note={`+${formatMoney(goal.contributedInMonth, goal.currency, locale)} ${t.goalsSavedInMonth.value}`}
            />
          ))}
        </Box>
      )}
    </DashboardCard>
  );
}
