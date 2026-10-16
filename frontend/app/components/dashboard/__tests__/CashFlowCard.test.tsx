// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { CashFlowCard } from '../CashFlowCard';

const chartProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());
const hooksMock = vi.hoisted(() => ({ useDashboardCashFlow: vi.fn() }));
const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));
const searchMock = vi.hoisted(() => ({ query: '' }));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    chartProps(props);
    return React.createElement('div', { 'data-testid': 'mock-chart' });
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(searchMock.query),
}));

vi.mock('@/app/hooks/useDashboard', () => ({
  useDashboardCashFlow: hooksMock.useDashboardCashFlow,
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
    net: value('Net'),
    noData: value('No data'),
    rangeAll: value('All time'),
    range5y: value('5 years'),
    range12m: value('12 mo'),
    rangeThisYear: value('This year'),
  }),
  useLocale: () => ({ locale: 'en' }),
}));

const loaded = (points: Array<{ month: string; income: number; expense: number }>) => ({
  data: {
    range: '12m',
    currency: 'USD',
    since: '2025-08-01',
    endDate: '2026-08-31',
    totals: {
      income: points.reduce((sum, p) => sum + p.income, 0),
      expense: points.reduce((sum, p) => sum + p.expense, 0),
      net: points.reduce((sum, p) => sum + p.income - p.expense, 0),
    },
    points: points.map(p => ({ ...p, net: p.income - p.expense })),
  },
  isPending: false,
  error: null,
});

describe('CashFlowCard', () => {
  beforeEach(() => {
    chartProps.mockClear();
    routerMock.replace.mockClear();
    hooksMock.useDashboardCashFlow.mockReset();
    searchMock.query = 'tab=trends';
  });

  it('shows the net total without a plus and the income/expense split', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue(
      loaded([
        { month: '2025-08', income: 30000, expense: 10000 },
        { month: '2026-08', income: 14141, expense: 7410 },
      ]),
    );

    render(<CashFlowCard formatAmount={v => `$${v}`} />);

    expect(screen.getByText('$26731')).toBeInTheDocument();
    expect(screen.getByText('Income $44141')).toBeInTheDocument();
    expect(screen.getByText('Expense $17410')).toBeInTheDocument();
    const [props] = chartProps.mock.calls.at(-1) ?? [];
    expect((props?.points as unknown[]).length).toBe(2);
  });

  it('ends the period at the picked month and shows that month alone in the headline', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue(
      loaded([
        { month: '2026-06', income: 900, expense: 100 },
        { month: '2026-07', income: 980, expense: 568 },
      ]),
    );

    render(<CashFlowCard formatAmount={v => `$${v}`} activeMonth="2026-07" />);

    expect(hooksMock.useDashboardCashFlow).toHaveBeenLastCalledWith('12m', '2026-07');
    expect(screen.getByText('$412')).toBeInTheDocument();
    expect(screen.getByText('Income $980')).toBeInTheDocument();
    expect(screen.getByText('Expense $568')).toBeInTheDocument();
    expect(screen.getByText('Jul 2026')).toBeInTheDocument();
  });

  it('shows zeros for a picked month with no row in the series', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue(loaded([]));

    render(<CashFlowCard formatAmount={v => `$${v}`} activeMonth="2026-07" />);

    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('Income $0')).toBeInTheDocument();
  });

  it('passes the picked month and the month picker through to the chart', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue(
      loaded([
        { month: '2026-02', income: 1, expense: 0 },
        { month: '2026-03', income: 2, expense: 1 },
      ]),
    );
    const onSelectMonth = vi.fn();

    render(<CashFlowCard formatAmount={String} activeMonth="2026-03" onSelectMonth={onSelectMonth} />);

    const [props] = chartProps.mock.calls.at(-1) ?? [];
    expect(props).toMatchObject({ activeMonth: '2026-03', onSelectMonth });
  });

  it('defaults to 12 months and reads the range from ?cf=', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue(loaded([]));

    const { unmount } = render(<CashFlowCard formatAmount={String} />);
    expect(hooksMock.useDashboardCashFlow).toHaveBeenLastCalledWith('12m', undefined);
    expect(screen.getByRole('tab', { name: '12 mo' })).toHaveAttribute('aria-selected', 'true');
    unmount();

    searchMock.query = 'tab=trends&cf=5y';
    render(<CashFlowCard formatAmount={String} />);
    expect(hooksMock.useDashboardCashFlow).toHaveBeenLastCalledWith('5y', undefined);
    expect(screen.getByRole('tab', { name: '5 years' })).toHaveAttribute('aria-selected', 'true');
  });

  it('writes the picked range to the URL and drops the default', () => {
    searchMock.query = 'tab=trends&cf=5y';
    hooksMock.useDashboardCashFlow.mockReturnValue(loaded([]));

    render(<CashFlowCard formatAmount={String} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    expect(routerMock.replace).toHaveBeenLastCalledWith('/dashboard?tab=trends&cf=all', {
      scroll: false,
    });

    fireEvent.click(screen.getByRole('tab', { name: '12 mo' }));
    expect(routerMock.replace).toHaveBeenLastCalledWith('/dashboard?tab=trends', { scroll: false });
  });

  it('shows a loss with a typographic minus', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue(
      loaded([{ month: '2026-07', income: 100, expense: 250 }]),
    );

    render(<CashFlowCard formatAmount={v => `$${v}`} activeMonth="2026-07" />);

    expect(screen.getByText('−$150')).toBeInTheDocument();
  });

  it('shows the empty state instead of a chart when the window has no data', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue(loaded([]));

    render(<CashFlowCard formatAmount={String} />);

    expect(screen.getByText('No cash flow data yet')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument();
  });

  it('keeps the chart box but renders no chart while loading', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue({ data: undefined, isPending: true, error: null });

    render(<CashFlowCard formatAmount={String} />);

    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument();
  });
});
