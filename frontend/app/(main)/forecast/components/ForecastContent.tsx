'use client';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { LoadError } from '@/app/components/ui/load-error';
import { joinSummary, PageTitle } from '@/app/components/ui/page-title';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import {
  FORECAST_HORIZONS,
  type ForecastEvent,
  type ForecastHorizon,
  useForecast,
} from '../hooks/useForecast';
import { ForecastChart } from './ForecastChart';
import { ForecastEvents } from './ForecastEvents';

const FACTORS = [0.5, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

const formatDate = (date: string): string =>
  formatStoredDateWithOptions(date, { day: 'numeric', month: 'short' });

function Kpi({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  /** Colour only for a real signal: money that runs out, or room to spend. */
  tone?: 'success' | 'error';
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2,
      }}
    >
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',

          color:
            tone === 'success'
              ? 'var(--money-up)'
              : tone === 'error'
                ? 'var(--money-down)'
                : 'text.primary',
        }}
      >
        {value}
      </Typography>
      {note && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{note}</Typography>}
    </Box>
  );
}

export function ForecastContent() {
  const t = useIntlayer('forecastPage');
  const { locale } = useLocale();
  const {
    data,
    isPending,
    isFetching,
    error,
    horizon,
    setHorizon,
    scenario,
    toggleExcluded,
    setFactor,
  } = useForecast();
  // Excluded sources vanish from the response; remember them so they can be re-ticked.
  const [seen, setSeen] = useState<Map<string, ForecastEvent>>(new Map());
  if (data) {
    for (const event of data.events) {
      if (!seen.has(event.sourceId)) {
        setSeen(current => new Map(current).set(event.sourceId, event));
      }
    }
  }

  const currency = data?.currency ?? 'KZT';
  // Whole sums without ".00" (−€850, not −€850.00); cents only where there are some.
  const formatAmount = (value: number) =>
    formatMoney(value, currency, locale, Number.isInteger(value) ? { fractionDigits: 0 } : {});
  const formatTick = (value: number) =>
    formatMoney(value, currency, locale, { notation: 'compact' });
  const listed: ForecastEvent[] = data
    ? [
        ...data.events,
        // The previous response stays on screen while the new one loads, so it may still hold them.
        ...scenario.exclude
          .filter(id => !data.events.some(event => event.sourceId === id))
          .map(id => seen.get(id))
          .filter((event): event is ForecastEvent => Boolean(event)),
      ].sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const signedWhole = (value: number) =>
    `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(value), currency, locale, { fractionDigits: 0 })}`;
  const hasOverdue = listed.some(event => event.isOverdue);
  const isEmpty =
    data !== null &&
    data.events.length === 0 &&
    data.everydayMonthly === 0 &&
    data.openingBalance === 0;

  // The horizon, then any scenario factor moved off 100%.
  const titleSummary = joinSummary([
    fill(t.closingBalance.value, { days: String(horizon) }),
    ...(['incomeFactor', 'expenseFactor'] as const).map(
      key =>
        scenario[key] !== 1 &&
        fill(t.factorOption.value, {
          name: t[key].value,
          percent: String(Math.round(scenario[key] * 100)),
        }),
    ),
  ]);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'flex-end',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <PageTitle path="/forecast" summary={titleSummary} />
        <TextTabs<`${ForecastHorizon}`>
          value={`${horizon}`}
          onChange={next => setHorizon(Number(next) as ForecastHorizon)}
          options={FORECAST_HORIZONS.map(option => ({
            value: `${option}` as `${ForecastHorizon}`,
            label: option,
          }))}
          ariaLabel={t.title.value}
        />
      </Box>

      {isPending && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Skeleton variant="rounded" height={96} sx={{ borderRadius: tokens.radius.md }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: tokens.radius.md }} />
        </Box>
      )}

      {error && <LoadError spacing={2}>{t.error}</LoadError>}

      {data && isEmpty && <EmptyState illustration="subscriptions" description={t.empty} />}

      {data && !isEmpty && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            opacity: isFetching ? 0.6 : 1,
            transition: 'opacity 150ms ease',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 2,
            }}
          >
            {data.profile === 'business' ? (
              // A growing balance has no runway in months; it gets the period's change
              // as its figure, and stands in for an empty "no shortfall" card too.
              <Kpi
                label={t.runway.value}
                value={
                  data.runwayMonths === null
                    ? t.runwayGrowing.value
                    : fill(t.runwayMonths.value, {
                        months: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                          data.runwayMonths,
                        ),
                      })
                }
                note={
                  data.runwayMonths === null
                    ? fillTemplateNodes(
                        fill(t.changeOverDays.value, { days: String(data.runwayDays) }),
                        { amount: signedWhole(data.runwayChange) },
                      )
                    : undefined
                }
                tone={data.runwayMonths !== null && data.runwayMonths < 3 ? 'error' : undefined}
              />
            ) : (
              <Kpi
                label={t.safeToSpend.value}
                value={<PrivateAmount>{formatAmount(data.safeToSpend.amount)}</PrivateAmount>}
                note={fill(
                  (data.safeToSpend.nextIncomeDate ? t.safeUntilPayday : t.safeUntil).value,
                  { date: formatDate(data.safeToSpend.untilDate) },
                )}
                tone={data.safeToSpend.amount > 0 ? 'success' : 'error'}
              />
            )}
            {data.taxReserve && data.taxReserve > 0 ? (
              <Kpi
                label={t.heldForTax.value}
                value={<PrivateAmount>{formatAmount(data.taxReserve)}</PrivateAmount>}
                note={(data.profile === 'business' ? t.heldForTaxBusiness : t.heldForTaxNote).value}
              />
            ) : null}
            <Kpi
              label={t.lowestBalance.value}
              value={<PrivateAmount>{formatAmount(data.lowestBalance)}</PrivateAmount>}
              note={fill(t.onDate.value, { date: formatDate(data.lowestBalanceDate) })}
              tone={data.lowestBalance < 0 ? 'error' : undefined}
            />
            {/* No shortfall is the normal case, not news: said once, in neutral. */}
            {data.shortfallDate ? (
              <Kpi
                label={t.shortfall.value}
                value={fill(t.shortfallOn.value, { date: formatDate(data.shortfallDate) })}
                tone="error"
              />
            ) : data.profile === 'business' && data.runwayMonths === null ? null : (
              <Kpi label={t.shortfall.value} value={t.noShortfall.value} />
            )}
            <Kpi
              label={fill(t.closingBalance.value, { days: String(data.horizonDays) })}
              value={<PrivateAmount>{formatAmount(data.closingBalance)}</PrivateAmount>}
            />
          </Box>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: tokens.radius.md,
              bgcolor: 'background.paper',
              p: 3,
            }}
          >
            {/* What the curve assumes, above it and in two quiet lines: spending,
                then income and the overdue bills it treats as paid today. */}
            <Box sx={{ mb: 2, display: 'grid', gap: 0.25 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {fillTemplateNodes(
                  fill(t.everydayNote.value, { months: String(data.monthsObserved) }),
                  { amount: formatAmount(data.everydayMonthly) },
                )}
              </Typography>
              {(data.irregularIncomeMonthly > 0 || data.unscheduledCommitted > 0 || hasOverdue) && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {[
                    data.irregularIncomeMonthly > 0 &&
                      fillTemplateNodes(t.irregularIncomeNote.value, {
                        amount: formatAmount(data.irregularIncomeMonthly),
                      }),
                    data.unscheduledCommitted > 0 &&
                      fillTemplateNodes(t.unscheduled.value, {
                        amount: formatAmount(data.unscheduledCommitted),
                      }),
                    hasOverdue && t.overdueAssumed.value,
                  ]
                    .filter(Boolean)
                    .map((part, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of notes
                      <span key={index}>
                        {index > 0 && ' · '}
                        {part}
                      </span>
                    ))}
                </Typography>
              )}
            </Box>
            <ForecastChart
              days={data.days}
              events={data.events}
              lowest={{ date: data.lowestBalanceDate, value: data.lowestBalance }}
              formatValue={formatAmount}
              formatTick={formatTick}
            />
          </Box>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: tokens.radius.md,
              bgcolor: 'background.paper',
              p: 3,
            }}
          >
            {/* The scenario is a narrow strip over the list it acts on, not a half-empty column. */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                }}
              >
                {t.upcoming}
              </Typography>
              <Box
                sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}
                aria-label={t.scenarios.value}
                role="group"
              >
                {(['incomeFactor', 'expenseFactor'] as const).map(key => (
                  <Select
                    key={key}
                    size="small"
                    value={scenario[key]}
                    onChange={event => setFactor(key, Number(event.target.value))}
                    inputProps={{ 'aria-label': t[key].value }}
                    sx={{ fontSize: 14 }}
                  >
                    {FACTORS.map(factor => (
                      <MenuItem key={factor} value={factor}>
                        {fill(t.factorOption.value, {
                          name: t[key].value,
                          percent: String(Math.round(factor * 100)),
                        })}
                      </MenuItem>
                    ))}
                  </Select>
                ))}
              </Box>
            </Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1, mb: 2 }}>
              {t.excludeHint}
            </Typography>
            <ForecastEvents
              events={listed}
              excluded={scenario.exclude}
              onToggle={toggleExcluded}
              formatAmount={formatAmount}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
