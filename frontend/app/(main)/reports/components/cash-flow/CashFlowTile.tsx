'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import type { LucideIcon } from '@/app/components/icons';
import {
  fillTemplateNodes,
  PRIVATE_CLASS,
  PrivateAmount,
} from '@/app/components/ui/private-amount';

/**
 * One figure of the period: label, the amount in whole units (cents in the
 * tooltip), and what it was in the period before — named, not "before". The
 * figure stays ink: spending is not an error. Only Net carries its change, small,
 * terracotta when it fell and sage when it rose. Zero against zero says so in
 * words instead of comparing nothing with nothing. The icon is the dashboard
 * tile's: faint, behind the text, saying what the figure is.
 */
export function CashFlowTile({
  label,
  icon: Icon,
  value,
  previous,
  nothing,
  showDelta,
  previousLabel,
  vsTemplate,
  formatWhole,
  formatAmount,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  previous: number | null;
  nothing: string | null;
  showDelta: boolean;
  previousLabel: string;
  vsTemplate: string;
  formatWhole: (value: number) => string;
  formatAmount: (value: number) => string;
}): React.JSX.Element {
  const bothZero = value === 0 && (previous === null || previous === 0);
  const delta = previous === null ? 0 : value - previous;
  let caption: React.ReactNode = null;
  if (bothZero) {
    // Nothing either time: say so where there are words for it, else stay quiet.
    caption = nothing;
  } else if (previous !== null && previousLabel) {
    caption = (
      <>
        {fillTemplateNodes(vsTemplate.replace('{{period}}', previousLabel), {
          amount: formatWhole(previous),
        })}
        {showDelta && Math.round(delta) !== 0 ? (
          <Box
            component="span"
            className={PRIVATE_CLASS}
            sx={{ ml: 0.75, color: delta < 0 ? 'var(--money-down)' : 'var(--money-up)' }}
          >
            {delta > 0 ? '+' : '−'}
            {formatWhole(Math.abs(delta))}
          </Box>
        ) : null}
      </>
    );
  }
  return (
    <Box
      sx={{
        position: 'relative',
        // Its own stacking context and clip, so the icon sits under the text.
        overflow: 'hidden',
        isolation: 'isolate',
        p: '22px',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Icon className="seneca-dashboard__stat-icon" aria-hidden="true" />
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</Typography>
      <Typography
        sx={{
          mt: 0.5,
          fontSize: 30,
          fontWeight: 500,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--foreground)',
        }}
      >
        <PrivateAmount title={formatAmount(value)}>{formatWhole(value)}</PrivateAmount>
      </Typography>
      {caption ? (
        <Typography sx={{ mt: 0.75, fontSize: 14, color: 'var(--text-muted)' }}>
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}
