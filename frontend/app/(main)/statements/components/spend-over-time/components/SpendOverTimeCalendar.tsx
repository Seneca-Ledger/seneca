'use client';
import type { JSX } from 'react';
import { useMemo } from 'react';

import type { SpendOverTimeRecord } from '@/app/(main)/statements/components/spend-over-time.utils';
import { useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/analytics-common';

type Props = {
  records: SpendOverTimeRecord[];
  /** The month to render; the dashboard month strip owns it. */
  month: Date;
  currency: string;
  onDayClick: (period: string) => void;
  labels: {
    emptyMonth: string;
    operations: string;
  };
};

type CalendarDay = {
  iso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  records: SpendOverTimeRecord[];
  total: number;
  currencies: string[];
};

// 2024-01-01 is a Monday: the grid starts on Monday.
const getWeekdayLabels = (locale: string): string[] => {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 1 + index)));
};

const toDateOnly = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIso = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const getGridStart = (monthStart: Date): Date => {
  const day = monthStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() + diff);
};

const buildDayMap = (records: SpendOverTimeRecord[]) => {
  const map = new Map<string, SpendOverTimeRecord[]>();
  records.forEach(record => {
    const date = toDateOnly(record.dateValue || record.createdAt || null);
    if (!date) {
      return;
    }
    const iso = toIso(date);
    const current = map.get(iso) ?? [];
    current.push(record);
    map.set(iso, current);
  });
  return map;
};

export function SpendOverTimeCalendar({
  records,
  month,
  currency,
  onDayClick,
  labels,
}: Props): JSX.Element {
  const { locale } = useLocale();
  const weekdayLabels = useMemo(() => getWeekdayLabels(locale), [locale]);
  const agendaWeekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const compactFormatter = useMemo(() => {
    const cache = new Map<string, Intl.NumberFormat>();
    return (code: string): Intl.NumberFormat => {
      let formatter = cache.get(code);
      if (!formatter) {
        formatter = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: code,
          notation: 'compact',
          maximumFractionDigits: 1,
        });
        cache.set(code, formatter);
      }
      return formatter;
    };
  }, [locale]);

  const dayMap = useMemo(() => buildDayMap(records), [records]);

  const days = useMemo<CalendarDay[]>(() => {
    const monthStart = startOfMonth(month);
    const gridStart = getGridStart(monthStart);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const leadingDays = (monthStart.getDay() + 6) % 7;
    // Only the weeks the month touches: no trailing row made entirely of next month.
    const weeks = Math.ceil((leadingDays + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, index) => {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      );
      const iso = toIso(date);
      const dayRecords = [...(dayMap.get(iso) ?? [])].sort((a, b) => b.amount - a.amount);
      const currencies = Array.from(
        new Set(dayRecords.map(record => record.currencyValue).filter(Boolean)),
      );
      return {
        iso,
        dayNumber: date.getDate(),
        inCurrentMonth:
          date.getMonth() === monthStart.getMonth() &&
          date.getFullYear() === monthStart.getFullYear(),
        records: dayRecords,
        total: Number(dayRecords.reduce((sum, record) => sum + record.amount, 0).toFixed(2)),
        currencies,
      };
    });
  }, [dayMap, month]);

  const hasRecordsInMonth = days.some(day => day.inCurrentMonth && day.records.length > 0);

  const monthDaysWithItems = days.filter(day => day.inCurrentMonth && day.records.length > 0);

  return (
    <section className="lumio-spend-calendar">
      <div className="lumio-spend-calendar__grid lumio-spend-calendar__grid--weekdays">
        {weekdayLabels.map(label => (
          <div key={label} className="lumio-spend-calendar__weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="lumio-spend-calendar__grid">
        {days.map(day => {
          const hasItems = day.records.length > 0;
          const singleCurrency = day.currencies.length === 1 ? day.currencies[0] || currency : null;
          const totalLabel = singleCurrency
            ? formatMoney(day.total, singleCurrency)
            : `${day.records.length} ${labels.operations}`;

          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => hasItems && onDayClick(day.iso)}
              className={[
                'lumio-spend-calendar__day',
                hasItems ? 'lumio-spend-calendar__day--active' : '',
                day.inCurrentMonth ? '' : 'lumio-spend-calendar__day--outside',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="lumio-spend-calendar__day-number">{day.dayNumber}</span>
              {hasItems ? (
                <span className="lumio-spend-calendar__day-total">{totalLabel}</span>
              ) : null}

              {/* Phones: the cell is too narrow even for the plain total. */}
              {hasItems ? (
                <span className="lumio-spend-calendar__day-compact">
                  {singleCurrency
                    ? compactFormatter(singleCurrency).format(day.total)
                    : day.records.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Phones: the month's days with spending as a list under the grid. */}
      {monthDaysWithItems.length > 0 ? (
        <ul className="lumio-spend-calendar__agenda">
          {monthDaysWithItems.map(day => (
            <li key={day.iso}>
              <button
                type="button"
                className="lumio-spend-calendar__agenda-row"
                onClick={() => onDayClick(day.iso)}
              >
                <span className="lumio-spend-calendar__agenda-date">
                  <span className="lumio-spend-calendar__agenda-day">{day.dayNumber}</span>
                  <span className="lumio-spend-calendar__agenda-weekday">
                    {agendaWeekdayFormatter.format(parseIso(day.iso))}
                  </span>
                </span>
                <span className="lumio-spend-calendar__agenda-merchants">
                  {day.records.map(record => record.merchant || record.fileName).join(', ')}
                </span>
                <span className="lumio-spend-calendar__agenda-total">
                  {day.currencies.length === 1
                    ? formatMoney(day.total, day.currencies[0] || currency)
                    : `${day.records.length} ${labels.operations}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!hasRecordsInMonth ? (
        <div className="lumio-spend-calendar__empty">{labels.emptyMonth}</div>
      ) : null}
    </section>
  );
}
