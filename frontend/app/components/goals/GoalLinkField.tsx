'use client';

import { Box, Typography } from '@mui/material';
import type React from 'react';
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { useTransactionGoal } from './useTransactionGoal';

const NONE = '';
const LABEL_SX = {
  display: 'block',
  mb: 0.5,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
};

/**
 * Counts a transaction toward a goal: income adds to it, an expense takes from
 * it. Without a transaction (a receipt not approved yet) the field is shown
 * disabled with the reason, so it is clear where the option lives.
 */
export function GoalLinkField({
  transactionId,
  syncKey,
}: {
  transactionId: string | null;
  syncKey?: string;
}): React.JSX.Element {
  const t = useIntlayer('goalLinkField');
  const { locale } = useLocale();
  const { link, goals, items, loading, saving, setGoal, setItem } = useTransactionGoal(
    transactionId,
    syncKey,
  );
  const goalId = link?.goal?.id ?? NONE;

  // A goal reached or soft-deleted still shows while it is the linked one.
  const options = [
    { value: NONE, label: t.none.value },
    ...goals.map(goal => ({ value: goal.id, label: goal.name })),
    ...(link?.goal && !goals.some(goal => goal.id === link.goal?.id)
      ? [{ value: link.goal.id, label: link.goal.name }]
      : []),
  ];

  const hint = (() => {
    if (!transactionId) {
      return t.approveFirst.value;
    }
    if (!link?.goal || link.amount === null) {
      return null;
    }
    const amount = formatMoney(Math.abs(link.amount), link.goal.currency, locale);
    const template = link.amount < 0 ? t.takesFrom.value : t.addsTo.value;
    return template.replace('{amount}', amount).replace('{goal}', link.goal.name);
  })();

  return (
    <Box>
      <Box component="label" htmlFor="transaction-goal" sx={LABEL_SX}>
        {t.label}
      </Box>
      <Select
        fullWidth
        id="transaction-goal"
        inputProps={{ 'aria-label': t.label.value }}
        value={goalId}
        disabled={!transactionId || loading || saving}
        onChange={next => setGoal(next === NONE ? null : next)}
        options={options}
      />
      {hint ? (
        <Typography sx={{ mt: 0.5, fontSize: 13, color: 'var(--text-muted)' }}>{hint}</Typography>
      ) : null}
      {/* Paying a planned line marks it paid at what it cost; the plan then knows. */}
      {link?.goal && items.length > 0 ? (
        <Box sx={{ mt: 1.5 }}>
          <Box component="label" htmlFor="transaction-goal-item" sx={LABEL_SX}>
            {t.costLine}
          </Box>
          <Select
            fullWidth
            id="transaction-goal-item"
            inputProps={{ 'aria-label': t.costLine.value }}
            value={link.itemId ?? NONE}
            disabled={saving}
            onChange={next => setItem(next === NONE ? null : next)}
            options={[
              { value: NONE, label: t.noCostLine.value },
              ...items.map(item => ({ value: item.id, label: item.name })),
            ]}
          />
        </Box>
      ) : null}
    </Box>
  );
}
