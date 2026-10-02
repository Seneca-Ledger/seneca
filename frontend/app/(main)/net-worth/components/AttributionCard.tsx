'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { tokens } from '@/lib/theme-tokens';
import type { NetWorthAttribution, NetWorthChangeKind } from '../hooks/useNetWorth';

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

  const tone = (amount: number) => (amount >= 0 ? 'success.main' : 'error.main');
  const signed = (amount: number) => `${amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(amount))}`;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 3,
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.6 }}
      >
        {labels.title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
        {labels.hint}
      </Typography>

      {savings?.rate !== null && savings !== null && (
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>
          {labels.savings
            .replace('{{rate}}', String(savings.rate))
            .replace('{{income}}', formatMoney(savings.income))}
        </Typography>
      )}

      {attribution.byKind.length > 0 && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
          {attribution.byKind.map(row => (
            <Box key={row.kind}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {labels.kinds[row.kind]}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: tone(row.amount) }}>
                {signed(row.amount)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {attribution.byAccount.map(row => (
          <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
              {row.name}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: tone(row.amount) }}>
              {signed(row.amount)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
