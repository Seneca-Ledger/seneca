import { cleanup } from '@testing-library/react';
// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpendCalendarCard } from '../SpendCalendarCard';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

const pushMock = vi.hoisted(() => vi.fn());

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="mock-echarts" />,
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiMocks.get,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

// A stable identity: useAnalyticsData reloads whenever `user` changes.
const authValue = vi.hoisted(() => ({
  user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => authValue,
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: {
      id: 'ws-1',
      name: 'Main workspace',
      currency: 'USD',
    },
    workspaces: [
      {
        id: 'ws-1',
        name: 'Main workspace',
        currency: 'USD',
      },
      {
        id: 'ws-2',
        name: 'Side workspace',
        currency: 'USD',
      },
    ],
  }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/app/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/app/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    handlers: {},
    pullDistance: 0,
    isRefreshing: false,
    isReadyToRefresh: false,
  }),
}));

vi.mock('@/app/i18n', async () => {
  const actual = await vi.importActual<typeof import('react-intlayer')>('react-intlayer');
  const realKeys = new Set(['statementsSpendOverTime', 'statementsAnalyticsRecords']);
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: (key: string) =>
      realKeys.has(key)
        ? actual.useIntlayer(key as never)
        : {
            common: {
              close: { value: 'Close' },
            },
            filters: {
              filters: { value: 'Filters' },
              type: { value: 'Type' },
              status: { value: 'Status' },
              date: { value: 'Date' },
              from: { value: 'From' },
              apply: { value: 'Apply' },
              reset: { value: 'Reset' },
              resetFilters: { value: 'Reset filters' },
              viewResults: { value: 'View results' },
              saveSearch: { value: 'Save search' },
              any: { value: 'Any' },
              yes: { value: 'Yes' },
              no: { value: 'No' },
              typeExpense: { value: 'Expense' },
              typeReport: { value: 'Expense Report' },
              typeChat: { value: 'Chat' },
              typeTrip: { value: 'Trip' },
              typeTask: { value: 'Task' },
              statusUnreported: { value: 'Unreported' },
              statusDraft: { value: 'Draft' },
              statusOutstanding: { value: 'Outstanding' },
              statusApproved: { value: 'Approved' },
              statusPaid: { value: 'Paid' },
              statusDone: { value: 'Done' },
              dateThisMonth: { value: 'This month' },
              dateLastMonth: { value: 'Last month' },
              dateYearToDate: { value: 'Year to date' },
              dateOn: { value: 'On' },
              dateAfter: { value: 'After' },
              dateBefore: { value: 'Before' },
              drawerTitle: { value: 'Filters' },
              drawerGeneral: { value: 'General' },
              drawerExpenses: { value: 'Expenses' },
              drawerReports: { value: 'Reports' },
              drawerGroupBy: { value: 'Group by' },
              drawerHas: { value: 'Has' },
              drawerKeywords: { value: 'Keywords' },
              drawerLimit: { value: 'Limit' },
              drawerTo: { value: 'To' },
              drawerAmount: { value: 'Amount' },
              drawerApproved: { value: 'Approved' },
              drawerBillable: { value: 'Billable' },
              groupByDate: { value: 'Date' },
              groupByStatus: { value: 'Status' },
              groupByType: { value: 'Type' },
              groupByBank: { value: 'Bank' },
              groupByUser: { value: 'User' },
              groupByAmount: { value: 'Amount' },
              hasErrors: { value: 'Errors' },
              hasLogs: { value: 'Logs' },
              hasTransactions: { value: 'Transactions' },
              hasDateRange: { value: 'Date range' },
              hasCurrency: { value: 'Currency' },
            },
          },
  };
});

vi.mock('@/app/(main)/statements/components/filters/TypeFilterDropdown', () => ({
  TypeFilterDropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/app/(main)/statements/components/filters/GroupByFilterDropdown', () => ({
  GroupByFilterDropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/app/(main)/statements/components/filters/StatusFilterDropdown', () => ({
  StatusFilterDropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/app/(main)/statements/components/filters/DateFilterDropdown', () => ({
  DateFilterDropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/app/(main)/statements/components/filters/FromFilterDropdown', () => ({
  FromFilterDropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/app/(main)/statements/components/filters/ViewFilterDropdown', () => ({
  ViewFilterDropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/app/(main)/statements/components/filters/FiltersDrawer', () => ({
  FiltersDrawer: () => null,
}));

vi.mock('@/app/components/ui/spinner', () => ({
  Spinner: () => <div data-testid="loading-animation" />,
}));

