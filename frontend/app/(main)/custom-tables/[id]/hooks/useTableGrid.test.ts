import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();

vi.mock('@/app/lib/api', () => ({ default: { get: (...args: unknown[]) => get(...args) } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

import { useTableGrid } from './useTableGrid';

const params = {
  tableId: 't1',
  isAuthenticated: true,
  combinedFiltersParam: undefined,
  sort: null,
  loadRowsFailedMessage: 'failed',
};

describe('useTableGrid', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { items: [], meta: { total: 0 } } });
  });

  // Раньше loadRows зависел от заново создаваемых на каждый рендер помощников,
  // из-за чего эффект сброса дергал setRows([]) бесконечно.
  it('keeps loadRows stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useTableGrid(params));
    const first = result.current.loadRows;
    rerender();
    rerender();
    expect(result.current.loadRows).toBe(first);
  });

  it('settles instead of re-rendering forever', async () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useTableGrid(params);
    });
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(renders).toBeLessThan(10);
  });
});
