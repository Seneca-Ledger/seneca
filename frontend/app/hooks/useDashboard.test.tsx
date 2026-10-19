import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

const workspaceMocks = vi.hoisted(() => ({
  currentWorkspaceId: 'workspace-1',
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiMocks.get,
  },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: workspaceMocks.currentWorkspaceId
      ? { id: workspaceMocks.currentWorkspaceId }
      : null,
  }),
}));

import { createTestQueryClient, renderHookWithQuery } from '../test/query-wrapper';
import { useDashboard, useDashboardTrends } from './useDashboard';

function createDashboardPayload(balance: number) {
  return {
    snapshot: {
      totalBalance: balance,
      income30d: 10,
      expense30d: 5,
      netFlow30d: 5,
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
    role: 'owner' as const,
    range: '30d' as const,
    dataHealth: {
      uncategorizedTransactions: 0,
      statementsWithErrors: 0,
      statementsPendingReview: 0,
      statementsPendingSubmit: 0,
      receiptsPendingReview: 0,
      unapprovedCash: 0,
      lastUploadDate: null,
      parsingWarnings: 0,
    },
  };
}

function createTrendsPayload(rows: number) {
  return {
    dailyTrend: [],
    forecast: [],
    categories: [],
    counterparties: [],
    sources: { statements: { income: 0, expense: 0, rows } },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useDashboard', () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
    workspaceMocks.currentWorkspaceId = 'workspace-1';
  });

  it('loads dashboard once when backend returns effective window metadata', async () => {
    apiMocks.get.mockResolvedValue({
      data: {
        ...createDashboardPayload(100),
        effectiveSince: '2025-05-01',
        effectiveEndDate: '2025-05-31',
      },
    });

    const { result } = renderHookWithQuery(() => useDashboard('30d'));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(apiMocks.get).toHaveBeenCalledTimes(1);
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/dashboard',
      expect.objectContaining({ params: { range: '30d' } }),
    );
    expect(result.current.data?.effectiveEndDate).toBe('2025-05-31');
    expect(result.current.targetDate).toBeNull();
  });

  it('performs a single fetch when user changes target date', async () => {
    apiMocks.get.mockResolvedValue({ data: createDashboardPayload(100) });

    const { result } = renderHookWithQuery(() => useDashboard('30d'));
    await waitFor(() => expect(result.current.data).toBeDefined());
    apiMocks.get.mockClear();

    result.current.changeTargetDate('2025-05-20');

    await waitFor(() => expect(result.current.targetDate).toBe('2025-05-20'));
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(1));
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/dashboard',
      expect.objectContaining({ params: { range: '30d', date: '2025-05-20' } }),
    );
  });

  it('keeps the previous month on screen while the next month loads', async () => {
    const nextMonth = createDeferred<{ data: ReturnType<typeof createDashboardPayload> }>();
    apiMocks.get
      .mockResolvedValueOnce({ data: createDashboardPayload(100) })
      .mockImplementationOnce(() => nextMonth.promise);

    const { result } = renderHookWithQuery(() => useDashboard('30d'));
    await waitFor(() => expect(result.current.data?.snapshot.totalBalance).toBe(100));

    result.current.changeTargetDate('2025-05-20');

    // Тот же воркспейс: графики остаются смонтированными вместо мигания скелетоном.
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.data?.snapshot.totalBalance).toBe(100);

    nextMonth.resolve({ data: createDashboardPayload(200) });
    await waitFor(() => expect(result.current.data?.snapshot.totalBalance).toBe(200));
  });

  it('ignores stale responses when a newer request resolves first', async () => {
    const first = createDeferred<{ data: ReturnType<typeof createDashboardPayload> }>();
    const second = createDeferred<{ data: ReturnType<typeof createDashboardPayload> }>();

    apiMocks.get
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result } = renderHookWithQuery(() => useDashboard('30d'));

    result.current.changeTargetDate('2025-05-20');
    await waitFor(() => expect(result.current.targetDate).toBe('2025-05-20'));

    second.resolve({ data: createDashboardPayload(200) });
    await waitFor(() => expect(result.current.data?.snapshot.totalBalance).toBe(200));

    first.resolve({ data: createDashboardPayload(100) });
    await waitFor(() => expect(result.current.data?.snapshot.totalBalance).toBe(200));
  });

  it('refetches dashboard data when the active workspace changes', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: createDashboardPayload(100) })
      .mockResolvedValueOnce({ data: createDashboardPayload(200) });

    const { result, rerender } = renderHookWithQuery(() => useDashboard('30d'), {
      client: createTestQueryClient(),
    });

    await waitFor(() => expect(result.current.data?.snapshot.totalBalance).toBe(100));
    expect(apiMocks.get).toHaveBeenCalledTimes(1);

    workspaceMocks.currentWorkspaceId = 'workspace-2';
    rerender();

    await waitFor(() => expect(result.current.data?.snapshot.totalBalance).toBe(200));
    expect(apiMocks.get).toHaveBeenCalledTimes(2);
  });

  it('clears previous dashboard data while loading the next workspace', async () => {
    const nextWorkspace = createDeferred<{ data: ReturnType<typeof createDashboardPayload> }>();

    apiMocks.get
      .mockResolvedValueOnce({ data: createDashboardPayload(100) })
      .mockImplementationOnce(() => nextWorkspace.promise);

    const { result, rerender } = renderHookWithQuery(() => useDashboard('30d'));
    await waitFor(() => expect(result.current.data?.snapshot.totalBalance).toBe(100));

    workspaceMocks.currentWorkspaceId = 'workspace-2';
    rerender();

    // Чужие цифры не должны показываться ни на кадр.
    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(result.current.data).toBeUndefined();

    nextWorkspace.resolve({ data: createDashboardPayload(200) });
    await waitFor(() => expect(result.current.data?.snapshot.totalBalance).toBe(200));
  });

  it('refetches trends data when the active workspace changes', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: createTrendsPayload(10) })
      .mockResolvedValueOnce({ data: createTrendsPayload(20) });

    const { result, rerender } = renderHookWithQuery(() => useDashboardTrends({ days: 30 }));

    await waitFor(() => expect(result.current.data?.sources.statements.rows).toBe(10));
    expect(apiMocks.get).toHaveBeenCalledTimes(1);

    workspaceMocks.currentWorkspaceId = 'workspace-2';
    rerender();

    await waitFor(() => expect(result.current.data?.sources.statements.rows).toBe(20));
    expect(apiMocks.get).toHaveBeenCalledTimes(2);
  });

  it('clears previous trends data while loading the next workspace', async () => {
    const nextWorkspace = createDeferred<{ data: ReturnType<typeof createTrendsPayload> }>();

    apiMocks.get
      .mockResolvedValueOnce({ data: createTrendsPayload(10) })
      .mockImplementationOnce(() => nextWorkspace.promise);

    const { result, rerender } = renderHookWithQuery(() => useDashboardTrends({ days: 30 }));
    await waitFor(() => expect(result.current.data?.sources.statements.rows).toBe(10));

    workspaceMocks.currentWorkspaceId = 'workspace-2';
    rerender();

    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(result.current.data).toBeUndefined();

    nextWorkspace.resolve({ data: createTrendsPayload(20) });
    await waitFor(() => expect(result.current.data?.sources.statements.rows).toBe(20));
  });

  it('asks for a calendar month instead of a rolling window when a month is given', async () => {
    apiMocks.get.mockResolvedValueOnce({ data: createTrendsPayload(7) });

    const { result } = renderHookWithQuery(() => useDashboardTrends({ month: '2026-07' }));

    await waitFor(() => expect(result.current.data?.sources.statements.rows).toBe(7));
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/dashboard/trends',
      expect.objectContaining({ params: { month: '2026-07' } }),
    );
  });
});
