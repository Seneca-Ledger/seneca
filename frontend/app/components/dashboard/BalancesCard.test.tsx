// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NetWorthData } from '@/app/(main)/net-worth/hooks/useNetWorth';
import type { NetWorthGroup } from '@/app/lib/contracts';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { BalancesCard } from './BalancesCard';
import { currentMonthKey } from './month-end';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet },
  apiBaseUrl: 'http://api.test/api/v1',
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import('./__tests__/intlayer-mock');
  return {
    useIntlayer: () =>
      autoDictionary({
        title: value('Balances'),
        empty: value('Nothing here yet'),
        rangeAll: value('All time'),
        assets: value('Assets'),
        liabilities: value('Liabilities'),
        viewAll: value('View all'),
        netWorthPeriod: value('Period'),
      }),
    useLocale: () => ({ locale: 'en' }),
  };
});
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/** The mocked dictionary answers a group's name with its own path. */
const nameOf = (group: NetWorthGroup) => `groups.${group.key}`;

const CASH: NetWorthGroup = {
  key: 'cash',
  side: 'asset',
  amount: 1200,
  changePercent: 20,
  series: [1000, 1200],
  lines: [{ id: 'cash', code: 'ASSET_CASH', name: 'Cash', amount: 1200 }],
};
const CRYPTO: NetWorthGroup = {
  key: 'crypto',
  side: 'asset',
  amount: 300,
  changePercent: -10,
  series: [330, 300],
  lines: [{ id: 'coins', code: 'ASSET_COINS', name: 'Coin Wallet', amount: 300 }],
};
const LOANS: NetWorthGroup = {
  key: 'loans',
  side: 'liability',
  amount: 400,
  changePercent: 5,
  series: [380, 400],
  lines: [{ id: 'car-loan', code: 'LIABILITY_CAR', name: 'Car Loan', amount: 400 }],
};
const CARDS: NetWorthGroup = {
  key: 'credit_cards',
  side: 'liability',
  amount: 250,
  changePercent: null,
  series: [0, 250],
  lines: [{ id: 'debts:cards', code: 'LIABILITY_ACCOUNT_DEBTS', name: 'Account debts', amount: 250 }],
};

const ACCOUNT = { id: 'acc-1', name: 'Everyday Account', currency: 'EUR', balance: 950 };
const CARD = { id: 'card-1', name: 'Travel Card', type: 'credit_card', currency: 'USD', balance: -250 } as const;
const LOAN = { id: 'loan-1', name: 'Car Loan Account', type: 'loan', currency: 'USD', balance: -900 } as const;

function netWorth(groups: NetWorthGroup[]): NetWorthData {
  return {
    range: '30d',
    from: '2026-09-05',
    to: '2026-10-05',
    currency: 'USD',
    current: 1100,
    previous: 950,
    change: 150,
    changePercent: 15.79,
    assetsTotal: 1500,
    liabilitiesTotal: 400,
    series: [],
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
    groups,
  };
}

function answer(groups: NetWorthGroup[]) {
  apiGet.mockImplementation(async (url: string) =>
    url.startsWith('/wallets') ? { data: [walletItem(ACCOUNT), walletItem(CARD), walletItem(LOAN)] } : { data: netWorth(groups) },
  );
}

const THIS_MONTH = currentMonthKey();

describe('BalancesCard', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('lists what is owned, then what is owed, with each side totalled', async () => {
    answer([CASH, CRYPTO, LOANS]);
    renderWithQuery(<BalancesCard month={THIS_MONTH} monthLabel="This month" />);

    await waitFor(() => expect(screen.getByText('Assets')).toBeInTheDocument());
    const [assets, liabilities] = screen.getAllByRole('list').slice(0, 2);
    expect(within(assets).getByText(nameOf(CASH))).toBeInTheDocument();
    expect(within(assets).getByText(nameOf(CRYPTO))).toBeInTheDocument();
    expect(within(liabilities).getByText(nameOf(LOANS))).toBeInTheDocument();
    expect(screen.getByText('$1,500')).toBeInTheDocument();
  });

  it('colours a growing debt as bad news and a falling asset too', async () => {
    answer([CASH, CRYPTO, LOANS]);
    renderWithQuery(<BalancesCard month={THIS_MONTH} monthLabel="This month" />);

    await waitFor(() => expect(screen.getByText('5.0%')).toBeInTheDocument());
    expect(screen.getByText('20.0%').closest('[class*="trend--"]')?.className).toContain('--up');
    expect(screen.getByText('10.0%').closest('[class*="trend--"]')?.className).toContain('--down');
    expect(screen.getByText('5.0%').closest('[class*="trend--"]')?.className).toContain('--down');
  });

  it('opens cash onto the accounts it is made of', async () => {
    answer([CASH]);
    renderWithQuery(<BalancesCard month={THIS_MONTH} monthLabel="This month" />);

    const toggle = await screen.findByRole('button', { expanded: false });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const link = await screen.findByRole('link', { name: new RegExp(ACCOUNT.name) });
    expect(link).toHaveAttribute('href', `/accounts/${ACCOUNT.id}`);
    expect(link).toHaveTextContent('€950');
  });

  it('opens any other group onto its sheet lines', async () => {
    answer([LOANS]);
    renderWithQuery(<BalancesCard month={THIS_MONTH} monthLabel="This month" />);

    fireEvent.click(await screen.findByRole('button', { expanded: false }));

    const line = LOANS.lines[0];
    expect(screen.getByRole('link', { name: new RegExp(line.name) })).toHaveAttribute(
      'href',
      '/net-worth',
    );
    expect(apiGet).not.toHaveBeenCalledWith('/wallets', expect.anything());
  });

  it('shows the amount that came when the window starts at zero', async () => {
    answer([CARDS]);
    renderWithQuery(<BalancesCard month={THIS_MONTH} monthLabel="This month" />);

    const trend = await screen.findByText(/^\+/);
    expect(trend).toHaveTextContent('+$250');
    // A new debt is bad news.
    expect(trend.className).toContain('--down');
  });

  it('opens credit cards onto the card accounts only', async () => {
    answer([CARDS]);
    renderWithQuery(<BalancesCard month={THIS_MONTH} monthLabel="This month" />);

    fireEvent.click(await screen.findByRole('button', { expanded: false }));

    const link = await screen.findByRole('link', { name: new RegExp(CARD.name) });
    expect(link).toHaveAttribute('href', `/accounts/${CARD.id}`);
    expect(link).toHaveTextContent('$250');
    expect(screen.queryByText(LOAN.name)).not.toBeInTheDocument();
    expect(screen.queryByText(ACCOUNT.name)).not.toBeInTheDocument();
  });

  it('says how to fill it when nothing is on the sheet', async () => {
    answer([]);
    renderWithQuery(<BalancesCard month={THIS_MONTH} monthLabel="This month" />);

    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  });
});
