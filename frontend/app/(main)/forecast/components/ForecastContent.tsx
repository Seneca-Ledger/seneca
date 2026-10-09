'use client';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { UnconfirmedNotice } from '@/app/components/review/UnconfirmedNotice';
import { EmptyState } from '@/app/components/ui/EmptyState';
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
  value: string;
  note?: string;
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
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ color: tone ? `${tone}.main` : 'text.primary' }}
      >
        {value}
      </Typography>
      {note && (
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      )}
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
  const formatAmount = (value: number) => formatMoney(value, currency, locale);
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
  const isEmpty =
    data !== null &&
    data.events.length === 0 &&
    data.everydayMonthly === 0 &&
    data.openingBalance === 0;

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 3, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t.subtitle}
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={horizon}
          onChange={(_event, next: ForecastHorizon | null) => next && setHorizon(next)}
          aria-label={t.title.value}
        >
          {FORECAST_HORIZONS.map(option => (
            <ToggleButton key={option} value={option} sx={{ px: 1.5, textTransform: 'none' }}>
              {option}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <UnconfirmedNotice style={{ marginBottom: 16 }} />

      {isPending && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Skeleton variant="rounded" height={96} sx={{ borderRadius: tokens.radius.md }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: tokens.radius.md }} />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ py: 2, textAlign: 'center' }}>
          {t.error}
        </Typography>
      )}

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
                tone={data.runwayMonths !== null && data.runwayMonths < 3 ? 'error' : undefined}
              />
            ) : (
              <Kpi
                label={t.safeToSpend.value}
                value={formatAmount(data.safeToSpend.amount)}
                note={fill(
                  (data.safeToSpend.nextIncomeDate ? t.safeUntilPayday : t.safeUntil).value,
                  { date: formatDate(data.safeToSpend.untilDate) },
                )}
                tone={data.safeToSpend.amount > 0 ? 'success' : 'error'}
              />
            )}
            <Kpi
              label={t.lowestBalance.value}
              value={formatAmount(data.lowestBalance)}
              note={fill(t.onDate.value, { date: formatDate(data.lowestBalanceDate) })}
              tone={data.lowestBalance < 0 ? 'error' : undefined}
            />
            <Kpi
              label={t.shortfall.value}
              value={
                data.shortfallDate
                  ? fill(t.shortfallOn.value, { date: formatDate(data.shortfallDate) })
                  : t.noShortfall.value
              }
              tone={data.shortfallDate ? 'error' : 'success'}
            />
            <Kpi
              label={fill(t.closingBalance.value, { days: String(data.horizonDays) })}
              value={formatAmount(data.closingBalance)}
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
            <ForecastChart days={data.days} formatValue={formatAmount} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {fill(t.everydayNote.value, {
                amount: formatAmount(data.everydayMonthly),
                months: String(data.monthsObserved),
              })}
              {data.irregularIncomeMonthly > 0 &&
                ` · ${fill(t.irregularIncomeNote.value, { amount: formatAmount(data.irregularIncomeMonthly) })}`}
              {data.unscheduledCommitted > 0 &&
                ` · ${fill(t.unscheduled.value, { amount: formatAmount(data.unscheduledCommitted) })}`}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' },
              gap: 3,
            }}
          >
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: tokens.radius.md,
                bgcolor: 'background.paper',
                p: 3,
                display: 'grid',
                gap: 2,
                alignContent: 'start',
              }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                {t.scenarios}
              </Typography>
              {(['incomeFactor', 'expenseFactor'] as const).map(key => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {t[key]}
                  </Typography>
                  <Select
                    size="small"
                    value={scenario[key]}
                    onChange={event => setFactor(key, Number(event.target.value))}
                    inputProps={{ 'aria-label': t[key].value }}
                  >
                    {FACTORS.map(factor => (
                      <MenuItem key={factor} value={factor}>
                        {Math.round(factor * 100)}%
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary">
                {t.excludeHint}
              </Typography>
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
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                {t.upcoming}
              </Typography>
              <ForecastEvents
                events={listed}
                excluded={scenario.exclude}
                onToggle={toggleExcluded}
                formatAmount={formatAmount}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
