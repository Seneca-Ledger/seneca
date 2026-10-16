// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
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
    statementsTitle: value('STATEMENTS'),
    netFlowTitle: value('NET FLOW'),
    counterpartiesTitle: value('COUNTERPARTIES'),
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
    expect(screen.getByText('March 2026')).toBeInTheDocument();
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

  it('lists top categories with amounts next to the donut', () => {
    renderTab();

    expect(screen.getByText('Office')).toBeInTheDocument();
    expect(screen.getByText('$40')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-chart').length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText('+$60').closest('.lumio-dashboard__stat')?.querySelector(
        '.lumio-dashboard__stat-dot--positive',
      ),
    ).not.toBeNull();
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
