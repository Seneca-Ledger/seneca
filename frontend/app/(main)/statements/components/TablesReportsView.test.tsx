import { createTestQueryClient } from '@/app/test/query-wrapper';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TablesReportsView from './TablesReportsView';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const themeMock = vi.hoisted(() => ({
  resolvedTheme: 'light' as 'light' | 'dark',
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="mock-echarts" />,
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiMocks.get,
    post: apiMocks.post,
  },
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
  }),
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
  useTheme: () => themeMock,
}));

vi.mock('@/app/i18n', async () => {
  const actual = await vi.importActual<typeof import('react-intlayer')>('react-intlayer');
  const realKeys = new Set(['statementsTablesReports']);
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: (key: string) =>
      realKeys.has(key)
        ? actual.useIntlayer(key as never)
        : {
            common: {
              close: { value: 'Close' },
            },
          },
  };
});

vi.mock('@/app/components/ui/spinner', () => ({
  Spinner: () => <div data-testid="loading-animation" />,
}));

describe('TablesReportsView', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    themeMock.resolvedTheme = 'light';
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    apiMocks.get.mockImplementation((url: string) => {
      if (url === '/reports/custom-tables/available') {
        return Promise.resolve({
          data: [
            { id: 'table-1', name: 'Manual Table', source: 'manual', rowCount: 3 },
            {
              id: 'table-2',
              name: 'Second Table',
              source: 'manual',
              rowCount: 7,
            },
          ],
        });
      }

      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });

    apiMocks.post.mockImplementation((url: string) => {
      if (url === '/reports/custom-tables/report') {
        return Promise.resolve({
          data: {
            totals: {
              total: 225,
              manualTotal: 225,
              operations: 3,
            },
            comparison: {
              totalDelta: 10,
              totalPercentage: 5,
              totalTrend: 'up',
              manualDelta: 5,
              manualPercentage: 3,
              manualTrend: 'up',
              operationsDelta: 1,
              operationsPercentage: 50,
              operationsTrend: 'up',
            },
            timeseries: [
              { date: '2026-03-10', amount: 100 },
              { date: '2026-03-11', amount: 50 },
            ],
            sourceSplit: { manual: 225 },
            aggregatedRows: [
              {
                counterparty: 'Vendor A',
                source: 'manual',
                tableId: 'table-1',
                tableName: 'Manual Table',
                count: 2,
                total: 100,
                average: 50,
                lastDate: '2026-03-10',
                currency: 'USD',
              },
            ],
            tables: [
              {
                id: 'table-1',
                name: 'Manual Table',
                source: 'manual',
                total: 175,
                rows: 2,
              },
            ],
          },
        });
      }

      if (url === '/reports/custom-tables/report/drill-down') {
        return Promise.resolve({
          data: {
            counterparty: 'Vendor A',
            items: [
              {
                rowId: 'row-1',
                tableId: 'table-1',
                tableName: 'Manual Table',
                source: 'manual',
                date: '2026-03-10',
                amount: 100,
                category: 'Ops',
                currency: 'USD',
              },
            ],
          },
        });
      }

      return Promise.reject(new Error(`Unhandled POST ${url}`));
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    cleanup();
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
  });

  it('loads tables report data and renders summary content', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={createTestQueryClient()}>
          <TablesReportsView />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Tables reports');
    expect(container.textContent).toContain('Aggregated insights from your custom tables');
    expect(container.textContent).toContain('Vendor A');
    expect(container.textContent).toContain('Manual Table');
    expect(apiMocks.get).toHaveBeenCalledWith('/reports/custom-tables/available');
    expect(apiMocks.post).toHaveBeenCalledWith(
      '/reports/custom-tables/report',
      {
        days: 30,
        flowType: 'all',
        sortBy: 'amount',
        search: undefined,
        limit: 60,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('opens tables dropdown and refetches report with selected tables', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={createTestQueryClient()}>
          <TablesReportsView />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const dropdownTrigger = screen.getByRole('button', { name: /^Tables$/i });

    await act(async () => {
      fireEvent.click(dropdownTrigger);
    });

    expect(screen.getByText('Second Table')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/select table second table/i));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.post).toHaveBeenLastCalledWith(
      '/reports/custom-tables/report',
      {
        days: 30,
        flowType: 'all',
        sortBy: 'amount',
        search: undefined,
        limit: 60,
        tableIds: ['table-2'],
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('opens drill-down modal when clicking a leaderboard row', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={createTestQueryClient()}>
          <TablesReportsView />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('row', { name: /Vendor A Manual Manual Table 2 50 100/i }));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.post).toHaveBeenCalledWith('/reports/custom-tables/report/drill-down', {
      counterparty: 'Vendor A',
      days: 30,
      flowType: 'all',
      limit: 120,
    });
    expect(screen.getByText(/Vendor A — Drill-down/i)).toBeInTheDocument();
    expect(screen.queryByText('No records found')).not.toBeInTheDocument();
    expect(screen.getByText('100 USD')).toBeInTheDocument();
    expect(screen.getAllByText('Manual')).toHaveLength(2);
  });

  it('keeps focus inside the drill-down and closes it with Escape', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={createTestQueryClient()}>
          <TablesReportsView />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('row', { name: /Vendor A/i }));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialog = screen.getByRole('dialog', { name: /Vendor A — Drill-down/i });
    expect(dialog.parentElement?.contains(document.activeElement)).toBe(true);

    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('includes dark theme surface classes for the main controls and cards', async () => {
    themeMock.resolvedTheme = 'dark';

    await act(async () => {
      root.render(
        <QueryClientProvider client={createTestQueryClient()}>
          <TablesReportsView />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByPlaceholderText('Search counterparties, categories, tables...').className,
    ).toContain('dark:bg-slate-900/60');
    expect(screen.getByRole('button', { name: /^Tables$/i }).className).toContain(
      'dark:border-slate-700',
    );
    expect(screen.getByText('Total').parentElement?.className).toContain('dark:bg-slate-900/60');
    expect(screen.getByText('Top counterparties').parentElement?.className).toContain(
      'dark:border-slate-700/70',
    );
  });
});
