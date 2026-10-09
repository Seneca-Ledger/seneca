import {
  DEFAULT_STATEMENT_FILTERS,
  type StatementFilterDate,
  type StatementFilterDatePreset,
  type StatementFilters,
} from '@/app/(main)/statements/components/filters/statement-filters';

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/**
 * The two months advice is ever about, as the presets the filter chip names:
 * a raw range would read as "On" there, which says nothing.
 */
const PRESET_BY_MONTHS_BACK: Record<number, StatementFilterDatePreset> = {
  0: 'thisMonth',
  1: 'lastMonth',
};

type ParsedMonth = { year: number; monthIndex: number };

function parseMonth(month: string | null | undefined): ParsedMonth | null {
  const match = MONTH_PATTERN.exec(month ?? '');
  if (!match) {
    return null;
  }
  const monthIndex = Number(match[2]) - 1;
  return monthIndex >= 0 && monthIndex <= 11 ? { year: Number(match[1]), monthIndex } : null;
}

/** A whole month as an inclusive range, for months no preset covers. */
function explicitRange({ year, monthIndex }: ParsedMonth): StatementFilterDate {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const month = pad(monthIndex + 1);
  return {
    mode: 'on',
    date: `${year}-${month}-01`,
    dateTo: `${year}-${month}-${pad(new Date(year, monthIndex + 1, 0).getDate())}`,
  };
}

/**
 * The filters a page should open with when a link names a month.
 *
 * Advice quotes one month ("{{count}} visits this month"), while these pages
 * aggregate everything they have; without this the highlighted row shows an
 * all-time total the advice never claimed. Returns null for anything that is
 * not a `YYYY-MM`, so a hand-written insight cannot empty the page.
 */
export function monthDeepLinkFilters(
  month: string | null | undefined,
  now: Date = new Date(),
): StatementFilters | null {
  const parsed = parseMonth(month);
  if (!parsed) {
    return null;
  }
  const monthsBack = (now.getFullYear() - parsed.year) * 12 + (now.getMonth() - parsed.monthIndex);
  const preset = PRESET_BY_MONTHS_BACK[monthsBack];
  return {
    ...DEFAULT_STATEMENT_FILTERS,
    date: preset ? { preset } : explicitRange(parsed),
  };
}
