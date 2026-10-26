import type { DashboardData } from '@/app/hooks/useDashboard';
// @vitest-environment jsdom
import { fireEvent, type render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatMoney } from '@/app/lib/format-money';
import { budgetItem, categoryRef } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import '../test-setup';
import { OverviewTab } from '../OverviewTab';

const apiGet = vi.hoisted(() => vi.fn());

// The card has its own test; here only what the Overview hands it matters.
vi.mock('../CashFlowCard', () => ({
  CashFlowCard: ({ activeMonth, days }: { activeMonth: string; days: unknown[] }) => (
    <div data-testid="cash-flow" data-days={days.length}>
      {activeMonth}
    </div>
  ),
}));

// `apiBaseUrl` is read at module load by the goal cover thumbnail.
vi.mock('@/app/lib/api', () => ({ default: { get: apiGet }, apiBaseUrl: 'http://api.test/api/v1' }));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'workspace-1' }, loading: false }),
}));

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));

// The spend calendar has its own test; here it only needs an authenticated user.
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="mock-echarts" />,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import('./intlayer-mock');
  return {
    useIntlayer: () =>
      autoDictionary({
        emptyTitle: value('Upload your first statement'),
        emptyCta: value('Parse statement'),
        income: value('Income'),
        spentLabel: value('Spent'),
        leftToSpendLabel: value('Left to spend'),
        netLabel: value('Net'),
        savingsRateLabel: value('Savings rate'),
        monthInProgress: value('Month in progress'),
        topCategoriesTitle: value('Spending by category'),
        viewAll: value('View all'),
        title: value('Recent transactions'),
        empty: value('No transactions this period'),
        noCategoryData: value('No category data'),
        emptyDescription: value('Nothing here yet'),
      }),
    useLocale: () => ({ locale: 'en' }),
  };
});

const baseData: DashboardData = {
  snapshot: {
    totalBalance: 0,
    income30d: 0,
    expense30d: 0,
    netFlow30d: 0,
    totalPayable: 0,
    totalOverdue: 0,
    unapprovedCash: 0,
    currency: 'KZT',
    missingRates: [],
  },
  actions: [],
  cashFlow: [],
  topMerchants: [],
  topCategories: [],
  recentTransactions: [],
  role: 'owner',
  range: 'month',
  dataHealth: {
    uncategorizedTransactions: 0,
    statementsWithErrors: 0,
    statementsPendingReview: 0,
    statementsPendingSubmit: 0,
    receiptsPendingReview: 0,
    unapprovedCash: 0,
    lastUploadDate: '2026-02-01T00:00:00.000Z',
    parsingWarnings: 2,
  },
};

function renderTab(
  data: DashboardData,
  formatAmount: (value: number) => string = value => String(value),
  displayMonth: Date = new Date(2026, 1, 15),
): ReturnType<typeof render> {
  return renderWithQuery(
    <OverviewTab
      data={data}
      formatAmount={formatAmount}
      isLoading={false}
      displayMonth={displayMonth}
    />,
  );
}

