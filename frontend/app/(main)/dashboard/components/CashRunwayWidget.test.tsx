// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionSpanProvider } from '@/app/components/dashboard/section-span';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { CashRunwayWidget } from './CashRunwayWidget';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet }, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyNetWorthArea: () => <div data-testid="balance-area" />,
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return { useIntlayer: () => autoDictionary(), useLocale: () => ({ locale: 'en' }) };
});
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const COMMITMENTS = {
  currency: 'EUR',
  horizonDays: 60,
  openingBalance: 1000,
  totalCommitted: 120,
  unscheduledCommitted: 0,
  days: [
    { date: '2026-10-13', outflow: 0, balance: 1000 },
    { date: '2026-10-14', outflow: 120, balance: 880 },
  ],
  items: Array.from({ length: 12 }, (_, index) => ({
    source: 'subscription',
    sourceId: `s-${index}`,
    label: `Bill ${index}`,
    amount: 10,
    date: '2026-10-14',
    isOverdue: false,
  })),
  lowestBalance: 880,
  lowestBalanceDate: '2026-10-14',
  shortfallDate: null,
};

const money = (value: number) => `${value} €`;

describe('CashRunwayWidget', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: COMMITMENTS });
  });

  it('lists five payments at half width, without the balance line', async () => {
    renderWithQuery(
      <SectionSpanProvider value={6}>
        <CashRunwayWidget formatAmount={money} />
      </SectionSpanProvider>,
    );
    expect(await screen.findAllByText(/^Bill \d+$/)).toHaveLength(5);
    expect(screen.queryByTestId('balance-area')).toBeNull();
  });

  it('draws the balance day by day and ten payments with the row to itself', async () => {
    renderWithQuery(
      <SectionSpanProvider value={12}>
        <CashRunwayWidget formatAmount={money} />
      </SectionSpanProvider>,
    );
    expect(await screen.findAllByText(/^Bill \d+$/)).toHaveLength(10);
    expect(screen.getByTestId('balance-area')).toBeInTheDocument();
  });
});
