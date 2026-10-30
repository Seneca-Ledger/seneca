import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryOption, Transaction } from '../editHelpers';
import { saveCategoriesAction } from './statement-edit-sync';

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({ default: { put: mocks.put, post: mocks.post, patch: mocks.patch } }));
vi.mock('@/app/lib/query-client', () => ({
  getQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

const child: CategoryOption = { id: 'cat-2', name: 'Groceries', isEnabled: true };
const categories: CategoryOption[] = [{ id: 'cat-1', name: 'Food', children: [child] }];

const row: Transaction = {
  id: 'tx-1',
  transactionDate: '2026-09-25',
  counterpartyName: 'ACME Store',
  paymentPurpose: 'Receipt',
  debit: 100,
  transactionType: 'expense',
};
const twin: Transaction = { ...row, id: 'tx-2' };

function ctx() {
  let rows: Transaction[] = [row, twin];
  return {
    categories,
    setTransactions: vi.fn((fn: (prev: Transaction[]) => Transaction[]) => {
      rows = fn(rows);
    }),
    setError: vi.fn(),
    messages: { saveTransactionError: 'Could not save' },
    rows: () => rows,
  };
}

describe('saveCategoriesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.put.mockResolvedValue({ data: {} });
    mocks.post.mockResolvedValue({ data: {} });
  });

  it('sends only the category and shows the picked one, found deep in the tree', async () => {
    const c = ctx();

    await saveCategoriesAction({ [row.id]: child.id }, c);

    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.put).toHaveBeenCalledWith(`/transactions/${row.id}`, { categoryId: child.id });
    expect(c.rows()[0]?.categoryId).toBe(child.id);
    expect(c.rows()[0]?.category?.name).toBe(child.name);
    expect(c.rows()[1]?.categoryId).toBeUndefined();
    expect(c.setError).not.toHaveBeenCalled();
  });

  it('files several rows in one bulk request, each to its own category', async () => {
    const c = ctx();

    const saved = await saveCategoriesAction({ [row.id]: child.id, [twin.id]: '' }, c);

    expect(saved).toBe(true);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledWith('/transactions/bulk-update', {
      items: [
        { id: row.id, updates: { categoryId: child.id } },
        { id: twin.id, updates: { categoryId: null } },
      ],
    });
    expect(c.rows().map(r => r.categoryId)).toEqual([child.id, undefined]);
  });

  it('clears the category with null', async () => {
    const c = ctx();

    await saveCategoriesAction({ [row.id]: '' }, c);

    expect(mocks.put).toHaveBeenCalledWith(`/transactions/${row.id}`, { categoryId: null });
    expect(c.rows()[0]?.category).toBeUndefined();
  });

  it('refreshes the dashboard and transaction lists after a save', async () => {
    await saveCategoriesAction({ [row.id]: child.id }, ctx());

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
  });

  it('keeps the row and reports the error when the save fails', async () => {
    mocks.put.mockRejectedValue(new Error('offline'));
    const c = ctx();

    await saveCategoriesAction({ [row.id]: child.id }, c);

    expect(c.setTransactions).not.toHaveBeenCalled();
    expect(c.setError).toHaveBeenCalled();
  });
});
