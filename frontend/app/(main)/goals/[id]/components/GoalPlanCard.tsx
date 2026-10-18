'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import type { GoalPlanResponse, GoalPlanStatus } from '@/app/lib/goals-api';
import { tokens } from '@/lib/theme-tokens';
import { formatGoalDate, formatGoalMonth, formatMonthCount } from './goal-dates';

export interface GoalPlanCardProps {
  plan: GoalPlanResponse;
  locale: string;
  /** Formats an amount already converted to the workspace currency. */
  formatAmount: (value: number) => string;
}

/**
 * What the goal demands per month, what it is actually getting, and whether the
 * income left over after the existing budgets can carry either number.
 *
 * The three figures are shown side by side on purpose: a required amount means
 * nothing without the free cash flow it has to come out of, and a pace means
 * nothing without the date it is racing.
 */
export function GoalPlanCard({ plan, locale, formatAmount }: GoalPlanCardProps): React.JSX.Element {
  const t = useIntlayer('goalDetailPage');

  const statusLabels: Record<GoalPlanStatus, string> = {
    reached: t.statusReached.value,
    on_track: t.statusOnTrack.value,
    tight: t.statusTight.value,
    not_feasible: t.statusNotFeasible.value,
    no_deadline: t.statusNoDeadline.value,
  };

  const subtitle =
    plan.targetDate && plan.monthsLeft !== null
      ? t.planUntil.value
          .replace('{{months}}', formatMonthCount(plan.monthsLeft, locale))
          .replace('{{date}}', formatGoalDate(plan.targetDate, locale))
      : null;

  // The saved amount can be non-zero while the pace is zero: pace only reads
  // complete months, so money added this month (or long ago) is not in it.
  const paceHint =
    plan.pace.monthsObserved === 0
      ? t.planPaceNoHistory.value
      : plan.pace.perMonth === 0
        ? t.planPaceNone.value
        : undefined;

  const free = plan.capacity.free;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2.5,
        mt: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
          mb: 2.5,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
            {t.planTitle}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: 13, color: 'var(--text-muted)', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {/* The one signal on the card: a dot and a word. Every figure below
            stays ink, so the verdict is not repeated three times in red. */}
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 14 }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: statusTone(plan.status),
            }}
          />
          <Box component="span" sx={{ color: 'var(--foreground)' }}>
            {statusLabels[plan.status]}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2.5,
        }}
      >
        <Stat
          label={t.planRequired}
          value={plan.requiredPerMonth === null ? '—' : formatAmount(plan.requiredPerMonth)}
        />
        <Stat
          label={t.planPace}
          value={plan.pace.monthsObserved === 0 ? '—' : formatAmount(plan.pace.perMonth)}
          hint={paceHint}
        />
        <Stat
          label={t.planForecast}
          value={plan.forecast.month ? formatGoalMonth(plan.forecast.month, locale) : '—'}
          hint={
            !plan.forecast.month
              ? t.planNoHistory.value
              : plan.forecast.monthsLate
                ? t.planLate.value.replace('{{count}}', String(plan.forecast.monthsLate))
                : undefined
          }
        />
        <Stat
          label={t.planFree}
          value={formatAmount(free)}
          hint={free < 0 ? t.planOverCommitted.value : undefined}
        />
      </Box>

      {/* Only the shortfall is called out. A plan that fits needs no commentary,
          and repeating "you have room" on every goal trains the eye to skip it.
          The gap is required − free, so with free below zero it is larger than
          the required amount; the second line says where the difference is. */}
      {plan.gap !== null && plan.gap > 0 && plan.requiredPerMonth !== null && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: 14, color: 'var(--foreground)' }}>
            {t.planGap}:{' '}
            <Box component="span" sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {formatAmount(plan.gap)}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'var(--text-muted)', mt: 0.25 }}>
            {free < 0
              ? t.planGapOverCommitted.value
                  .replace('{{required}}', formatAmount(plan.requiredPerMonth))
                  .replace('{{overflow}}', formatAmount(-free))
              : t.planGapShort.value
                  .replace('{{required}}', formatAmount(plan.requiredPerMonth))
                  .replace('{{free}}', formatAmount(free))}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: React.ReactNode;
  value: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 500,
          color: 'var(--foreground)',
          fontVariantNumeric: 'tabular-nums',
          mt: 0.25,
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: 13, color: 'var(--text-muted)', mt: 0.25 }}>{hint}</Typography>
      )}
    </Box>
  );
}

/** Sage for good news, ochre for attention, terracotta for a plan that does not fit. */
function statusTone(status: GoalPlanStatus): string {
  switch (status) {
    case 'reached':
    case 'on_track':
      return 'var(--money-up)';
    case 'tight':
      return 'var(--attention)';
    case 'not_feasible':
      return 'var(--money-down)';
    case 'no_deadline':
      return 'var(--text-muted)';
  }
}
