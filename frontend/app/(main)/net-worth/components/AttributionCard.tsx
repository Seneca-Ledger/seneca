'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import type { NetWorthAttribution, NetWorthChangeKind } from '../hooks/useNetWorth';
import { CardTitle, cardSx, plainLineName } from './net-worth-ui';

interface AttributionCardProps {
  attribution: NetWorthAttribution;
  /** Null when nothing came in: a share of nothing is nothing to say. */
  savings: { income: number; rate: number | null } | null;
  formatMoney: (value: number) => string;
  labels: {
    title: string;
    hint: string;
    savings: string;
    kinds: Record<NetWorthChangeKind, string>;
  };
}

/**
 * Why the number is where it is.
 *
 * "It dropped and I cannot find out why" is the one complaint about these
 * charts that no product answers: the line tells you that something happened
 * and nothing tells you what. This says which of your things moved, and
 * whether it was money you moved, a price, or an exchange rate — and it adds
 * up to the figure above it exactly, so it can be checked.
 */
export function AttributionCard({
  attribution,
  savings,
  formatMoney,
  labels,
}: AttributionCardProps): React.JSX.Element | null {
  if (attribution.byAccount.length === 0) {
    return null;
  }

  // Colour only for a real move; a zero stays ink.
  const tone = (amount: number) =>
    amount === 0 ? 'text.primary' : amount > 0 ? 'var(--money-up)' : 'var(--money-down)';
  const signed = (amount: number) =>
    `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${formatMoney(Math.abs(amount))}`;
  const figureSx = { fontWeight: 500, fontVariantNumeric: 'tabular-nums' } as const;

  return (
    <Box sx={cardSx}>
      <CardTitle>{labels.title}</CardTitle>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', display: 'block', mt: 0.5, mb: 2 }}
      >
        {labels.hint}
      </Typography>

      {savings !== null && savings.rate !== null && (
        <Typography variant="body2" sx={{ ...figureSx, mb: 2 }}>
          {fillTemplateNodes(labels.savings.replace('{{rate}}', String(savings.rate)), {
            income: formatMoney(savings.income),
          })}
        </Typography>
      )}

      {attribution.byKind.length > 0 && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
          {attribution.byKind.map(row => (
            <Box key={row.kind}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {labels.kinds[row.kind]}
              </Typography>
              <Typography variant="body1" sx={{ ...figureSx, color: tone(row.amount) }}>
                <PrivateAmount>{signed(row.amount)}</PrivateAmount>
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {attribution.byAccount.map(row => (
          <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
              {plainLineName(row.name)}
            </Typography>
            <Typography variant="body2" sx={{ ...figureSx, color: tone(row.amount) }}>
              <PrivateAmount>{signed(row.amount)}</PrivateAmount>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
