'use client';

import type React from 'react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Chip, ChipGroup } from '@/app/components/dashboard/ui';
import { ChevronLeft, ChevronRight } from '@/app/components/icons';
import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import {
  NEXT_MONTH_BINDING,
  PREVIOUS_MONTH_BINDING,
  SHORTCUT_NEXT_MONTH,
  SHORTCUT_PREVIOUS_MONTH,
} from '@/app/lib/keyboard-shortcuts';
import { resolveLocale } from '../helpers/dashboard-helpers';
import { isFutureMonth } from '../helpers/dashboard-url-state';

export interface MonthStripLabels {
  group: string;
  previousYear: string;
  nextYear: string;
}

export interface MonthStripProps {
  displayMonth: Date;
  onChange: (year: number, month: number) => void;
  locale: string;
  labels: MonthStripLabels;
  /** Injectable clock for tests. */
  now?: Date;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index);

/** Widgets that already move with the arrow keys keep them; so does anything over the page. */
const ARROW_OWNERS = [
  '[role="tab"]',
  '[role="slider"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="radiogroup"]',
  '[role="grid"]',
  '[role="application"]',
  '[role="dialog"]',
  '.MuiModal-root',
].join(',');

function arrowsOwnedElsewhere(event: KeyboardEvent): boolean {
  const target = event.target;
  return event.defaultPrevented || (target instanceof Element && !!target.closest(ARROW_OWNERS));
}

function useMonthNames(locale: string): string[] {
  return useMemo(() => {
    const formatter = new Intl.DateTimeFormat(resolveLocale(locale), { month: 'short' });
    return MONTHS.map(month => formatter.format(new Date(2000, month, 1)));
  }, [locale]);
}

/**
 * Jan…Dec chips for one year plus a ‹ year › stepper; future months are disabled.
 * ← and → step one month, as do the command palette's month rows.
 */
export function MonthStrip({
  displayMonth,
  onChange,
  locale,
  labels,
  now,
}: MonthStripProps): React.JSX.Element {
  // A fresh Date per render made every chip's "future" check a new input and
  // kept the strip from ever being memoized; resolve it once per mount.
  const [mountedAt] = useState(() => new Date());
  const today = now ?? mountedAt;
  const year = displayMonth.getFullYear();
  const activeMonth = displayMonth.getMonth();
  const monthNames = useMonthNames(locale);
  const groupRef = useRef<HTMLDivElement>(null);

  // Keep the active chip visible when the strip scrolls horizontally (mobile).
  useEffect(() => {
    const group = groupRef.current;
    const chip = group?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!(group && chip) || group.scrollWidth <= group.clientWidth) {
      return;
    }
    group.scrollLeft = chip.offsetLeft - group.clientWidth / 2 + chip.offsetWidth / 2;
  }, [activeMonth, year]);

  const stepMonth = (delta: number): void => {
    const target = new Date(year, activeMonth + delta, 1);
    if (!isFutureMonth(target.getFullYear(), target.getMonth(), today)) {
      onChange(target.getFullYear(), target.getMonth());
    }
  };

  useKeyboardShortcuts({
    [PREVIOUS_MONTH_BINDING]: event => {
      if (!arrowsOwnedElsewhere(event)) {
        event.preventDefault();
        stepMonth(-1);
      }
    },
    [NEXT_MONTH_BINDING]: event => {
      if (!arrowsOwnedElsewhere(event)) {
        event.preventDefault();
        stepMonth(1);
      }
    },
  });

  // The command palette's "Previous month" / "Next month" rows.
  const onPaletteStep = useEffectEvent((delta: number) => stepMonth(delta));
  useEffect(() => {
    const previous = (): void => onPaletteStep(-1);
    const next = (): void => onPaletteStep(1);
    window.addEventListener(SHORTCUT_PREVIOUS_MONTH, previous);
    window.addEventListener(SHORTCUT_NEXT_MONTH, next);
    return () => {
      window.removeEventListener(SHORTCUT_PREVIOUS_MONTH, previous);
      window.removeEventListener(SHORTCUT_NEXT_MONTH, next);
    };
  }, []);

  const stepYear = (delta: number): void => {
    const nextYear = year + delta;
    const month = isFutureMonth(nextYear, activeMonth, today) ? today.getMonth() : activeMonth;
    onChange(nextYear, month);
  };

  return (
    <div className="seneca-dashboard__month-strip">
      <ChipGroup
        ref={groupRef}
        scroll
        aria-label={labels.group}
        className="seneca-dashboard__month-chips"
      >
        {MONTHS.map(month => {
          const future = isFutureMonth(year, month, today);
          return (
            <Chip
              key={month}
              active={month === activeMonth}
              disabled={future}
              muted={future}
              onClick={() => onChange(year, month)}
            >
              {monthNames[month]}
            </Chip>
          );
        })}
      </ChipGroup>
      <div className="seneca-dashboard__year-stepper">
        <button
          type="button"
          className="seneca-dashboard__year-btn"
          aria-label={labels.previousYear}
          onClick={() => stepYear(-1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="seneca-dashboard__year-value">{year}</span>
        <button
          type="button"
          className="seneca-dashboard__year-btn"
          aria-label={labels.nextYear}
          disabled={year >= today.getFullYear()}
          onClick={() => stepYear(1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