vi.mock('@/app/components/ui/filter-chip-button', () => ({
  FilterChipButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('SpendCalendarCard', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    pushMock.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    apiMocks.get.mockImplementation((url: string) => {
      if (url === '/statements') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'statement-1',
                status: 'completed',
                createdAt: '2026-01-10T00:00:00.000Z',
                statementDateFrom: '2026-01-01T00:00:00.000Z',
                statementDateTo: '2026-01-10T00:00:00.000Z',
                bankName: 'Kaspi',
                fileType: 'expense',
                currency: 'USD',
              },
              {
                id: 'statement-2',
                status: 'completed',
                createdAt: '2026-02-03T00:00:00.000Z',
                statementDateFrom: '2026-02-01T00:00:00.000Z',
                statementDateTo: '2026-02-03T00:00:00.000Z',
                bankName: 'Halyk',
                fileType: 'income',
                currency: 'USD',
              },
            ],
            total: 2,
          },
        });
      }

      if (url === '/transactions') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'tx-1',
                statementId: 'statement-1',
                transactionDate: '2026-01-10T00:00:00.000Z',
                debit: 320,
                credit: 0,
                amount: 320,
                currency: 'USD',
                transactionType: 'expense',
                counterpartyName: 'Anthropic',
                paymentPurpose: 'Claude subscription',
                isVerified: true,
              },
              {
                id: 'tx-2',
                statementId: 'statement-2',
                transactionDate: '2026-02-03T00:00:00.000Z',
                debit: 0,
                credit: 500,
                amount: 500,
                currency: 'USD',
                transactionType: 'income',
                counterpartyName: 'Client payment',
                paymentPurpose: 'January retainer',
                isVerified: true,
              },
            ],
            total: 2,
          },
        });
      }

      if (url === '/integrations/gmail/receipts') {
        return Promise.resolve({
          data: {
            receipts: [
              {
                id: 'receipt-1',
                subject: 'Uber ride',
                sender: 'Uber <noreply@uber.com>',
                receivedAt: '2026-01-12T00:00:00.000Z',
                status: 'approved',
                transactionId: null,
                parsedData: {
                  amount: 45,
                  currency: 'USD',
                  vendor: 'Uber',
                  date: '2026-01-12',
                  transactionType: 'expense',
                },
              },
              {
                id: 'receipt-2',
                subject: 'Duplicate Anthropic receipt',
                sender: 'Anthropic <billing@anthropic.com>',
                receivedAt: '2026-01-11T00:00:00.000Z',
                status: 'approved',
                transactionId: 'tx-1',
                parsedData: {
                  amount: 320,
                  currency: 'USD',
                  vendor: 'Anthropic',
                  date: '2026-01-11',
                  transactionType: 'expense',
                },
              },
            ],
            total: 2,
          },
        });
      }

      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    cleanup();
    container.remove();
    apiMocks.get.mockReset();
  });

  it('renders only the calendar, from transactions and unique gmail receipts', async () => {
    await act(async () => {
      root.render(<SpendCalendarCard displayMonth={new Date(2026, 0, 1)} />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Spend over time');
    // Nothing but the calendar: no workspace picker, filters or search.
    expect(container.textContent).not.toContain('Current workspace');
    expect(container.querySelector('input[type="text"]')).toBeNull();
    // The dashboard month, not the calendar's own navigation.
    expect(container.textContent).toContain('January 2026');
    // Compact cells: the days with spend carry their total, not merchant names.
    const activeDays = Array.from(
      container.querySelectorAll('.lumio-spend-calendar__day--active'),
    ).map(day => day.textContent);
    expect(activeDays).toHaveLength(2);
    expect(activeDays.join(' ')).toContain('320');
    expect(activeDays.join(' ')).toContain('45');
    // February's income statement is outside the rendered month.
    expect(container.textContent).not.toContain('500');
  });

  it('opens drill-down modal for a selected period row', async () => {
    await act(async () => {
      root.render(<SpendCalendarCard displayMonth={new Date(2026, 0, 1)} />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('320'),
    );

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('2026-01-10 - Drill-down');
    expect(document.body.textContent).toContain('Anthropic');
  });

  it('shows an empty calendar month when there are no operations', async () => {
    apiMocks.get.mockImplementation((url: string) => {
      if (url === '/statements') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      if (url === '/transactions') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      if (url === '/integrations/gmail/receipts') {
        return Promise.resolve({ data: { receipts: [], total: 0 } });
      }
      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });

    await act(async () => {
      root.render(<SpendCalendarCard displayMonth={new Date(2026, 0, 1)} />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.lumio-spend-calendar__grid')).toBeTruthy();
    expect(container.textContent).not.toContain('Reset filters');
  });
});