describe('OverviewTab', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) =>
      Promise.resolve({ data: { data: url === '/budgets' ? [] : null } }),
    );
  });

  it('shows the onboarding CTA only for a workspace that never uploaded anything', () => {
    renderTab({ ...baseData, dataHealth: { ...baseData.dataHealth, lastUploadDate: null } });

    const parseLink = screen.getByRole('link', { name: /parse statement/i });
    expect(parseLink.getAttribute('href')).toBe('/statements?openExpenseDrawer=scan');
    expect(screen.queryByText('Income')).not.toBeInTheDocument();
  });

  it('renders the four KPI cards with formatted amounts for a month without transactions', () => {
    renderTab(baseData, () => 'KZT 1,025,215');

    for (const label of ['Income', 'Spent', 'Net', 'Savings rate']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(document.body.textContent).toContain('KZT 1,025,215');
    expect(document.body.textContent).not.toContain('KZT KZT 1,025,215');
    expect(screen.queryByRole('link', { name: /parse statement/i })).not.toBeInTheDocument();
    expect(screen.getByText('No category data')).toBeInTheDocument();
    expect(screen.getByText('No transactions this period')).toBeInTheDocument();
  });

  it('marks net and savings rate by sign with a dot, keeping the figure ink', () => {
    renderTab({
      ...baseData,
      snapshot: { ...baseData.snapshot, income30d: 1000, expense30d: 1500 },
    });

    expect(
      screen.getByText('−500').closest('.seneca-dashboard__stat')?.querySelector(
        '.seneca-dashboard__stat-dot--negative',
      ),
    ).not.toBeNull();
    expect(
      screen.getByText('-50%').closest('.seneca-dashboard__stat')?.querySelector(
        '.seneca-dashboard__stat-dot--negative',
      ),
    ).not.toBeNull();
  });

  it('leaves zero figures neutral', () => {
    renderTab({
      ...baseData,
      snapshot: { ...baseData.snapshot, income30d: 0, expense30d: 0 },
    });

    expect(document.querySelector('.seneca-dashboard__stat-dot')).toBeNull();
  });

  it('shows a 0% savings rate when there is no income', () => {
    renderTab({
      ...baseData,
      snapshot: { ...baseData.snapshot, income30d: 0, expense30d: 0 },
    });

    expect(screen.getByText('0%').className).toBe('seneca-dashboard__stat-value seneca-private');
  });

  it('says under the savings rate that the current month is not over yet', () => {
    const now = new Date();
    renderTab(
      { ...baseData, snapshot: { ...baseData.snapshot, income30d: 1941, expense30d: 18 } },
      undefined,
      new Date(now.getFullYear(), now.getMonth(), 1),
    );

    const note = screen.getByText('Month in progress');
    expect(note.className).toBe('seneca-dashboard__stat-note');
    expect(note.closest('.seneca-dashboard__stat')?.textContent).toContain('Savings rate');
  });

  it('leaves a past month without the in-progress note', () => {
    renderTab(baseData);

    expect(screen.queryByText('Month in progress')).not.toBeInTheDocument();
  });

  it('hosts the cash flow and the month close, but no quick actions or upload zone', () => {
    renderTab(baseData);

    expect(screen.getByTestId('cash-flow')).toHaveTextContent('2026-02');
    expect(screen.getByText('sections.monthClose')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/quick actions|parsingIssuesFound/i);
    expect(screen.queryByRole('link', { name: /openExpenseDrawer/ })).not.toBeInTheDocument();
  });

  it("hands the cash flow card the picked month's days", () => {
    const cashFlow = [
      { date: '2026-02-01', income: 100, expense: 0, budgeted: 0 },
      { date: '2026-02-02', income: 0, expense: 40, budgeted: 0 },
    ];
    renderTab({ ...baseData, cashFlow });

    expect(screen.getByTestId('cash-flow')).toHaveAttribute('data-days', String(cashFlow.length));
  });

  it('deep-links the recent-transactions "view all" link to the selected month, not today', () => {
    renderTab(baseData);

    const links = screen.getAllByRole('link', { name: /view all/i });
    const recentTransactionsLink = links.find(link =>
      link.getAttribute('href')?.startsWith('/statements/submit'),
    );
    expect(recentTransactionsLink?.getAttribute('href')).toBe('/statements/submit?month=2026-02');
  });

  it('renders budget and subscriptions cards below the main row once their fetches resolve', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/budgets') {
        return Promise.resolve({
          data: {
            data: [
              budgetItem({
                id: 'b1',
                name: 'Marketing',
                category: categoryRef({ id: 'c1', name: 'Marketing' }),
                spentAmount: 90,
                percentUsed: 90,
                currency: 'KZT',
              }),
            ],
          },
        });
      }
      if (url === '/subscriptions/month-status') {
        return Promise.resolve({
          data: {
            data: {
              currency: 'KZT',
              month: '2026-03',
              paidAmount: 200,
              paidCount: 1,
              unpaidAmount: 300,
              unpaidCount: 2,
              items: [
                {
                  subscriptionId: 'sub-1',
                  vendorName: 'ACME Music',
                  vendorDomain: null,
                  amount: 300,
                  paid: false,
                  nextChargeDate: '2026-03-28',
                },
              ],
            },
          },
        });
      }
      return Promise.resolve({ data: null });
    });

    renderTab(baseData);

    await waitFor(() => {
      expect(screen.getByText('Marketing')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
    });
    // The figure stays neutral; a budget in its last tenth marks its bar instead.
    expect(screen.getByText('90%').className).toBe('seneca-dashboard__budget-pct');
    expect(
      screen.getByText('90%').closest('.seneca-dashboard__budget-row')?.querySelector('[data-tone]')
        ?.getAttribute('data-tone'),
    ).toBe('near');
  });
});

