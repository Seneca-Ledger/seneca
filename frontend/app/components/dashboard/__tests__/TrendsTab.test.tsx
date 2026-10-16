// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { chartedMonths } from '../CashFlowCard';
import { TrendsTab } from '../TrendsTab';

const chartProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());

const hooksMock = vi.hoisted(() => ({
  useDashboardTrends: vi.fn(),
  useDashboardCashFlow: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams('tab=trends'),
}));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    chartProps(props);
    return React.createElement('div', { 'data-testid': 'mock-chart' });
  },
}));

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));

vi.mock('@/app/hooks/useDashboard', async () => {
  const actual = await vi.importActual('@/app/hooks/useDashboard');
  return {
    ...actual,
    useDashboardTrends: hooksMock.useDashboardTrends,
    useDashboardCashFlow: hooksMock.useDashboardCashFlow,
  };
});

// Mirrors react-intlayer's renderIntlayerNode: a Proxy over a rendered
// Fragment whose `.value` is intercepted to return the plain string, so the
// mock is usable both as a JSX child and via `.value` string access.
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
    noTrendDataForPeriod: value('No trend data available for this period.'),
    netFlowTitle: value('Net flow'),
    counterpartiesTitle: value('Counterparties'),
    income: value('Income'),
    expense: value('Expense'),
    net: value('Net'),
    categories: value('Categories'),
    totalFound: value('Total found'),
    spendTrendTitle: value('Spend trend'),
    categoryBreakdownTitle: value('Category breakdown'),
    noTrendDataForRange: value('No trend data available for selected range'),
    noCategorizedTransactions: value('No categorized transactions to visualize'),
    forecastSuffix: value(' (forecast)'),
    forecastLabel: value('Forecast →'),
    empty: value('No cash flow data yet'),
    noData: value('No data'),
    rangeAll: value('All time'),
    range5y: value('5 years'),
    range12m: value('12 mo'),
    rangeThisYear: value('This year'),
  }),
  useLocale: () => ({ locale: 'en' }),
}));

const trends = {
  dailyTrend: [{ date: '2026-03-10', income: 100, expense: 40 }],
  forecast: [],
  categories: [
    { name: 'Office', amount: 40, count: 1 },
    { name: 'Rent', amount: 25, count: 1 },
  ],
  counterparties: [{ name: 'Client', amount: 100, count: 1 }],
  sources: { statements: { income: 100, expense: 40, rows: 2 } },
};

const cashFlow = (points: Array<{ month: string; income: number; expense: number }>) => ({
  data: {
    range: '12m',
    currency: 'USD',
    since: '2025-04-01',
    endDate: '2026-03-31',
    totals: { income: 0, expense: 0, net: 0 },
    points: points.map(point => ({ ...point, net: point.income - point.expense })),
  },
  isPending: false,
  error: null,
});

function renderTab(onSelectMonth = vi.fn()) {
  render(
    <TrendsTab
      formatAmount={amount => `$${amount}`}
      displayMonth={new Date(2026, 2, 1)}
      onSelectMonth={onSelectMonth}
    />,
  );
  return onSelectMonth;
}

describe('TrendsTab', () => {
  beforeEach(() => {
    chartProps.mockClear();
    hooksMock.useDashboardTrends.mockReturnValue({
      data: trends,
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
    hooksMock.useDashboardCashFlow.mockReturnValue(cashFlow([]));
  });

  it('loads trends for the picked calendar month instead of a rolling window', () => {
    renderTab();

    expect(hooksMock.useDashboardTrends).toHaveBeenLastCalledWith({ month: '2026-03' });
    expect(screen.queryByRole('button', { name: '30D' })).not.toBeInTheDocument();
    expect(screen.getAllByText('March 2026').length).toBeGreaterThan(0);
  });

  it('renders the monthly cash flow card above the month sections', () => {
    hooksMock.useDashboardTrends.mockReturnValue({
      data: null,
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });

    renderTab();

    expect(hooksMock.useDashboardCashFlow).toHaveBeenLastCalledWith('12m', '2026-03');
    expect(screen.getByText('No cash flow data yet')).toBeInTheDocument();
  });

  it('names the month on every card and keeps the figures without signs or dots', () => {
    renderTab();

    const net = screen.getByText('$60').closest('.lumio-dashboard__stat');
    expect(net?.textContent).toContain('March 2026');
    expect(net?.querySelector('.lumio-dashboard__stat-dot')).toBeNull();
    expect(screen.getByText('Expense $40 · March 2026')).toBeInTheDocument();
  });

  it('shows two categories as rows with bars of their share instead of a ring', () => {
    renderTab();

    expect(screen.getByText('Office')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(chartProps.mock.calls.some(([props]) => 'slices' in props)).toBe(false);
    const bars = document.querySelectorAll<HTMLElement>('.lumio-dashboard__share-bar > span');
    expect([...bars].map(bar => bar.style.width)).toEqual([`${(40 / 65) * 100}%`, `${(25 / 65) * 100}%`]);
  });

  it('draws the ring from three categories on', () => {
    hooksMock.useDashboardTrends.mockReturnValue({
      data: { ...trends, categories: [...trends.categories, { name: 'Travel', amount: 10, count: 1 }] },
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });

    renderTab();

    expect(chartProps.mock.calls.some(([props]) => 'slices' in props)).toBe(true);
    expect(document.querySelector('.lumio-dashboard__share-bar')).toBeNull();
  });

  it('highlights the picked month on the cash flow chart and switches month from a bar', () => {
    hooksMock.useDashboardCashFlow.mockReturnValue(
      cashFlow([
        { month: '2026-02', income: 10, expense: 5 },
        { month: '2026-03', income: 12, expense: 4 },
      ]),
    );

    const onSelectMonth = renderTab();
    const barsProps = chartProps.mock.calls
      .map(([props]) => props)
      .find(props => props.activeMonth !== undefined);

    expect(barsProps?.activeMonth).toBe('2026-03');
    (barsProps?.onSelectMonth as (month: string) => void)('2025-11');
    expect(onSelectMonth).toHaveBeenCalledWith(2025, 10);
  });
});

describe('chartedMonths', () => {
  const point = (month: string, income = 0, expense = 0) => ({
    month,
    income,
    expense,
    net: income - expense,
  });

  it('opens on the first month with money in or out', () => {
    const points = [point('2026-01'), point('2026-02'), point('2026-03', 5), point('2026-04')];

    expect(chartedMonths(points).map(p => p.month)).toEqual(['2026-03', '2026-04']);
  });

  it('keeps an earlier picked month on the chart', () => {
    const points = [point('2026-01'), point('2026-02'), point('2026-03', 5)];

    expect(chartedMonths(points, '2026-02').map(p => p.month)).toEqual(['2026-02', '2026-03']);
  });
});
