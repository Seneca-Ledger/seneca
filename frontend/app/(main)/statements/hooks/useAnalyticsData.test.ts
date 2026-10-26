// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { receiptRecord, transactionItem } from '@/app/test/fixtures/contracts';
import { useAnalyticsData } from './useAnalyticsData';

const apiGet = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
vi.mock('react-hot-toast', () => ({ default: { error: toastError } }));

// A row of the list also names the expense it pays back, by id.
const listed = [
  { ...transactionItem({ id: 'confirmed', isVerified: true }), reimbursementOf: null },
  { ...transactionItem({ id: 'unconfirmed', isVerified: false }), reimbursementOf: null },
];

const pages: Record<string, unknown> = {
  '/statements': { data: [], items: [], total: 0, page: 1, limit: 500 },
  '/transactions': { data: listed, items: listed, total: 2, page: 1, limit: 500 },
  '/receipts/documents': {
    receipts: [
      receiptRecord({ id: 'approved', status: 'approved' }),
      receiptRecord({ id: 'draft', status: 'draft' }),
    ],
    total: 2,
    limit: 100,
    offset: 0,
  },
};

const params = {
  user: { id: 'u1' },
  currentWorkspace: { id: 'ws-1', name: 'Home' },
  workspaces: [],
  workspaceFilter: 'current',
  currentWorkspaceLabel: 'Current',
  includeTransactions: true,
};

describe('useAnalyticsData', () => {
  it('hands the statistics only what a person confirmed', async () => {
    apiGet.mockImplementation(async (url: string) => ({ data: pages[url] }));

    const { result } = renderHook(() => useAnalyticsData(params));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.transactions.map(item => item.id)).toEqual(['confirmed']);
    expect(result.current.receipts.map(item => item.id)).toEqual(['approved']);
  });

  it('does not hand the statistics a receipts page that drifts from its contract', async () => {
    const drifted = { receipts: [{ id: 'approved', status: 'approved' }], total: 1 };
    apiGet.mockImplementation(async (url: string) => ({
      data: url === '/receipts/documents' ? drifted : pages[url],
    }));

    const { result } = renderHook(() => useAnalyticsData(params));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.receipts).toEqual([]);
    expect(toastError).toHaveBeenCalled();
  });
});
