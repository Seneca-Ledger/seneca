import apiClient from '@/app/lib/api';
import { apiResponse } from '@/app/test/api-response';
import { act, renderHook } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransferLink } from './useTransferLink';

vi.mock('@/app/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useTransferLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the counterpart candidates for a transaction', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(apiResponse({
        data: [
          // The wire format (packages/contracts TransactionCandidates).
          {
            id: 'tx-2',
            statementId: null,
            cryptoWalletId: null,
            ownerMemberId: null,
            isPrivate: false,
            privateCategoryId: null,
            transferPairId: null,
            transferPairSource: null,
            transferPairKind: null,
            reimbursementOfId: null,
            transactionDate: '2026-03-11',
            transactionType: 'income',
            isVerified: true,
            documentNumber: null,
            counterpartyName: 'Savings',
            counterpartyBin: null,
            counterpartyAccount: null,
            counterpartyBank: null,
            paymentPurpose: 'Top-up',
            debit: null,
            credit: '100.00',
            amount: '100.00',
            currency: 'EUR',
            exchangeRate: null,
            amountForeign: null,
            categoryId: null,
            branchId: null,
            walletId: null,
            article: null,
            comments: null,
            createdAt: '2026-03-11T09:00:00.000Z',
            updatedAt: '2026-03-11T09:00:00.000Z',
          },
        ],
      }));
    const { result } = renderHook(() => useTransferLink(vi.fn()));

    await act(async () => {
      await result.current.loadCandidates('tx-1');
    });

    expect(apiClient.get).toHaveBeenCalledWith('/transactions/tx-1/transfer-candidates');
    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.candidates?.[0]).toMatchObject({ id: 'tx-2', amount: 100 });
    expect(result.current.loading).toBe(false);
  });

  it('links two legs, drops the picker and refetches', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(apiResponse({ transferPairId: 'pair' }));
    const onDone = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTransferLink(onDone));

    await act(async () => {
      await result.current.link('tx-1', 'tx-2');
    });

    expect(apiClient.post).toHaveBeenCalledWith('/transactions/tx-1/link-transfer', {
      otherId: 'tx-2',
    });
    expect(toast.success).toHaveBeenCalledWith('Linked as a transfer');
    expect(result.current.candidates).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('surfaces the backend message when the link is refused', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({
      response: { data: { message: 'Transaction a is already part of a transfer' } },
    });
    const onDone = vi.fn();
    const { result } = renderHook(() => useTransferLink(onDone));

    await act(async () => {
      await result.current.link('tx-1', 'tx-2');
    });

    expect(toast.error).toHaveBeenCalledWith('Transaction a is already part of a transfer');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('unlinks and refetches', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(apiResponse({ unlinked: true }));
    const onDone = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTransferLink(onDone));

    await act(async () => {
      await result.current.unlink('tx-1');
    });

    expect(apiClient.post).toHaveBeenCalledWith('/transactions/tx-1/unlink-transfer');
    expect(toast.success).toHaveBeenCalledWith('Transfer unlinked');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic message when the backend sends none', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useTransferLink(vi.fn()));

    await act(async () => {
      await result.current.loadCandidates('tx-1');
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to update the transfer');
    expect(result.current.candidates).toBeNull();
  });
});
