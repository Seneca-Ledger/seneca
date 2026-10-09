// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStatementSelection } from './useStatementSelection';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/app/lib/api', () => ({ default: {}, gmailReceiptsApi: {} }));

const baseParams = {
  displayStatements: [],
  duplicateMetaById: new Map(),
  setDuplicateOverrides: vi.fn(),
  search: '',
  onRefreshStatements: async () => {},
  onRefreshGmail: async () => {},
};

describe('useStatementSelection', () => {
  // Regression: while the list query had no data, the parent handed down a new
  // (equal) ids array on every render and the prune effect set a new selection
  // array each time — "Maximum update depth exceeded" on /statements/submit.
  it('does not loop when the visible ids are a new but equal array every render', () => {
    expect(() =>
      renderHook(() => useStatementSelection({ ...baseParams, visibleStatementIds: ['a', 'b'] })),
    ).not.toThrow();
  });

  it('keeps the same selection array when every selected id is still visible', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useStatementSelection({ ...baseParams, visibleStatementIds: ids }),
      { initialProps: { ids: ['a', 'b'] } },
    );
    act(() => result.current.handleToggleStatement('a'));
    const selection = result.current.selectedStatementIds;

    rerender({ ids: ['a', 'b'] });

    expect(result.current.selectedStatementIds).toBe(selection);
  });

  it('still drops selected ids that leave the page', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useStatementSelection({ ...baseParams, visibleStatementIds: ids }),
      { initialProps: { ids: ['a', 'b'] } },
    );
    act(() => result.current.handleToggleStatement('a'));
    act(() => result.current.handleToggleStatement('b'));

    rerender({ ids: ['b', 'c'] });

    expect(result.current.selectedStatementIds).toEqual(['b']);
  });
});
