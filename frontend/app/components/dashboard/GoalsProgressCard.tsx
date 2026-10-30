'use client';

import FlagOutlined from '@mui/icons-material/FlagOutlined';
import Box from '@mui/material/Box';
import type React from 'react';
import { GoalCard } from '@/app/(main)/goals/components/GoalCard';
import { GoalCardSkeleton } from '@/app/(main)/goals/components/GoalCardSkeleton';
import { useMonthGoals } from '@/app/(main)/goals/hooks/useMonthGoals';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { useIsWideSection } from './section-span';
import { CardEmpty, CardLink, DashboardCard } from './ui';

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
  const wide = useIsWideSection();

  // A failed request says nothing: an empty state would claim a quiet month
  // that may not be one.
  if (error) {
    return null;
  }

  // While the request is in flight the card keeps its place with a goal's
  // outline, never with the empty state.
  if (isPending) {
    return (
      <DashboardCard
        title={goalsText.title}
        subtitle={monthLabel}
        action={<CardLink href="/goals">{t.goalsViewAll}</CardLink>}
      >
        <GoalCardSkeleton note />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title={goalsText.title}
      subtitle={monthLabel}
      action={<CardLink href="/goals">{t.goalsViewAll}</CardLink>}
    >
      {goals.length === 0 ? (
        <CardEmpty icon={FlagOutlined}>{t.goalsEmptyInMonth}</CardEmpty>
      ) : (
        // With the row to itself, goals sit side by side instead of in one long column.
        <Box
          data-testid="goals-list"
          sx={
            wide
              ? {
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                }
              : { display: 'flex', flexDirection: 'column', gap: 2 }
          }
        >
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              locale={locale}
              labels={{
                reached: goalsText.reached.value,
                remaining: goalsText.remaining.value,
              }}
              note={
                <>
                  <PrivateAmount>
                    +{formatMoney(goal.contributedInMonth, goal.currency, locale)}
                  </PrivateAmount>{' '}
                  {t.goalsSavedInMonth.value}
                </>
              }
            />
          ))}
        </Box>
      )}
    </DashboardCard>
  );
}
