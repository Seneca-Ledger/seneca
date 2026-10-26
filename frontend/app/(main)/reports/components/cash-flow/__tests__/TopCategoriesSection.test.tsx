import { cleanup, waitFor } from '@testing-library/react';
// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/app/test/query-wrapper';
import { TopCategoriesSection } from '../TopCategoriesSection';
import { analyticsResponse } from './top-categories.fixtures';

// The analytics behind the section load through React Query.
function renderSection(root: ReturnType<typeof createRoot>): void {
  root.render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TopCategoriesSection focusId="none" />
    </QueryClientProvider>,
  );
}

/** The section opens on the chart; the rows are one switch away, on the table. */
async function openTable(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  await act(async () => {
    renderSection(root);
  });
  const tableToggle = () =>
    Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Table');
  await waitFor(() => expect(tableToggle()).toBeTruthy());
  await act(async () => {
    tableToggle()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await waitFor(() => expect(container.textContent).toContain('Software'));
}

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

// The page reads its month from `?month=` and opens on the table when an
// advice link rings a row; the fixtures below are February 2026.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/reports',
  useSearchParams: () => new URLSearchParams('month=2026-02'),
}));
vi.mock('@/app/hooks/useAttentionFocus', () => ({ useAttentionFocus: () => 'none' }));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="mock-echarts" />,
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiMocks.get,
  },
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
    ],
  }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/app/i18n', async () => {
  const actual = await vi.importActual<typeof import('react-intlayer')>('react-intlayer');
  // statementsPage is real: the section's labels come only from its en dictionary.
  const realKeys = new Set(['statementsAnalyticsRecords', 'dashboardHeader', 'statementsPage']);
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



vi.mock('@/app/(main)/statements/components/filters/DateFilterDropdown', () => ({
  DateFilterDropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/app/(main)/statements/components/filters/FromFilterDropdown', () => ({
  FromFilterDropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
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

describe('TopCategoriesSection', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // jsdom has no ResizeObserver; the chart view only needs it to exist.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );

    apiMocks.get.mockImplementation(analyticsResponse);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    cleanup();
    container.remove();
    apiMocks.get.mockReset();
  });

  it('renders aggregated categories from transactions and non-duplicated receipts', async () => {
    await openTable(container, root);

    expect(container.textContent).toContain('Top categories');
    expect(container.textContent).toContain('Software');
    expect(container.textContent).toContain('Travel');
    expect(container.textContent).not.toContain('Duplicate software receipt');
  });

  it('opens a drilldown modal for a selected category row', async () => {
    await openTable(container, root);

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Software'),
    );

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // en statementsPage › topCategoriesAnalytics.drillDown
    expect(document.body.textContent).toContain('Software - Drill-down');
    expect(document.body.textContent).toContain('Main workspace');
  });
});
