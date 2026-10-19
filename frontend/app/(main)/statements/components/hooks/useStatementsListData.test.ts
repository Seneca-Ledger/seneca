// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATEMENT_FILTERS } from '../filters/statement-filters';
import { useStatementsListData } from './useStatementsListData';

const noData = { data: undefined, isPending: true, isFetching: true, isError: false, refetch: vi.fn() };

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
vi.mock('./useStatementsQuery', () => ({ useStatementsQuery: () => noData }));
vi.mock('./useGmailReceiptsQuery', () => ({ useGmailReceiptsQuery: () => noData }));
vi.mock('./useAutoOpenParsedStatement', () => ({ useAutoOpenParsedStatement: vi.fn() }));
vi.mock('./useGmailSyncSkeletons', () => ({
  useGmailSyncSkeletons: () => ({ gmailSyncSkeletonKeys: [], setGmailSyncSkeletonKeys: vi.fn() }),
}));

describe('useStatementsListData', () => {
  // Regression: `data ?? []` minted a new empty array per render while the
  // queries had no data, which re-ran every memo and effect downstream and put
  // /statements/submit into an infinite render loop.
  it('returns the same empty arrays across renders while the queries have no data', () => {
    const { result, rerender } = renderHook(() =>
      useStatementsListData({
        appliedFilters: DEFAULT_STATEMENT_FILTERS,
        search: '',
        user: { id: 'u1' },
        page: 1,
        pageSize: 20,
        router: { replace: vi.fn() } as never,
        loadListErrorLabel: 'Failed to load statements',
        refreshFailedLabel: 'Failed to refresh statements',
      }),
    );
    const first = result.current;

    rerender();

    expect(result.current.statements).toBe(first.statements);
    expect(result.current.gmailReceipts).toBe(first.gmailReceipts);
  });
});
