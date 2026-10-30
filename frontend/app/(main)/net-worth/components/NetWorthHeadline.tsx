'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { formatDayLabel } from '@/app/components/charts/chart-format';
import { ArrowDownRight, ArrowUpRight } from '@/app/components/icons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { NetWorthData, NetWorthDenominated, NetWorthView } from '../hooks/useNetWorth';
import { nextMilestone } from '../milestone';
import { useNetWorthDisplay } from '../net-worth-display';
import { ChartDisplayOptions } from './ChartDisplayOptions';
import { NetWorthChart } from './NetWorthChart';
import { cardSx, WholeMoney } from './net-worth-ui';

interface NetWorthHeadlineProps {
  data: NetWorthData;
  /** The same figures in ounces, when the page is measured in metal and a price was found. */
  inMetal: NetWorthDenominated | null;
  denominate: 'XAU' | null;
  view: NetWorthView;
  locale: string;
}

function daysBetween(from: string, to: string): number {
  return Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
}

/** The figure, how it moved over the window, the chart, and the two sides under it. */
export function NetWorthHeadline({
  data,
  inMetal,
  denominate,
  view,
  locale,
}: NetWorthHeadlineProps): React.JSX.Element {
  const t = useIntlayer('netWorthPage');
  const display = useNetWorthDisplay();
  const currency = data.currency;
  const formatOunces = (value: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ozt`;
  const show = (value: number) =>
    inMetal ? formatOunces(value) : formatMoney(value, currency, locale);
  // The chart's value lines: whole units, short enough for the axis.
  const tick = (value: number) =>
    inMetal ? formatOunces(value) : formatMoney(value, currency, locale, { notation: 'compact' });
  const headline = inMetal ?? data;
  const isPositive = headline.change >= 0;
  const unchanged = headline.change === 0;
  const hasData = data.assetsTotal !== 0 || data.liabilitiesTotal !== 0;
  // The next round number, and when this window's pace would reach it.
  const milestone = inMetal
    ? null
    : nextMilestone(data.current, data.change, daysBetween(data.from, data.to));

  return (
    <Box data-tour-shot="net-worth-chart" sx={cardSx}>
      <Typography variant="h3" sx={{ fontWeight: 500, lineHeight: 1.1 }}>
        {inMetal ? (
          <PrivateAmount>{formatOunces(headline.current)}</PrivateAmount>
        ) : (
          <WholeMoney value={headline.current} currency={currency} locale={locale} />
        )}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
        {/* Only the change itself carries a colour; the words around it stay neutral,
            and so does a change of zero: no arrow, no sign, no colour. */}
        {unchanged ? null : isPositive ? (
          <ArrowUpRight size={18} color="var(--money-up)" />
        ) : (
          <ArrowDownRight size={18} color="var(--money-down)" />
        )}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            color: unchanged
              ? 'text.secondary'
              : isPositive
                ? 'var(--money-up)'
                : 'var(--money-down)',
          }}
        >
          <PrivateAmount>
            {unchanged ? '' : isPositive ? '+' : '−'}
            {show(Math.abs(headline.change))}
          </PrivateAmount>
          {!unchanged &&
            headline.changePercent != null &&
            ` (${isPositive ? '+' : '−'}${Math.abs(headline.changePercent)}%)`}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t.overPeriod}
        </Typography>
      </Box>
      {denominate && !inMetal && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {t.noMetalPrice}
        </Typography>
      )}
      {display.allTimeHigh && !inMetal && data.allTimeHigh && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {fillTemplateNodes(
            t.allTimeHigh.value.replace(
              '{{date}}',
              formatStoredDateWithOptions(
                `${data.allTimeHigh.date}T00:00:00`,
                { day: 'numeric', month: 'long', year: 'numeric' },
                locale,
              ),
            ),
            { value: formatMoney(data.allTimeHigh.value, currency, locale) },
          )}
        </Typography>
      )}
      {milestone && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {fillTemplateNodes(t.milestoneRemaining.value, {
            target: formatMoney(milestone.target, currency, locale),
            remaining: formatMoney(milestone.remaining, currency, locale),
          })}
          {milestone.reachedOn &&
            ` — ${t.milestonePace.value.replace(
              '{{date}}',
              formatDayLabel(milestone.reachedOn, locale),
            )}`}
        </Typography>
      )}

      {data.missingRates.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {`${t.missingRates.value}: ${data.missingRates.join(', ')}`}
        </Alert>
      )}

      {hasData ? (
        <Box sx={{ mt: 2 }}>
          <NetWorthChart
            points={inMetal ? inMetal.series : data.series}
            positive={isPositive}
            view={view}
            zeroBaseline={display.zeroBaseline}
            formatValue={show}
            formatTick={tick}
            labels={{
              assets: t.assets.value,
              liabilities: t.liabilities.value,
              net: t.title.value,
            }}
          />
          <ChartDisplayOptions display={display} />
        </Box>
      ) : (
        <EmptyState illustration="net-worth" description={t.empty} compact />
      )}

      <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t.assets}
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            <WholeMoney value={data.assetsTotal} currency={currency} locale={locale} />
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t.liabilities}
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            <WholeMoney value={data.liabilitiesTotal} currency={currency} locale={locale} />
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
