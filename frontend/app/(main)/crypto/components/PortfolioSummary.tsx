'use client';

import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { LazyNetWorthArea } from '@/app/components/charts/lazy-charts';
import { ArrowDownRight, ArrowUpRight } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import type { CryptoHistory, CryptoSummary } from '../hooks/useCrypto';

type PortfolioSummaryLabels = {
  sinceYesterday: string;
  historyEmpty: string;
  unrealized: string;
  costBasis: string;
  income: string;
  expense: string;
};

type PortfolioSummaryProps = {
  summary: CryptoSummary;
  history: CryptoHistory | null;
  labels: PortfolioSummaryLabels;
  locale: string;
  money: (value: number) => string;
};

/**
 * The one figure the page is about, with its line and the few numbers that
 * qualify it. One card rather than a row of equal tiles: the portfolio is the
 * headline and the rest is context, and spreading them out as four boxes makes
 * them look like four separate answers.
 */
export function PortfolioSummary({
  summary,
  history,
  labels,
  locale,
  money,
}: PortfolioSummaryProps): React.JSX.Element {
  const change = summary.portfolioChangeSinceYesterday;
  const rising = (change ?? 0) >= 0;
  const points = history?.series ?? [];
  const hasChart = points.length > 1;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 3,
        display: 'grid',
        // With a chart, it takes the width the figures do not need. Without one —
        // a wallet connected today has no history yet — the figures move out to
        // the far side instead, so the block is never a wide empty band.
        gridTemplateColumns: { xs: '1fr', md: 'auto minmax(0, 1fr)' },
        columnGap: 4,
        rowGap: 2,
        alignItems: 'start',
      }}
    >
      <Box>
        {/* The page is read for this number and the three beside it, so both are
            sized to be read across a desk, not squinted at. */}
        <Typography variant="h2" fontWeight={700} sx={{ lineHeight: 1.05 }}>
          {money(summary.portfolioValue)}
        </Typography>

        {change !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
            {rising ? (
              <ArrowUpRight size={18} color="var(--ff-dash-success)" />
            ) : (
              <ArrowDownRight size={18} color="var(--ff-dash-critical)" />
            )}
            <Typography
              variant="body1"
              sx={{
                color: rising ? 'var(--ff-dash-success)' : 'var(--ff-dash-critical)',
                fontWeight: 600,
              }}
            >
              {rising ? '+' : '−'}
              {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.abs(change))}
              %
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {labels.sinceYesterday}
            </Typography>
          </Box>
        )}

        {hasChart && <Stats summary={summary} labels={labels} money={money} sx={{ mt: 2.5 }} />}

        {!hasChart && (
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            {labels.historyEmpty}
          </Typography>
        )}
      </Box>

      {hasChart ? (
        <Box sx={{ height: 180, minWidth: 0 }}>
          <LazyNetWorthArea
            points={points}
            positive={points[points.length - 1].value >= points[0].value}
            locale={locale}
            formatValue={money}
          />
        </Box>
      ) : (
        <Stats
          summary={summary}
          labels={labels}
          money={money}
          sx={{ justifyContent: { xs: 'start', md: 'end' }, alignSelf: 'center' }}
        />
      )}
    </Box>
  );
}

/** The three figures that qualify the headline, always in their own columns. */
function Stats({
  summary,
  labels,
  money,
  sx,
}: {
  summary: CryptoSummary;
  labels: PortfolioSummaryLabels;
  money: (value: number) => string;
  sx?: SxProps<Theme>;
}): React.JSX.Element {
  return (
    <Box
      sx={[
        {
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, auto)' },
          justifyContent: 'start',
          columnGap: { xs: 4, sm: 5 },
          rowGap: 2.5,
        },
        ...(Array.isArray(sx) ? sx : [sx ?? {}]),
      ]}
    >
      <Stat
        label={labels.unrealized}
        value={summary.unrealized === null ? '—' : money(summary.unrealized)}
        hint={summary.cost === null ? undefined : `${labels.costBasis} ${money(summary.cost)}`}
        tone={summary.unrealized === null ? undefined : summary.unrealized >= 0 ? 'up' : 'down'}
      />
      <Stat label={labels.income} value={money(summary.income)} />
      <Stat label={labels.expense} value={money(summary.expense)} />
    </Box>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down';
}): React.JSX.Element {
  return (
    <Box>
      {/* One step down from the headline, not a footnote: these are figures the
          page is read for, and at caption size nobody read them. */}
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography
        variant="h4"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
          ...(tone
            ? { color: tone === 'up' ? 'var(--ff-dash-success)' : 'var(--ff-dash-critical)' }
            : {}),
        }}
      >
        {tone === 'up' ? '+' : ''}
        {value}
      </Typography>
      {hint && (
        <Typography variant="body2" sx={{ color: 'text.disabled', mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
