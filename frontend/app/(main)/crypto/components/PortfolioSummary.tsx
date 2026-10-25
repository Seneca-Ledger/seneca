'use client';

import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { LazyNetWorthArea } from '@/app/components/charts/lazy-charts';
import { ArrowDownRight, ArrowUpRight } from '@/app/components/icons';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import {
  CRYPTO_HISTORY_DAYS,
  type CryptoHistory,
  type CryptoHistoryDays,
  type CryptoSummary,
} from '../hooks/useCrypto';

/** A move smaller than this is noise, not news: it stays uncoloured. */
const SIGNAL_PERCENT = 0.5;

const PERIOD_LABELS: Record<CryptoHistoryDays, string> = { 30: '30D', 90: '90D', 365: '1Y' };

/** Sage for a real rise, terracotta for a real fall, nothing for noise. */
const signalColor = (percent: number | null): string | undefined =>
  percent === null || Math.abs(percent) < SIGNAL_PERCENT
    ? undefined
    : percent > 0
      ? 'var(--money-up)'
      : 'var(--money-down)';

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
  historyDays: CryptoHistoryDays;
  onHistoryDaysChange: (days: CryptoHistoryDays) => void;
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
  historyDays,
  onHistoryDaysChange,
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
        <Typography
          variant="h2"
          className={PRIVATE_CLASS}
          sx={{
            fontWeight: 600,
            lineHeight: 1.05,
          }}
        >
          {money(summary.portfolioValue)}
        </Typography>

        {change !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            {rising ? (
              <ArrowUpRight size={16} color={signalColor(change) ?? 'var(--muted-foreground)'} />
            ) : (
              <ArrowDownRight size={16} color={signalColor(change) ?? 'var(--muted-foreground)'} />
            )}
            <Typography
              variant="body2"
              className={PRIVATE_CLASS}
              sx={{
                color: signalColor(change) ?? 'text.secondary',
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {rising ? '+' : '−'}
              {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.abs(change))}
              %
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <TextTabs<`${CryptoHistoryDays}`>
              value={`${historyDays}`}
              onChange={next => onHistoryDaysChange(Number(next) as CryptoHistoryDays)}
              options={CRYPTO_HISTORY_DAYS.map(days => ({
                value: `${days}` as `${CryptoHistoryDays}`,
                label: PERIOD_LABELS[days],
              }))}
              ariaLabel={labels.sinceYesterday}
            />
          </Box>
          <Box sx={{ height: 180 }}>
            <LazyNetWorthArea
              points={points}
              positive={points[points.length - 1].value >= points[0].value}
              locale={locale}
              formatValue={money}
              formatTick={value =>
                formatMoney(value, summary.currency, locale, { notation: 'compact' })
              }
            />
          </Box>
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
      {/* The figure stays neutral: 66 cents on a portfolio of thousands is not
          the headline. Its share of the cost, small, carries the colour, and
          only when it is a real move. */}
      <Stat
        label={labels.unrealized}
        value={summary.unrealized === null ? '—' : money(summary.unrealized)}
        signed={summary.unrealized !== null && summary.unrealized > 0}
        percent={
          summary.unrealized === null || !summary.cost
            ? null
            : (summary.unrealized / summary.cost) * 100
        }
        hint={
          summary.cost === null ? undefined : (
            <>
              {labels.costBasis} <PrivateAmount>{money(summary.cost)}</PrivateAmount>
            </>
          )
        }
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
  signed = false,
  percent = null,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  signed?: boolean;
  percent?: number | null;
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
        className={PRIVATE_CLASS}
        sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, fontWeight: 500 }}
      >
        {signed ? '+' : ''}
        {value}
      </Typography>
      {(percent !== null || hint) && (
        <Typography sx={{ fontSize: 13, color: 'var(--text-muted)', mt: 0.25 }}>
          {percent !== null && (
            <Box
              component="span"
              className={PRIVATE_CLASS}
              sx={{ color: signalColor(percent), fontVariantNumeric: 'tabular-nums' }}
            >
              {percent > 0 ? '+' : percent < 0 ? '−' : ''}
              {Math.abs(percent).toFixed(2)}%
            </Box>
          )}
          {percent !== null && hint ? ' · ' : null}
          {hint}
        </Typography>
      )}
    </Box>
  );
}
