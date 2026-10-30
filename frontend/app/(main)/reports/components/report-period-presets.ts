import { toDateInputValue } from './balance-sheet-utils';

export interface PeriodPreset {
  labelKey: string;
  fallback: string;
  /** [from, to], inclusive. */
  range: () => [Date, Date];
}

/** The named calendar periods: few enough to sit as tabs over the cash flow. */
export const QUICK_PERIOD_PRESETS: PeriodPreset[] = [
  {
    labelKey: 'presetThisMonth',
    fallback: 'This month',
    range: (): [Date, Date] => {
      const now = new Date();
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
    },
  },
  {
    labelKey: 'presetLastMonth',
    fallback: 'Last month',
    range: (): [Date, Date] => {
      const now = new Date();
      return [
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        // Day 0 of the current month is the last day of the previous one.
        new Date(now.getFullYear(), now.getMonth(), 0),
      ];
    },
  },
  {
    labelKey: 'presetThisQuarter',
    fallback: 'This quarter',
    range: (): [Date, Date] => {
      const now = new Date();
      return [new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), now];
    },
  },
  {
    labelKey: 'presetYearToDate',
    fallback: 'Year to date',
    range: (): [Date, Date] => {
      const now = new Date();
      return [new Date(now.getFullYear(), 0, 1), now];
    },
  },
];

/** `days` back from today, today included: "last 7 days" ends today. */
const lastDays = (days: number) => (): [Date, Date] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return [new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1)), today];
};

/** Every period a report offers: the calendar ones, then the rolling windows people ask for. */
export const PERIOD_PRESETS: PeriodPreset[] = [
  ...QUICK_PERIOD_PRESETS,
  { labelKey: 'presetLast7Days', fallback: 'Last 7 days', range: lastDays(7) },
  { labelKey: 'presetLast30Days', fallback: 'Last 30 days', range: lastDays(30) },
  { labelKey: 'presetLast90Days', fallback: 'Last 90 days', range: lastDays(90) },
  {
    labelKey: 'presetLast12Months',
    fallback: 'Last 12 months',
    range: (): [Date, Date] => {
      const now = new Date();
      return [new Date(now.getFullYear(), now.getMonth() - 11, 1), now];
    },
  },
  {
    labelKey: 'presetLastYear',
    fallback: 'Last year',
    range: (): [Date, Date] => {
      const year = new Date().getFullYear() - 1;
      return [new Date(year, 0, 1), new Date(year, 11, 31)];
    },
  },
];

/** Convenience for callers that just want the two input strings. */
export function presetRangeValues(preset: PeriodPreset): [string, string] {
  const [from, to] = preset.range();
  return [toDateInputValue(from), toDateInputValue(to)];
}
