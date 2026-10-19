// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { DATA_HEALTH_HISTORY_METRICS, MonthlyHistoryCard } from '../MonthlyHistoryCard';

const chartProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());
const hooksMock = vi.hoisted(() => ({ useDashboardHealthHistory: vi.fn() }));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    chartProps(props);
    return React.createElement('div', { 'data-testid': 'mock-chart' });
  },
}));

vi.mock('@/app/hooks/useDashboard', () => ({
  useDashboardHealthHistory: hooksMock.useDashboardHealthHistory,
}));

// Mirrors react-intlayer's renderIntlayerNode: usable as a JSX child and via `.value`.
const value = (v: string) =>
  // biome-ignore lint/complexity/noUselessFragments: Proxy needs an object target — a bare string can't be proxied
  new Proxy(<>{v}</>, {
    get(target, prop, receiver) {
      if (prop === 'value') return v;
      return Reflect.get(target, prop, receiver);
    },
  });

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    title: value('By month'),
    subtitle: value('{year} · {transactions} transactions · {statements} statements'),
    empty: value('No activity in {year}'),
    uncategorized: value('Uncategorized'),
    statementErrors: value('Statement errors'),
    statementsPendingReview: value('Records to review'),
    legendPeriod: value('In {year}:'),
    allClear: value('Nothing to fix in {year}'),
    statementsPendingSubmit: value('Not submitted'),
    receiptsPendingReview: value('Receipts to review'),
    parsingWarnings: value('Parsing warnings'),
    overduePayments: value('Overdue payments'),
  }),
  useLocale: () => ({ locale: 'en' }),
}));

const month = (key: string, counts: Record<string, number> = {}) => ({
  month: key,
  transactions: 0,
  uncategorized: 0,
  statementsUploaded: 0,
  statementErrors: 0,
  statementsPendingReview: 0,
  statementsPendingSubmit: 0,
  parsingWarnings: 0,
  receiptsPendingReview: 0,
  overduePayments: 0,
  ...counts,
});

const loaded = (months: ReturnType<typeof month>[]) => ({
  data: { year: 2026, months },
  isPending: false,
  error: null,
});

describe('MonthlyHistoryCard', () => {
  beforeEach(() => {
    chartProps.mockClear();
    hooksMock.useDashboardHealthHistory.mockReset();
  });

  it('sums the year and charts every month with the picked month active, in one hue', () => {
    hooksMock.useDashboardHealthHistory.mockReturnValue(
      loaded([
        month('2026-01', { transactions: 5, statementsUploaded: 1, uncategorized: 2, statementErrors: 1 }),
        month('2026-02', { transactions: 3, uncategorized: 1 }),
        month('2026-03', { uncategorized: 1 }),
      ]),
    );

    render(
      <MonthlyHistoryCard
        displayMonth={new Date(2026, 1, 1)}
        metrics={DATA_HEALTH_HISTORY_METRICS}
        onSelectMonth={vi.fn()}
      />,
    );

    expect(hooksMock.useDashboardHealthHistory).toHaveBeenCalledWith(2026);
    expect(screen.getByText('2026 · 8 transactions · 1 statements')).toBeInTheDocument();
    expect(screen.getByText('In 2026:')).toBeInTheDocument();
    expect(screen.getByText('Uncategorized').parentElement).toHaveTextContent('Uncategorized4');
    // A queue with nothing in the year is neither drawn nor listed.
    expect(screen.queryByText('Parsing warnings')).toBeNull();
    expect(screen.getByText('Statement errors').parentElement).toHaveTextContent(
      'Statement errors1',
    );
    const [props] = chartProps.mock.calls.at(-1) ?? [];
    expect(props?.activeMonth).toBe('2026-02');
    const series = props?.series as Array<{ key: string; color: string; opacity: number }>;
    expect(series.map(item => item.key)).toEqual(['uncategorized', 'statementErrors']);
    expect(new Set(series.map(item => item.color)).size).toBe(1);
    expect(series[0].opacity).toBeGreaterThan(series[1].opacity);
    expect(props?.points).toHaveLength(3);
  });

  it('opens a month picked on the chart', () => {
    hooksMock.useDashboardHealthHistory.mockReturnValue(
      loaded([
        month('2026-01', { uncategorized: 1 }),
        month('2026-02', { uncategorized: 1 }),
        month('2026-03', { uncategorized: 1 }),
      ]),
    );
    const onSelectMonth = vi.fn();

    render(
      <MonthlyHistoryCard
        displayMonth={new Date(2026, 1, 1)}
        metrics={DATA_HEALTH_HISTORY_METRICS}
        onSelectMonth={onSelectMonth}
      />,
    );
    const [props] = chartProps.mock.calls.at(-1) ?? [];
    (props?.onSelectMonth as (month: string) => void)('2026-01');

    expect(onSelectMonth).toHaveBeenCalledWith(2026, 0);
  });

  it('shows the empty state for a year without activity', () => {
    hooksMock.useDashboardHealthHistory.mockReturnValue(loaded([month('2026-01')]));

    render(
      <MonthlyHistoryCard
        displayMonth={new Date(2026, 0, 1)}
        metrics={DATA_HEALTH_HISTORY_METRICS}
        onSelectMonth={vi.fn()}
      />,
    );

    expect(screen.getByText('No activity in 2026')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument();
  });

  it('writes one or two busy months as a line instead of a chart of empty months', () => {
    hooksMock.useDashboardHealthHistory.mockReturnValue(
      loaded([
        month('2026-09', { uncategorized: 1 }),
        month('2026-10', { uncategorized: 6, statementsPendingReview: 2 }),
      ]),
    );
    const onSelectMonth = vi.fn();

    render(
      <MonthlyHistoryCard
        displayMonth={new Date(2026, 9, 1)}
        metrics={DATA_HEALTH_HISTORY_METRICS}
        onSelectMonth={onSelectMonth}
      />,
    );

    expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'October: 8' }).click();
    expect(screen.getByRole('button', { name: 'September: 1' })).toBeInTheDocument();
    expect(onSelectMonth).toHaveBeenCalledWith(2026, 9);
  });

  it('says the year is clear when it had activity and nothing to fix', () => {
    hooksMock.useDashboardHealthHistory.mockReturnValue(
      loaded([month('2026-01', { transactions: 4 })]),
    );

    render(
      <MonthlyHistoryCard
        displayMonth={new Date(2026, 0, 1)}
        metrics={DATA_HEALTH_HISTORY_METRICS}
        onSelectMonth={vi.fn()}
      />,
    );

    expect(screen.getByText('Nothing to fix in 2026')).toBeInTheDocument();
  });
});
