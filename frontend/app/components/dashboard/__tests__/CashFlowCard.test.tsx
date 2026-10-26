// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { CashFlowCard, typicalSpend } from '../CashFlowCard';
import { wholeLine } from './whole-line';

const chartProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());
const entriesMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/hooks/useDashboard', () => ({ useCashFlowEntries: entriesMock }));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    chartProps(props);
    return React.createElement('div', { 'data-testid': 'mock-chart' });
  },
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
    title: value('Cash flow'),
    empty: value('No cash flow data yet'),
    income: value('Income'),
    expense: value('Expense'),
    budgeted: value('Budgeted'),
    noData: value('No data'),
  }),
  useLocale: () => ({ locale: 'en' }),
}));

const day = (date: string, income: number, expense: number, budgeted = 0) => ({
  date,
  income,
  expense,
  budgeted,
});

describe('CashFlowCard', () => {
  beforeEach(() => {
    chartProps.mockClear();
    entriesMock.mockReset();
    entriesMock.mockReturnValue(undefined);
  });

  it("hands the chart the month's named rows grouped by day", () => {
    const coffee = { date: '2026-07-01', name: 'ACME Coffee', kind: 'expense', amount: 4.5, budgeted: 0 };
    const salary = { date: '2026-07-01', name: 'Member One', kind: 'income', amount: 900, budgeted: 0 };
    const rent = { date: '2026-07-03', name: 'Example Rentals', kind: 'expense', amount: 468, budgeted: 0 };
    entriesMock.mockReturnValue([salary, coffee, rent]);

    render(
      <CashFlowCard
        formatAmount={String}
        activeMonth="2026-07"
        days={[day('2026-07-01', 900, 4.5), day('2026-07-03', 0, 468)]}
      />,
    );

    expect(entriesMock).toHaveBeenCalledWith('2026-07');
    const [props] = chartProps.mock.calls.at(-1) ?? [];
    const byDay = props?.entriesByDay as Map<string, unknown[]>;
    expect(byDay.get('2026-07-01')).toEqual([salary, coffee]);
    expect(byDay.get('2026-07-03')).toEqual([rent]);
  });

  it("charts the picked month day by day and sums its days in the headline", () => {
    const days = [day('2026-07-01', 900, 100), day('2026-07-02', 0, 0), day('2026-07-03', 80, 468)];

    render(<CashFlowCard formatAmount={v => `$${v}`} activeMonth="2026-07" days={days} />);

    expect(screen.getByText('Jul 2026')).toBeInTheDocument();
    expect(screen.getByText('$412')).toBeInTheDocument();
    expect(screen.getByText(wholeLine('Income $980'))).toBeInTheDocument();
    expect(screen.getByText(wholeLine('Expense $568'))).toBeInTheDocument();
    const [props] = chartProps.mock.calls.at(-1) ?? [];
    expect(props?.points).toEqual(days);
  });

  it("sums the month's budgeted spending in the legend and names it for the chart", () => {
    const days = [day('2026-10-03', 0, 60, 60), day('2026-10-09', 0, 70, 40), day('2026-10-12', 0, 20)];

    render(<CashFlowCard formatAmount={v => `$${v}`} activeMonth="2026-10" days={days} />);

    expect(screen.getByText(wholeLine('Expense $150'))).toBeInTheDocument();
    expect(screen.getByText(wholeLine('Budgeted $100'))).toBeInTheDocument();
    const [props] = chartProps.mock.calls.at(-1) ?? [];
    expect(props?.labels).toMatchObject({ budgeted: 'Budgeted' });
  });

  it('leaves Budgeted out of the legend when no budget covered any spending', () => {
    render(
      <CashFlowCard
        formatAmount={v => `$${v}`}
        activeMonth="2026-10"
        days={[day('2026-10-03', 0, 60)]}
      />,
    );

    expect(screen.queryByText(/Budgeted/)).not.toBeInTheDocument();
  });

  it('on a phone charts the days so far as wide bars to swipe through', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 2, 12));
    const matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    const soFar = [day('2026-07-01', 900, 100), day('2026-07-02', 80, 0)];

    try {
      render(
        <CashFlowCard
          formatAmount={String}
          activeMonth="2026-07"
          days={[...soFar, day('2026-07-03', 0, 0)]}
        />,
      );

      const [props] = chartProps.mock.calls.at(-1) ?? [];
      expect(props).toMatchObject({ points: soFar, everyDay: true });
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("tops the scale at the month's income rounded up, from the typical day's spend", () => {
    const days = [
      day('2026-10-02', 810, 0),
      day('2026-10-12', 0, 4),
      day('2026-10-16', 1132, 11),
    ];

    render(<CashFlowCard formatAmount={String} activeMonth="2026-10" days={days} />);

    const [props] = chartProps.mock.calls.at(-1) ?? [];
    expect(props).toMatchObject({ ceiling: 2000, typical: 7.5 });
  });

  it('takes the middle of the days with spending as the typical spend', () => {
    expect(typicalSpend([day('2026-10-01', 0, 3), day('2026-10-02', 500, 0), day('2026-10-03', 0, 40), day('2026-10-04', 0, 15)])).toBe(15);
    expect(typicalSpend([day('2026-10-01', 500, 0)])).toBe(0);
  });

  it('offers no period switch', () => {
    render(
      <CashFlowCard
        formatAmount={String}
        activeMonth="2026-07"
        days={[day('2026-07-01', 1, 0)]}
      />,
    );

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows a loss with a typographic minus', () => {
    render(
      <CashFlowCard
        formatAmount={v => `$${v}`}
        activeMonth="2026-07"
        days={[day('2026-07-05', 100, 250)]}
      />,
    );

    expect(screen.getByText('−$150')).toBeInTheDocument();
  });

  it('shows the empty state instead of a chart when the month has no money in or out', () => {
    const { container } = render(
      <CashFlowCard
        formatAmount={v => `$${v}`}
        activeMonth="2026-07"
        days={[day('2026-07-01', 0, 0), day('2026-07-02', 0, 0)]}
      />,
    );

    expect(container.querySelector('.seneca-chart__total')?.textContent).toBe('$0');
    expect(screen.getByText('No cash flow data yet')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument();
  });
});
