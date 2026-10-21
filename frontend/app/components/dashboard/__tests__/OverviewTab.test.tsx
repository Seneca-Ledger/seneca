import type { DashboardData } from '@/app/hooks/useDashboard';
// @vitest-environment jsdom
import { fireEvent, type render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { budgetItem, categoryRef } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import '../test-setup';
import { OverviewTab } from '../OverviewTab';

const apiGet = vi.hoisted(() => vi.fn());
const onSelectMonth = vi.hoisted(() => vi.fn());

// The card has its own test; here only what the Overview hands it matters.
vi.mock('../CashFlowCard', () => ({
  CashFlowCard: ({
    activeMonth,
    onSelectMonth: select,
  }: {
    activeMonth?: string;
    onSelectMonth?: (month: string) => void;
  }) => (
    <button type="button" data-testid="cash-flow" onClick={() => select?.('2025-11')}>
      {activeMonth}
    </button>
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
      onSelectMonth={onSelectMonth}
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

  it('switches the dashboard month from a cash flow bar', () => {
    renderTab(baseData);

    fireEvent.click(screen.getByTestId('cash-flow'));

    expect(onSelectMonth).toHaveBeenCalledWith(2025, 10);
  });

  it('deep-links the recent-transactions "view all" link to the selected month, not today', () => {
    renderTab(baseData);

    const links = screen.getAllByRole('link', { name: /view all/i });
    const recentTransactionsLink = links.find(link =>
      link.getAttribute('href')?.startsWith('/statements/submit'),
    );
    expect(recentTransactionsLink?.getAttribute('href')).toBe('/statements/submit?month=2026-02');
  });

  it('renders budget and cash runway cards below the main row once their fetches resolve', async () => {
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
      if (url === '/dashboard/commitments') {
        return Promise.resolve({
          data: {
            data: {
              currency: 'KZT',
              horizonDays: 60,
              openingBalance: 1000,
              totalCommitted: 200,
              unscheduledCommitted: 0,
              days: [{ date: '2026-03-01', outflow: 200, balance: 800 }],
              items: [
                {
                  date: '2026-03-01',
                  label: 'Office rent',
                  amount: 200,
                  source: 'payable',
                  sourceId: 'p1',
                  isOverdue: false,
                },
              ],
              lowestBalance: 800,
              lowestBalanceDate: '2026-03-01',
              shortfallDate: null,
            },
          },
        });
      }
      return Promise.resolve({ data: null });
    });

    renderTab(baseData);

    await waitFor(() => {
      expect(screen.getByText('Marketing')).toBeInTheDocument();
      expect(screen.getByText('Office rent')).toBeInTheDocument();
    });
    // The figure stays neutral; a budget in its last tenth marks its bar instead.
    expect(screen.getByText('90%').className).toBe('seneca-dashboard__budget-pct');
    expect(
      screen.getByText('90%').closest('.seneca-dashboard__budget-row')?.querySelector('[data-tone]')
        ?.getAttribute('data-tone'),
    ).toBe('near');
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
