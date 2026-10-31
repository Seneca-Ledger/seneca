// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { CashFlowCard, typicalSpend } from '../CashFlowCard';
import { wholeLine } from './whole-line';

const chartProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());
const entriesMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/hooks/useDashboard', () => ({ useCashFlowEntries: entriesMock }));
const flowProps = vi.hoisted(() => vi.fn());
vi.mock('../CashFlowFlow', () => ({
  CashFlowFlow: (props: Record<string, unknown>) => {
    flowProps(props);
    return React.createElement('div', { 'data-testid': 'flow' });
  },
}));

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
    viewChart: value('Chart'),
    viewCalendar: value('Calendar'),
    viewLabel: value('View'),
    viewFlow: value('Flow'),
    viewAll: value('View all'),
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

  it('offers no period switch, only the chart, calendar and flow views', () => {
    render(
      <CashFlowCard
        formatAmount={String}
        activeMonth="2026-07"
        days={[day('2026-07-01', 1, 0)]}
      />,
    );

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Chart',
      'Calendar',
      'Flow',
    ]);
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

  describe('calendar view', () => {
    beforeEach(() => window.localStorage.clear());

    const days = [day('2026-07-01', 900, 4.5), day('2026-07-02', 0, 0), day('2026-07-03', 0, 468)];

    it('lays the same days out as a month, spending and income in each cell', () => {
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));

      expect(screen.queryByTestId('mock-chart')).toBeNull();
      const first = screen.getByRole('button', { name: 'July 1, −4.5, +900' });
      expect(first).toHaveTextContent('4.5');
      expect(first).toHaveTextContent('+900');
      // A day without money is only its number, and opens nothing.
      expect(screen.getByRole('button', { name: 'July 2' })).toBeDisabled();
    });

    it("opens a day's rows under the grid and closes them on a second click", () => {
      const rent = { date: '2026-07-03', name: 'Example Rentals', kind: 'expense', amount: 468, budgeted: 0 };
      entriesMock.mockReturnValue([rent]);
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));

      const third = screen.getByRole('button', { name: 'July 3, −468' });
      fireEvent.click(third);
      expect(third).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Example Rentals')).toBeInTheDocument();
      expect(screen.getByText('−468')).toBeInTheDocument();

      fireEvent.click(third);
      expect(screen.queryByText('Example Rentals')).toBeNull();
    });

    it('remembers the view in this browser', () => {
      const { unmount } = render(
        <CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
      unmount();

      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      expect(screen.queryByTestId('mock-chart')).toBeNull();
    });
  });

  describe('flow view', () => {
    beforeEach(() => {
      window.localStorage.clear();
      flowProps.mockClear();
    });

    const days = [day('2026-07-01', 900, 4.5)];

    it('asks for the flow only once picked, and links to the same month in Reports', () => {
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      expect(flowProps).not.toHaveBeenCalled();
      expect(screen.queryByText('View all')).toBeNull();

      fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));

      expect(screen.getByTestId('flow')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-chart')).toBeNull();
      expect(flowProps).toHaveBeenLastCalledWith(expect.objectContaining({ month: '2026-07' }));
      expect(screen.getByText('View all').closest('a')).toHaveAttribute(
        'href',
        '/reports?tab=cash-flow&from=2026-07-01&to=2026-07-31',
      );
    });

    it('comes back as the remembered view', () => {
      window.localStorage.setItem('seneca.cashFlowView', 'flow');
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      expect(screen.getByTestId('flow')).toBeInTheDocument();
    });
  });
});
