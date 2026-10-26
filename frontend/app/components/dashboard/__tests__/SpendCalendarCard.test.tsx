import { cleanup } from '@testing-library/react';
// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatementListItem } from '@/app/lib/contracts';
import { receiptRecord, transactionItem } from '@/app/test/fixtures/contracts';
import { SpendCalendarCard } from '../SpendCalendarCard';

/** A completed `GET /statements` row covering `from`..`to`. */
function statement(row: { id: string; bankName: string; from: string; to: string }): StatementListItem {
  return {
    id: row.id,
    fileName: `${row.id}.pdf`,
    fileType: 'pdf',
    bankName: row.bankName,
    status: 'completed',
    stage: 'submit',
    errorMessage: null,
    totalTransactions: 1,
    totalDebit: '0',
    totalCredit: '0',
    balanceStart: null,
    balanceEnd: null,
    currency: 'USD',
    statementDateFrom: row.from,
    statementDateTo: row.to,
    createdAt: `${row.to}T00:00:00.000Z`,
    updatedAt: `${row.to}T00:00:00.000Z`,
    processedAt: null,
    categoryId: null,
    category: null,
    tags: [],
    user: null,
    parsingDetails: null,
    transactionSummary: { description: null, exchangeRate: null, exchangeRateMixed: false, cardLabel: null },
  };
}

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
  const realKeys = new Set(['statementsSpendOverTime', 'statementsAnalyticsRecords', 'statementsPage']);
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

    // Shaped like the StatementListPage and TransactionListPage contracts,
    // which the analytics loader checks every page against.
    const page = <T,>(rows: T[]) => ({
      data: { data: rows, items: rows, total: rows.length, page: 1, limit: 500 },
    });
    apiMocks.get.mockImplementation((url: string) => {
      if (url === '/statements') {
        return Promise.resolve(
          page([
            statement({ id: 'statement-1', bankName: 'Example Bank', from: '2026-01-01', to: '2026-01-10' }),
            statement({ id: 'statement-2', bankName: 'Second Bank', from: '2026-02-01', to: '2026-02-03' }),
          ]),
        );
      }
      if (url === '/transactions') {
        return Promise.resolve(
          page([
            {
              ...transactionItem({
                id: 'tx-1',
                statementId: 'statement-1',
                transactionDate: '2026-01-10',
                debit: '320.00',
                amount: '-320.00',
                counterpartyName: 'ACME Cloud',
                paymentPurpose: 'ACME Cloud subscription',
                isVerified: true,
              }),
              reimbursementOf: null,
            },
            {
              ...transactionItem({
                id: 'tx-2',
                statementId: 'statement-2',
                transactionDate: '2026-02-03',
                transactionType: 'income',
                debit: null,
                credit: '500.00',
                amount: '500.00',
                counterpartyName: 'Client payment',
                paymentPurpose: 'January retainer',
                isVerified: true,
              }),
              reimbursementOf: null,
            },
          ]),
        );
      }
      if (url === '/receipts/documents') {
        return Promise.resolve({
          data: {
            receipts: [
              receiptRecord({
                id: 'receipt-1',
                subject: 'City Rides trip',
                sender: 'City Rides <noreply@example.com>',
                receivedAt: '2026-01-12T00:00:00.000Z',
                status: 'approved',
                transactionId: null,
                parsedData: {
                  amount: 45,
                  currency: 'USD',
                  vendor: 'City Rides',
                  date: '2026-01-12',
                  transactionType: 'expense',
                },
              }),
              receiptRecord({
                id: 'receipt-2',
                subject: 'Duplicate ACME Cloud receipt',
                sender: 'ACME Cloud <billing@example.com>',
                receivedAt: '2026-01-11T00:00:00.000Z',
                status: 'approved',
                transactionId: 'tx-1',
                parsedData: {
                  amount: 320,
                  currency: 'USD',
                  vendor: 'ACME Cloud',
                  date: '2026-01-11',
                  transactionType: 'expense',
                },
              }),
            ],
            total: 2,
            limit: 100,
            offset: 0,
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

  it('renders only the calendar, from transactions and unique receipts', async () => {
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
      container.querySelectorAll('.seneca-spend-calendar__day--active'),
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
    expect(document.body.textContent).toContain('ACME Cloud');
  });

  it('shows an empty calendar month when there are no operations', async () => {
    apiMocks.get.mockImplementation((url: string) => {
      if (url === '/statements' || url === '/transactions') {
        return Promise.resolve({ data: { data: [], items: [], total: 0, page: 1, limit: 500 } });
      }
      if (url === '/receipts/documents') {
        return Promise.resolve({ data: { receipts: [], total: 0, limit: 100, offset: 0 } });
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

    expect(container.querySelector('.seneca-spend-calendar__grid')).toBeTruthy();
    expect(container.textContent).not.toContain('Reset filters');
  });
});
