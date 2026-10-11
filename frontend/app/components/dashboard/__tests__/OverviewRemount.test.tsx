// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetSummaryWidget } from '@/app/(main)/dashboard/components/BudgetSummaryWidget';
import { CashRunwayWidget } from '@/app/(main)/dashboard/components/CashRunwayWidget';
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
  return { useIntlayer: () => autoDictionary() };
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
  '/dashboard/commitments': {
    currency: 'EUR',
    horizonDays: 60,
    openingBalance: 1000,
    totalCommitted: 50,
    unscheduledCommitted: 0,
    days: [{ date: '2026-10-07', outflow: 50, balance: 950 }],
    items: [
      {
        date: '2026-10-07',
        label: 'Telekom',
        amount: 50,
        source: 'subscription',
        sourceId: 's-1',
        isOverdue: false,
      },
    ],
    lowestBalance: 950,
    lowestBalanceDate: '2026-10-07',
    shortfallDate: null,
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
  { name: 'budgets', ui: <BudgetSummaryWidget />, shows: 'Groceries' },
  { name: 'cash runway', ui: <CashRunwayWidget formatAmount={money} />, shows: 'Telekom' },
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