describe('OverviewTab spent tile', () => {
  const SPENT = 15;
  const dataWithSpending: DashboardData = {
    ...baseData,
    snapshot: { ...baseData.snapshot, expense30d: SPENT },
  };

  function answerBudgets(budgets: ReturnType<typeof budgetItem>[]): void {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) =>
      Promise.resolve({ data: { data: url === '/budgets' ? budgets : null } }),
    );
  }

  /** The tile once the budgets are in: its figure replaces the spinner. */
  async function spentTile(): Promise<HTMLElement> {
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/budgets', expect.anything()));
    const label = await screen.findByText(/^(Spent|Left to spend)$/);
    const tile = label.closest('.seneca-dashboard__stat') as HTMLElement;
    await waitFor(() => expect(tile.querySelector('.seneca-dashboard__stat-value')?.textContent).not.toBe(''));
    return tile;
  }

  const figure = (tile: HTMLElement) =>
    tile.querySelector('.seneca-dashboard__stat-value')?.textContent;

  it('shows what was spent while the workspace has no budget', async () => {
    answerBudgets([]);
    renderTab(dataWithSpending);

    const tile = await spentTile();
    expect(tile).toHaveTextContent('Spent');
    expect(figure(tile)).toBe(String(SPENT));
    expect(screen.queryByText('Left to spend')).not.toBeInTheDocument();
  });

  it('keeps showing what was spent when the only budget starts after the month', async () => {
    // The month shown is February 2026.
    answerBudgets([budgetItem({ id: 'b-1', name: 'Groceries', startsOn: '2026-03-01' })]);
    renderTab(dataWithSpending);

    const tile = await spentTile();
    expect(tile).toHaveTextContent('Spent');
    expect(screen.queryByText('Left to spend')).not.toBeInTheDocument();
  });

  it('keeps showing what was spent when the only budget ended before the month', async () => {
    answerBudgets([budgetItem({ id: 'b-1', name: 'Groceries', endsOn: '2026-01-31' })]);
    renderTab(dataWithSpending);

    const tile = await spentTile();
    expect(tile).toHaveTextContent('Spent');
    expect(screen.queryByText('Left to spend')).not.toBeInTheDocument();
  });

  it('turns into what is left to spend once a budget covers the month', async () => {
    const limit = 100;
    const spentInBudget = 40;
    answerBudgets([
      budgetItem({
        id: 'b-1',
        name: 'Groceries',
        currency: 'KZT',
        startsOn: '2026-02-10',
        availableAmount: limit,
        spentAmount: spentInBudget,
      }),
    ]);
    renderTab(dataWithSpending);

    await screen.findByText('Left to spend');
    const tile = await spentTile();
    expect(figure(tile)).toBe(formatMoney(limit - spentInBudget, 'KZT', 'en'));
  });

  it('marks the tile when the month went over its budgets', async () => {
    answerBudgets([
      budgetItem({ id: 'b-1', name: 'Groceries', availableAmount: 100, spentAmount: 130 }),
    ]);
    renderTab(dataWithSpending);

    await screen.findByText('Left to spend');
    const tile = await spentTile();
    expect(figure(tile)).toBe(formatMoney(-30, 'USD', 'en'));
    expect(tile.querySelector('.seneca-dashboard__stat-dot--negative')).not.toBeNull();
  });
});

describe('OverviewTab getting started checklist', () => {
  const progress = {
    hasUpload: false,
    hasCustomCategories: false,
    hasBudget: false,
    hasGoal: false,
    telegramAvailable: false,
    hasTelegram: false,
  };

  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/dashboard/setup-progress') {
        return Promise.resolve({ data: progress });
      }
      if (url === '/view-preferences/onboarding') {
        return Promise.resolve({ data: { state: null } });
      }
      return Promise.resolve({ data: { data: url === '/budgets' ? [] : null } });
    });
  });

  it('sits above the empty state of a workspace that never uploaded anything', async () => {
    renderTab({ ...baseData, dataHealth: { ...baseData.dataHealth, lastUploadDate: null } });

    expect(await screen.findByText('exploreOnMyOwn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /parse statement/i })).toBeInTheDocument();
  });

  it('is not shown to a viewer', async () => {
    renderTab({
      ...baseData,
      role: 'viewer',
      dataHealth: { ...baseData.dataHealth, lastUploadDate: null },
    });

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(apiGet).not.toHaveBeenCalledWith('/dashboard/setup-progress', expect.anything());
    expect(screen.queryByText('exploreOnMyOwn')).not.toBeInTheDocument();
  });
});
