// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DonutSlice } from '@/app/components/charts/CategoryDonut';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { SubscriptionsMonthWidget } from './SubscriptionsMonthWidget';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet }, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyCategoryDonut: ({ slices }: { slices: DonutSlice[] }) => (
    <div data-testid="donut">{slices.map(slice => `${slice.key}:${slice.value}`).join(',')}</div>
  ),
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return {
    useIntlayer: () => autoDictionary({ paid: { value: 'Paid' } }),
    useLocale: () => ({ locale: 'en' }),
  };
});
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const PAID = 14;
const UNPAID = 237.5;
const item = (overrides = {}) => ({
  subscriptionId: 'sub-1',
  vendorName: 'ACME Music',
  vendorDomain: null,
  amount: PAID,
  paid: true,
  nextChargeDate: '2026-11-03',
  ...overrides,
});
const status = (overrides = {}) => ({
  currency: 'EUR',
  month: '2026-10',
  paidAmount: PAID,
  paidCount: 1,
  unpaidAmount: UNPAID,
  unpaidCount: 1,
  items: [
    item({
      subscriptionId: 'sub-2',
      vendorName: 'Example Cloud',
      amount: UNPAID,
      paid: false,
      nextChargeDate: '2026-10-28',
    }),
    item(),
  ],
  ...overrides,
});

const money = (value: number) => `${value} €`;

describe('SubscriptionsMonthWidget', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('lists each subscription with its icon, its date or Paid, and its amount', async () => {
    apiGet.mockResolvedValue({ data: status() });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByTestId('donut')).toHaveTextContent(`paid:${PAID},unpaid:${UNPAID}`);
    const [unpaid, paid] = screen.getAllByRole('link', { name: /ACME Music|Example Cloud/ });
    expect(unpaid).toHaveTextContent('Example Cloud');
    expect(unpaid).toHaveTextContent('Oct 28');
    expect(unpaid).toHaveTextContent(money(UNPAID));
    expect(paid).toHaveTextContent('ACME Music');
    expect(paid).toHaveTextContent('Paid');
    expect(paid).toHaveTextContent(money(PAID));
    // Initials stand in for a vendor without a bundled mark or domain.
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('links each row to its subscription, ringed on the Subscriptions page', async () => {
    apiGet.mockResolvedValue({ data: status() });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    const row = await screen.findByRole('link', { name: /Example Cloud/ });
    expect(row).toHaveAttribute('href', `/subscriptions?focus=${encodeURIComponent('subscription:sub-2')}`);
  });

  it('leaves an empty part out of the ring but keeps the subscription', async () => {
    apiGet.mockResolvedValue({
      data: status({ paidAmount: 0, paidCount: 0, items: [item({ paid: false, amount: UNPAID })] }),
    });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByTestId('donut')).toHaveTextContent(`unpaid:${UNPAID}`);
    expect(screen.getByText('ACME Music')).toBeInTheDocument();
  });

  it('shows five subscriptions at most', async () => {
    const items = Array.from({ length: 7 }, (_, index) =>
      item({ subscriptionId: `sub-${index}`, vendorName: `Vendor ${index}` }),
    );
    apiGet.mockResolvedValue({ data: status({ items }) });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByText('Vendor 4')).toBeInTheDocument();
    expect(screen.queryByText('Vendor 5')).toBeNull();
  });

  it('shows the empty state when nothing is charged this month', async () => {
    apiGet.mockResolvedValue({
      data: status({ paidAmount: 0, paidCount: 0, unpaidAmount: 0, unpaidCount: 0, items: [] }),
    });
    renderWithQuery(<SubscriptionsMonthWidget formatAmount={money} />);

    expect(await screen.findByText('emptyDescription')).toBeInTheDocument();
    expect(screen.queryByTestId('donut')).toBeNull();
  });
});
