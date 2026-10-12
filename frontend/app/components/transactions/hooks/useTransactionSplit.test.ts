import apiClient from '@/app/lib/api';
import type { UncheckedResponse } from '@/app/lib/api';
import { apiResponse } from '@/app/test/api-response';
import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransactionSplit } from './useTransactionSplit';

vi.mock('@/app/lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useTransactionSplit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts the parts to the split endpoint and refetches', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(apiResponse({ data: [] }));
    const onDone = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTransactionSplit(onDone));

    const parts = [{ amount: 700, categoryId: 'cat-1' }, { amount: 300 }];
    await act(async () => {
      await result.current.split('tx-1', parts);
    });

    expect(apiClient.post).toHaveBeenCalledWith('/transactions/tx-1/split', { parts });
    expect(toast.success).toHaveBeenCalledWith('Transaction split');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('surfaces the backend message when the split is rejected', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({
      response: { data: { message: 'Split parts must sum to 12000, received 11000' } },
    });
    const onDone = vi.fn();
    const { result } = renderHook(() => useTransactionSplit(onDone));

    await act(async () => {
      await result.current.split('tx-1', [{ amount: 1 }, { amount: 2 }]);
    });

    expect(toast.error).toHaveBeenCalledWith('Split parts must sum to 12000, received 11000');
    expect(toast.success).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the backend sends none', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useTransactionSplit(vi.fn()));

    await act(async () => {
      await result.current.split('tx-1', [{ amount: 1 }, { amount: 2 }]);
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to split transaction');
  });

  it('posts to the unsplit endpoint and refetches', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(apiResponse({}));
    const onDone = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTransactionSplit(onDone));

    await act(async () => {
      await result.current.unsplit('tx-1');
    });

    expect(apiClient.post).toHaveBeenCalledWith('/transactions/tx-1/unsplit');
    expect(toast.success).toHaveBeenCalledWith('Split undone');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('surfaces the backend message when the unsplit is rejected', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({
      response: { data: { message: 'Transaction is not part of a split' } },
    });
    const { result } = renderHook(() => useTransactionSplit(vi.fn()));

    await act(async () => {
      await result.current.unsplit('tx-1');
    });

    expect(toast.error).toHaveBeenCalledWith('Transaction is not part of a split');
  });

  it('toggles saving while the request is in flight', async () => {
    let resolvePost: (value: UncheckedResponse) => void = () => undefined;
    vi.mocked(apiClient.post).mockReturnValue(
      new Promise(resolve => {
        resolvePost = resolve;
      }),
    );
    const { result } = renderHook(() => useTransactionSplit(vi.fn()));

    expect(result.current.saving).toBe(false);

    let pending: Promise<void>;
    act(() => {
      pending = result.current.split('tx-1', [{ amount: 1 }, { amount: 2 }]);
    });

    await waitFor(() => {
      expect(result.current.saving).toBe(true);
    });

    await act(async () => {
      resolvePost(apiResponse({}));
      await pending;
    });

    expect(result.current.saving).toBe(false);
  });
});
