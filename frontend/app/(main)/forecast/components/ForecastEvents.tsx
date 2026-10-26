'use client';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { ForecastEvent, ForecastEventKind } from '../hooks/useForecast';

const KIND_KEYS: Record<ForecastEventKind, string> = {
  payable: 'kindPayable',
  subscription: 'kindSubscription',
  invoice: 'kindInvoice',
  goal: 'kindGoal',
  income: 'kindIncome',
  scenario: 'kindScenario',
};

const DAY_MS = 86_400_000;

interface ForecastEventsProps {
  events: ForecastEvent[];
  excluded: string[];
  onToggle: (sourceId: string) => void;
  formatAmount: (value: number) => string;
  limit?: number;
  /** "Today" for grouping; the reader's own day unless a test pins it. */
  today?: Date;
}

/**
 * The next seven days as "This week" (overdue items fall here too, being due
 * now), then a group per month. Fifteen undivided rows read as a feed.
 */
function groupKey(date: string, today: Date): string {
  const day = new Date(`${date}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return day.getTime() < start.getTime() + 7 * DAY_MS ? 'week' : date.slice(0, 7);
}

/**
 * The dated items behind the curve, each with a checkbox: unticking one
 * asks "what if without it" and the curve answers.
 */
export function ForecastEvents({
  events,
  excluded,
  onToggle,
  formatAmount,
  limit = 40,
  today = new Date(),
}: ForecastEventsProps) {
  const t = useIntlayer('forecastPage');
  const { locale } = useLocale();
  // Excluded sources are gone from the response, so they are listed from memory to allow re-ticking.
  const rows = events.slice(0, limit);
  const groups: Array<{ key: string; events: ForecastEvent[] }> = [];
  for (const event of rows) {
    const key = groupKey(event.date, today);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.events.push(event);
    } else {
      groups.push({ key, events: [event] });
    }
  }
  const monthTitle = (key: string): string =>
    new Intl.DateTimeFormat(resolveLocaleTag(locale), {
      month: 'long',
      ...(Number(key.slice(0, 4)) === today.getFullYear() ? {} : { year: 'numeric' }),
    }).format(new Date(`${key}-01T00:00:00`));

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2.5 }}>
      {groups.map(group => (
        <Box key={group.key} component="section">
          <Typography
            component="h3"
            variant="caption"
            sx={{
              display: 'block',
              color: 'text.secondary',
              pb: 0.75,
              mb: 0.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {group.key === 'week' ? t.thisWeek : monthTitle(group.key)}
          </Typography>
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
            }}
          >
            {group.events.map(event => {
              const included = !excluded.includes(event.sourceId);
              return (
                <Box
                  component="li"
                  key={`${event.sourceId}:${event.date}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.5,
                    // Left out of the scenario: the row stays, faded, to be ticked back.
                    opacity: included ? 1 : 0.45,
                    transition: 'opacity 150ms ease',
                  }}
                >
                  <Checkbox
                    size="small"
                    className="seneca-forecast-check"
                    checked={included}
                    onChange={() => onToggle(event.sourceId)}
                    disabled={event.kind === 'scenario'}
                    slotProps={{
                      input: { 'aria-label': event.label },
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {event.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {formatStoredDateWithOptions(event.date, { day: 'numeric', month: 'short' })}
                      {' · '}
                      {t[KIND_KEYS[event.kind] as 'kindPayable']}
                      {event.isOverdue ? (
                        <>
                          {' · '}
                          <span className="seneca-forecast-overdue">{t.overdue}</span>
                        </>
                      ) : null}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    className={PRIVATE_CLASS}
                    sx={{
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                      color: event.amount > 0 ? 'var(--money-up)' : 'text.primary',
                    }}
                  >
                    {event.amount > 0 ? '+' : '−'}
                    {formatAmount(Math.abs(event.amount))}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
