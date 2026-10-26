// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetSummaryWidget } from '@/app/(main)/dashboard/components/BudgetSummaryWidget';
import { SubscriptionsMonthWidget } from '@/app/(main)/dashboard/components/SubscriptionsMonthWidget';
import { budgetItem, cryptoSummary } from '@/app/test/fixtures/contracts';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import { CryptoPortfolioCard } from '../CryptoPortfolioCard';

/*
 * Switching dashboard tabs unmounts Overview and mounts it again on the way
 * back. A card that starts from nothing on every mount pops in a moment later
 * and shoves the sections below it around. Each card here must come back
 * already drawn, in the very first render, from what it loaded last time.
 */

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet }, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('./intlayer-mock');
  return { useIntlayer: () => autoDictionary(), useLocale: () => ({ locale: 'en' }) };
});
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const RESPONSES: Record<string, unknown> = {
  '/crypto/summary': cryptoSummary({ currency: 'EUR', portfolioValue: 5532 }),
  '/budgets': [
    budgetItem({ id: 'b-1', name: 'Travel', currency: 'EUR', spentAmount: 10, percentUsed: 10 }),
  ],
  '/subscriptions/month-status': {
    currency: 'EUR',
    month: '2026-10',
    paidAmount: 14,
    paidCount: 1,
    unpaidAmount: 50,
    unpaidCount: 1,
  },
};

const money = (value: number) => `€${value}`;

const CARDS: Array<{ name: string; ui: React.ReactElement; shows: string }> = [
  {
    name: 'crypto portfolio',
    ui: <CryptoPortfolioCard formatAmount={money} month="2026-10" monthLabel="October 2026" />,
    shows: '€5532',
  },
  // The widget names a budget by its category.
  {
    name: 'budgets',
    ui: (
      <BudgetSummaryWidget
        month={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
        monthLabel="This month"
      />
    ),
    shows: 'Groceries',
  },
  {
    name: 'subscriptions this month',
    ui: <SubscriptionsMonthWidget formatAmount={money} />,
    shows: '€50',
  },
];

describe('Overview cards coming back after a tab switch', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation(async (url: string) => ({ data: RESPONSES[url] }));
  });

  it.each(CARDS)('$name is drawn in the first render of a remount', async ({ ui, shows }) => {
    const client = createTestQueryClient();
    const first = renderWithQuery(ui, { client });
    await screen.findByText(shows);
    first.unmount();

    renderWithQuery(ui, { client });

    // No waiting: the content has to be there before any request settles.
    expect(screen.getByText(shows)).toBeInTheDocument();
  });
});
