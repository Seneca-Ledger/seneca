// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NetWorthData } from '@/app/(main)/net-worth/hooks/useNetWorth';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { currentMonthKey } from './month-end';
import { NetWorthCard } from './NetWorthCard';
import { SectionSpanProvider } from './section-span';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet },
  apiBaseUrl: 'http://api.test/api/v1',
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyNetWorthArea: () => <div data-testid="net-worth-area" />,
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import('./__tests__/intlayer-mock');
  return {
    useIntlayer: (key: string) =>
      autoDictionary(
        key === 'netWorthPage'
          ? {
              title: value('Net worth'),
              rangeAll: value('All time'),
              overPeriod: value('over period'),
              empty: value('Nothing to show yet'),
              assets: value('Assets'),
              liabilities: value('Liabilities'),
              assetClasses: value('By asset class'),
              classEtf: value('ETFs'),
              allTimeHigh: value('All-time high {{value}} on {{date}}'),
            }
          : {
              viewAll: value('View all'),
              netWorthPeriod: value('Period'),
              netWorthYearToDate: value('Year to date'),
              netWorthVsDate: value('vs {{date}}'),
              netWorthAtHigh: value('At all-time high'),
            },
      ),
    useLocale: () => ({ locale: 'en' }),
  };
});
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function netWorth(overrides: Partial<NetWorthData> = {}): NetWorthData {
  return {
    range: '30d',
    from: '2026-09-05',
    to: '2026-10-05',
    currency: 'USD',
    current: 1000,
    previous: 800,
    change: 200,
    changePercent: 25,
    assetsTotal: 1200,
    liabilitiesTotal: 200,
    series: [
      { date: '2026-09-05', value: 800, assets: 1000, liabilities: 200 },
      { date: '2026-10-05', value: 1000, assets: 1200, liabilities: 200 },
    ],
    breakdown: [],
    byRisk: [],
    byRole: [],
    riskyPercent: 0,
    assetLines: [],
    missingRates: [],
    excluded: [],
    attribution: { byAccount: [], byKind: [] },
    savings: { income: 0, kept: 0, rate: null },
    allTimeHigh: null,
    byAssetClass: [],
    ...overrides,
  };
}

const THIS_MONTH = currentMonthKey();

describe('NetWorthCard', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('shows a month of net worth by default, with how it moved', async () => {
    apiGet.mockResolvedValue({ data: netWorth() });

    renderWithQuery(<NetWorthCard month={THIS_MONTH} monthLabel="This month" />);

    // Whole dollars on the overview; the cents are in the tooltip.
    await waitFor(() => expect(screen.getByText('$1,000')).toBeInTheDocument());
    expect(screen.getByTitle('$1,000.00')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith(
      '/reports/net-worth',
      expect.objectContaining({ params: { range: '30d' } }),
    );
    // The amount is an element of its own (privacy mode); the line is around it.
    expect(screen.getByText(/\(\+25%\)/).textContent).toBe('+$200.00 (+25%)');
    expect(screen.getByTestId('net-worth-area')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view all/i }).getAttribute('href')).toBe('/net-worth');
  });

  it('ends the period on the last day of a past month, and says which', async () => {
    apiGet.mockResolvedValue({ data: netWorth() });

    renderWithQuery(<NetWorthCard month="2025-02" monthLabel="February 2025" />);

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        '/reports/net-worth',
        expect.objectContaining({ params: { range: '30d', to: '2025-02-28' } }),
      ),
    );
    expect(await screen.findByText('February 2025')).toBeInTheDocument();
  });

  it('switches period with text tabs, shortest first', async () => {
    apiGet.mockResolvedValue({ data: netWorth() });

    renderWithQuery(<NetWorthCard month={THIS_MONTH} monthLabel="This month" />);

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map(tab => tab.textContent)).toEqual([
      '1 mth',
      '3 mths',
      '6 mths',
      'Year to date',
      '1 yr',
      'All time',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Year to date' }));

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        '/reports/net-worth',
        expect.objectContaining({ params: { range: 'ytd' } }),
      ),
    );
  });

  it('points at the balance sheet when there is nothing on it yet', async () => {
    apiGet.mockResolvedValue({
      data: netWorth({ current: 0, change: 0, assetsTotal: 0, liabilitiesTotal: 0 }),
    });

    renderWithQuery(<NetWorthCard month={THIS_MONTH} monthLabel="This month" />);

    await waitFor(() => expect(screen.getByText('Nothing to show yet')).toBeInTheDocument());
    expect(screen.queryByTestId('net-worth-area')).not.toBeInTheDocument();
  });

  it('holds its place without a figure until the first answer is in', () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<NetWorthCard month={THIS_MONTH} monthLabel="This month" />);

    expect(screen.getByText('Net worth')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to show yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('shows what the total is made of only with the row to itself', async () => {
    apiGet.mockResolvedValue({
      data: netWorth({
        allTimeHigh: { value: 1500, date: '2026-08-01' },
        byAssetClass: [{ key: 'etf', amount: 600, percent: 50 }],
      }),
    });

    const half = renderWithQuery(
      <SectionSpanProvider value={6}>
        <NetWorthCard month={THIS_MONTH} monthLabel="This month" />
      </SectionSpanProvider>,
    );
    await screen.findByText('$1,000');
    expect(screen.queryByText('Assets')).not.toBeInTheDocument();
    half.unmount();

    renderWithQuery(
      <SectionSpanProvider value={12}>
        <NetWorthCard month={THIS_MONTH} monthLabel="This month" />
      </SectionSpanProvider>,
    );
    await screen.findByText('Assets');
    expect(screen.getByText('$1,200')).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
    expect(screen.getByText(/All-time high/).textContent).toBe('All-time high $1,500 on Aug 1');
    expect(screen.getByText('ETFs')).toBeInTheDocument();
    expect(screen.getByText('ETFs').parentElement?.querySelector('dd')?.textContent).toBe(
      '$600 · 50%',
    );
  });
});
