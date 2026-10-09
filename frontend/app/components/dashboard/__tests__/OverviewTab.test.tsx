import type { DashboardData } from '@/app/hooks/useDashboard';
// @vitest-environment jsdom
import { type render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import '../test-setup';
import { OverviewTab } from '../OverviewTab';

const apiGet = vi.hoisted(() => vi.fn());

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
): ReturnType<typeof render> {
  return renderWithQuery(
    <OverviewTab
      data={data}
      formatAmount={formatAmount}
      isLoading={false}
      displayMonth={new Date(2026, 1, 15)}
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

  it('colours net and savings rate by sign', () => {
    renderTab({
      ...baseData,
      snapshot: { ...baseData.snapshot, income30d: 1000, expense30d: 1500 },
    });

    expect(screen.getByText('−500').className).toContain('lumio-dashboard__stat-value--negative');
    expect(screen.getByText('-50%').className).toContain('lumio-dashboard__stat-value--negative');
  });

  it('no longer hosts cash flow, quick actions or the upload zone', () => {
    renderTab(baseData);

    expect(document.body.textContent).not.toMatch(/cash flow/i);
    expect(document.body.textContent).not.toMatch(/quick actions|parsingIssuesFound/i);
    expect(screen.queryByRole('link', { name: /openExpenseDrawer/ })).not.toBeInTheDocument();
  });

  it('deep-links the recent-transactions "view all" link to the selected month, not today', () => {
    renderTab(baseData);

    const links = screen.getAllByRole('link', { name: /view all/i });
    const recentTransactionsLink = links.find(link =>
      link.getAttribute('href')?.startsWith('/statements/transactions'),
    );
    expect(recentTransactionsLink?.getAttribute('href')).toBe(
      '/statements/transactions?startDate=2026-02-01&endDate=2026-02-28',
    );
  });

  it('renders budget and cash runway cards below the main row once their fetches resolve', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/budgets') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'b1',
                name: 'Marketing',
                limitAmount: 100,
                spentAmount: 90,
                percentUsed: 90,
                currency: 'KZT',
              },
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
    expect(screen.getByText('90%').className).toContain('lumio-dashboard__stat-value--warning');
  });
});
