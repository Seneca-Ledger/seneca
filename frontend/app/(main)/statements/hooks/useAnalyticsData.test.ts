// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAnalyticsData } from './useAnalyticsData';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

const pages: Record<string, unknown> = {
  '/statements': { data: [], total: 0 },
  '/transactions': {
    data: [
      { id: 'confirmed', isVerified: true },
      { id: 'unconfirmed', isVerified: false },
    ],
    total: 2,
  },
  '/integrations/gmail/receipts': {
    receipts: [
      { id: 'approved', status: 'approved' },
      { id: 'draft', status: 'draft' },
    ],
    total: 2,
  },
};

describe('useAnalyticsData', () => {
  it('hands the statistics only what a person confirmed', async () => {
    apiGet.mockImplementation(async (url: string) => ({ data: pages[url] }));

    const { result } = renderHook(() =>
      useAnalyticsData({
        user: { id: 'u1' },
        currentWorkspace: { id: 'ws-1', name: 'Home' },
        workspaces: [],
        workspaceFilter: 'current',
        currentWorkspaceLabel: 'Current',
        includeTransactions: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.transactions.map(item => item.id)).toEqual(['confirmed']);
    expect(result.current.gmailReceipts.map(item => item.id)).toEqual(['approved']);
  });
});
