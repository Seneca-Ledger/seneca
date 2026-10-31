'use client';

import clsx from 'clsx';
import type React from 'react';
import { useMemo, useState } from 'react';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import type { DashboardCashFlowEntry, DashboardCashFlowPoint } from '@/app/hooks/useDashboard';
import { useLocale } from '@/app/i18n';
import { ListRow } from './ui';

interface CashFlowCalendarProps {
  /** The month's days, one point a day, already in the workspace currency. */
  days: DashboardCashFlowPoint[];
  /** The rows behind each day, once loaded. */
  entriesByDay: Map<string, DashboardCashFlowEntry[]> | undefined;
  formatAmount: (value: number) => string;
}

/** Shades of the heat scale: one sage, five steps of strength. */
const HEAT_LEVELS = 5;

/**
 * A day's step on the heat scale, by where its spending ranks among the
 * month's days (quantiles), not by its share of the largest: one big day would
 * otherwise leave every other day the same pale shade.
 */
export function heatLevel(total: number, sortedTotals: number[]): number {
  if (sortedTotals.length === 0 || total <= 0) {
    return 0;
  }
  const below = sortedTotals.filter(value => value < total).length;
  const rank = sortedTotals.length > 1 ? below / (sortedTotals.length - 1) : 1;
  return Math.min(HEAT_LEVELS, Math.floor(rank * HEAT_LEVELS) + 1);
}

const toIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseIso = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** The weeks the month touches, Monday first; days of the neighbouring months are null. */
function monthGrid(firstDay: string): Array<string | null> {
  const start = parseIso(firstDay);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const leading = (start.getDay() + 6) % 7;
  const weeks = Math.ceil((leading + daysInMonth) / 7);
  return Array.from({ length: weeks * 7 }, (_, index) => {
    const day = index - leading + 1;
    return day >= 1 && day <= daysInMonth
      ? toIso(new Date(start.getFullYear(), start.getMonth(), day))
      : null;
  });
}

/**
 * The cash flow card's month as a calendar: each day's spending on the heat
 * scale and its income beside it, so the rhythm of the week shows. The same
 * points as the bars, so both views always agree. A day opens its rows.
 */
export function CashFlowCalendar({
  days,
  entriesByDay,
  formatAmount,
}: CashFlowCalendarProps): React.JSX.Element | null {
  const { locale } = useLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2024-01-01 is a Monday.
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 1 + index)));
  }, [locale]);
  const dayName = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }),
    [locale],
  );

  if (days.length === 0) {
    return null;
  }
  const byDate = new Map(days.map(day => [day.date, day]));
  const sortedTotals = days
    .map(day => day.expense)
    .filter(value => value > 0)
    .sort((a, b) => a - b);
  const today = toIso(new Date());
  const selectedEntries = selected ? (entriesByDay?.get(selected) ?? []) : [];

  return (
    <section className="seneca-spend-calendar">
      <div className="seneca-spend-calendar__grid seneca-spend-calendar__grid--weekdays">
        {weekdays.map(label => (
          <div key={label} className="seneca-spend-calendar__weekday">
            {label}
          </div>
        ))}
      </div>
      <div className="seneca-spend-calendar__grid">
        {monthGrid(`${days[0].date.slice(0, 7)}-01`).map((iso, index) => {
          if (!iso) {
            // biome-ignore lint/suspicious/noArrayIndexKey: blank cells have no other identity
            return <div key={`blank-${index}`} aria-hidden />;
          }
          const point = byDate.get(iso);
          const expense = point?.expense ?? 0;
          const income = point?.income ?? 0;
          const hasMoney = expense > 0 || income > 0;
          const level = heatLevel(expense, sortedTotals);
          return (
            <button
              key={iso}
              type="button"
              disabled={!hasMoney}
              aria-pressed={selected === iso}
              // The cell's spans would run together ("14.5+900"); say the day and its money plainly.
              aria-label={[
                dayName.format(parseIso(iso)),
                expense > 0 && `−${formatAmount(expense)}`,
                income > 0 && `+${formatAmount(income)}`,
              ]
                .filter(Boolean)
                .join(', ')}
              onClick={() => setSelected(current => (current === iso ? null : iso))}
              data-heat={level || undefined}
              className={clsx(
                'seneca-spend-calendar__day',
                hasMoney && 'seneca-spend-calendar__day--active',
                iso === today && 'seneca-spend-calendar__day--today',
                selected === iso && 'seneca-spend-calendar__day--selected',
              )}
            >
              <span className="seneca-spend-calendar__day-number">{parseIso(iso).getDate()}</span>
              {expense > 0 && (
                <span className={clsx('seneca-spend-calendar__day-total', PRIVATE_CLASS)}>
                  {formatAmount(expense)}
                </span>
              )}
              {income > 0 && (
                <span
                  className={clsx(
                    'seneca-spend-calendar__day-total seneca-spend-calendar__day-income',
                    PRIVATE_CLASS,
                  )}
                >
                  +{formatAmount(income)}
                </span>
              )}
              {/* Phones: the totals above are hidden and this one shows. */}
              {expense > 0 && (
                <span className={clsx('seneca-spend-calendar__day-compact', PRIVATE_CLASS)}>
                  {formatAmount(expense)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && selectedEntries.length > 0 && (
        <div className="seneca-dashboard__list seneca-spend-calendar__day-entries">
          {selectedEntries.map((entry, index) => (
            <ListRow
              // biome-ignore lint/suspicious/noArrayIndexKey: a day may hold two rows alike
              key={`${entry.name}-${index}`}
              primary={entry.name}
              trailing={
                <PrivateAmount>
                  {`${entry.kind === 'income' ? '+' : '−'}${formatAmount(entry.amount)}`}
                </PrivateAmount>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
