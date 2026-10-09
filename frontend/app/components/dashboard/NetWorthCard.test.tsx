// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NetWorthData } from '@/app/(main)/net-worth/hooks/useNetWorth';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { NetWorthCard } from './NetWorthCard';

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
            }
          : {
              viewAll: value('View all'),
              netWorthPeriod: value('Period'),
              netWorthYearToDate: value('Year to date'),
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
    ...overrides,
  };
}

describe('NetWorthCard', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('shows a month of net worth by default, with how it moved', async () => {
    apiGet.mockResolvedValue({ data: netWorth() });

    renderWithQuery(<NetWorthCard />);

    await waitFor(() => expect(screen.getByText('$1,000.00')).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith(
      '/reports/net-worth',
      expect.objectContaining({ params: { range: '30d' } }),
    );
    expect(screen.getByText('+$200.00 (+25%)')).toBeInTheDocument();
    expect(screen.getByTestId('net-worth-area')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view all/i }).getAttribute('href')).toBe('/net-worth');
  });

  it('asks for the period picked in the dropdown', async () => {
    apiGet.mockResolvedValue({ data: netWorth() });

    renderWithQuery(<NetWorthCard />);

    const trigger = await screen.findByRole('combobox', { name: 'Period' });
    expect(trigger).toHaveTextContent('1 month');
    selectOption(trigger, 'Year to date');

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        '/reports/net-worth',
        expect.objectContaining({ params: { range: 'ytd' } }),
      ),
    );
  });

  it('offers the six periods, shortest first', async () => {
    apiGet.mockResolvedValue({ data: netWorth() });

    renderWithQuery(<NetWorthCard />);

    const trigger = await screen.findByRole('combobox', { name: 'Period' });
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    await waitFor(() =>
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
        '1 month',
        '3 months',
        '6 months',
        'Year to date',
        '1 year',
        'All time',
      ]),
    );
  });

  it('points at the balance sheet when there is nothing on it yet', async () => {
    apiGet.mockResolvedValue({
      data: netWorth({ current: 0, change: 0, assetsTotal: 0, liabilitiesTotal: 0 }),
    });

    renderWithQuery(<NetWorthCard />);

    await waitFor(() => expect(screen.getByText('Nothing to show yet')).toBeInTheDocument());
    expect(screen.queryByTestId('net-worth-area')).not.toBeInTheDocument();
  });

  it('draws nothing until the first answer is in', () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithQuery(<NetWorthCard />);

    expect(container).toBeEmptyDOMElement();
  });
});
