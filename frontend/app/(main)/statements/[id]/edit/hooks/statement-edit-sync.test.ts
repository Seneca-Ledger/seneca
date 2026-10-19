import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../editHelpers';
import { buildTransactionUpdate, saveTransactionAction } from './statement-edit-sync';

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  patch: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({ default: { put: mocks.put, patch: mocks.patch } }));
vi.mock('@/app/lib/query-client', () => ({
  getQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

// As the API returns it: decimals come back as strings, relations embedded.
const original = {
  id: 'tx-1',
  transactionDate: '2026-09-25',
  counterpartyName: '1 / 4',
  paymentPurpose: 'Receipt',
  debit: '100.00',
  transactionType: 'expense',
  categoryId: 'cat-1',
  category: { id: 'cat-1', name: 'Food' },
} as unknown as Transaction;

function ctxFor(edited: Partial<Transaction>) {
  return {
    original,
    editedData: { 'tx-1': edited },
    setTransactions: vi.fn(),
    setEditingRow: vi.fn(),
    setSuccess: vi.fn(),
    setError: vi.fn(),
    messages: { saveTransactionError: 'Could not save' },
  };
}

describe('saveTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.put.mockResolvedValue({ data: {} });
  });

  it('saves a renamed counterparty with PUT, sending only that field', async () => {
    // The row editor starts from a full copy of the transaction.
    const ctx = ctxFor({ ...original, counterpartyName: 'Lidl' });

    await saveTransactionAction('tx-1', ctx);

    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.put).toHaveBeenCalledWith('/transactions/tx-1', { counterpartyName: 'Lidl' });
    expect(ctx.setError).not.toHaveBeenCalled();
    expect(ctx.setEditingRow).toHaveBeenCalledWith(null);
  });

  it('refreshes the dashboard and transaction lists after a save', async () => {
    await saveTransactionAction('tx-1', ctxFor({ ...original, counterpartyName: 'Lidl' }));

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
  });

  it('makes no request when nothing changed', async () => {
    const ctx = ctxFor({ ...original });

    await saveTransactionAction('tx-1', ctx);

    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(ctx.setEditingRow).toHaveBeenCalledWith(null);
  });
});

describe('buildTransactionUpdate', () => {
  it('sends typed amounts, clears a select with null and ignores unknown fields', () => {
    expect(
      buildTransactionUpdate(original, {
        ...original,
        debit: '120.5' as unknown as number,
        categoryId: '',
      }),
    ).toEqual({ debit: 120.5, categoryId: null });
  });

  it('treats an amount that differs only in type as unchanged', () => {
    expect(
      buildTransactionUpdate(original, { debit: '100' as unknown as number }),
    ).toEqual({});
  });
});
