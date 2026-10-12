import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import { getQueryClient } from '@/app/lib/query-client';
import { type ContractInput, checkBody } from '@/app/lib/query-fn-schema';
import type { Transaction } from '../editHelpers';

// What PUT /transactions/:id accepts (UpdateTransactionDto). The row being edited
// is a copy of the whole transaction (id, category, branch, …), and the API's
// validation rejects any field it doesn't know.
const EDITABLE_FIELDS = [
  'transactionDate',
  'documentNumber',
  'counterpartyName',
  'counterpartyBin',
  'counterpartyAccount',
  'counterpartyBank',
  'debit',
  'credit',
  'amountForeign',
  'exchangeRate',
  'currency',
  'paymentPurpose',
  'categoryId',
  'branchId',
  'walletId',
  'article',
  'transactionType',
  'comments',
] as const satisfies ReadonlyArray<keyof Transaction>;

const NUMERIC_FIELDS = new Set<keyof Transaction>([
  'debit',
  'credit',
  'amountForeign',
  'exchangeRate',
]);
const ID_FIELDS = new Set<keyof Transaction>(['categoryId', 'branchId', 'walletId']);

// Inputs hand back strings: amounts go out as numbers, a cleared select as null
// (an empty string fails the API's UUID check).
function toApiValue(field: keyof Transaction, value: unknown): unknown {
  if (NUMERIC_FIELDS.has(field)) {
    return value === '' || value === null || value === undefined ? null : Number(value);
  }
  if (ID_FIELDS.has(field)) {
    return value === '' ? null : value;
  }
  return value;
}

/** Only the fields the user actually changed, in the shape the API validates. */
export function buildTransactionUpdate(
  original: Transaction | undefined,
  edited: Partial<Transaction>,
): Partial<Record<keyof Transaction, unknown>> {
  const update: Partial<Record<keyof Transaction, unknown>> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in edited)) {
      continue;
    }
    const next = toApiValue(field, edited[field]);
    // Unchanged amounts may differ only in type ("100.00" from the API vs 100).
    if (next === toApiValue(field, original?.[field] ?? null)) {
      continue;
    }
    update[field] = next;
  }
  return update;
}

type SaveCtx = {
  original: Transaction | undefined;
  setTransactions: (fn: (prev: Transaction[]) => Transaction[]) => void;
  setEditingRow: (v: string | null) => void;
  setSuccess: (v: boolean) => void;
  setError: (v: string) => void;
  editedData: Record<string, Partial<Transaction>>;
  messages: { saveTransactionError: string };
};

export async function saveTransactionAction(txId: string, ctx: SaveCtx): Promise<void> {
  try {
    const updates = buildTransactionUpdate(ctx.original, ctx.editedData[txId] ?? {});
    if (Object.keys(updates).length > 0) {
      // PUT: the API has no PATCH route for transactions.
      await apiClient.put(
        `/transactions/${txId}`,
        await checkBody('UpdateTransactionBody', updates, '/transactions/:id'),
      );
      ctx.setTransactions(prev =>
        prev.map(t => (t.id === txId ? ({ ...t, ...updates } as Transaction) : t)),
      );
      // The dashboard and transaction lists show these rows too.
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      invalidateDocumentLists();
    }
    ctx.setEditingRow(null);
    ctx.setSuccess(true);
    setTimeout(() => ctx.setSuccess(false), 3000);
  } catch (err: unknown) {
    ctx.setError(getApiErrorMessage(err, ctx.messages.saveTransactionError));
  }
}

type DeleteCtx = {
  setTransactions: (fn: (prev: Transaction[]) => Transaction[]) => void;
  setSuccess: (v: boolean) => void;
  setError: (v: string) => void;
  messages: { deleteTransactionError: string };
};

export async function deleteTransactionAction(txId: string, ctx: DeleteCtx): Promise<void> {
  try {
    await apiClient.delete(`/transactions/${txId}`);
    ctx.setTransactions(prev => prev.filter(t => t.id !== txId));
    invalidateDocumentLists();
    ctx.setSuccess(true);
    setTimeout(() => ctx.setSuccess(false), 3000);
  } catch (err: unknown) {
    ctx.setError(getApiErrorMessage(err, ctx.messages.deleteTransactionError));
  }
}

type BulkCtx = {
  selectedRows: Set<string>;
  editedData: Record<string, Partial<Transaction>>;
  setSaving: (v: boolean) => void;
  setSelectedRows: (v: Set<string>) => void;
  setEditedData: (v: Record<string, Partial<Transaction>>) => void;
  setSuccess: (v: boolean) => void;
  setError: (v: string) => void;
  messages: { updateTransactionsError: string };
};

export async function bulkUpdateAction(loadData: () => Promise<void>, ctx: BulkCtx): Promise<void> {
  try {
    ctx.setSaving(true);
    const updates = Array.from(ctx.selectedRows)
      .filter(id => ctx.editedData[id])
      .map(id => ({ id, updates: ctx.editedData[id] }));
    await apiClient.post('/transactions/bulk-update', {
      items: updates,
    } satisfies ContractInput<'BulkUpdateRequestBody'>);
    await loadData();
    invalidateDocumentLists();
    ctx.setSelectedRows(new Set());
    ctx.setEditedData({});
    ctx.setSuccess(true);
    setTimeout(() => ctx.setSuccess(false), 3000);
  } catch (err: unknown) {
    ctx.setError(getApiErrorMessage(err, ctx.messages.updateTransactionsError));
  } finally {
    ctx.setSaving(false);
  }
}

type BulkDelCtx = {
  selectedRows: Set<string>;
  setTransactions: (fn: (prev: Transaction[]) => Transaction[]) => void;
  setSaving: (v: boolean) => void;
  setSelectedRows: (v: Set<string>) => void;
  setSuccess: (v: boolean) => void;
  setError: (v: string) => void;
  messages: { deleteTransactionsError: string };
};

export async function bulkDeleteAction(
  confirmMsg: string,
  _loadData: () => Promise<void>,
  ctx: BulkDelCtx,
): Promise<void> {
  if (!window.confirm(confirmMsg)) {
    return;
  }
  try {
    ctx.setSaving(true);
    await apiClient.post('/transactions/bulk-delete', { ids: Array.from(ctx.selectedRows) });
    ctx.setTransactions(prev => prev.filter(t => !ctx.selectedRows.has(t.id)));
    invalidateDocumentLists();
    ctx.setSelectedRows(new Set());
    ctx.setSuccess(true);
    setTimeout(() => ctx.setSuccess(false), 3000);
  } catch (err: unknown) {
    ctx.setError(getApiErrorMessage(err, ctx.messages.deleteTransactionsError));
  } finally {
    ctx.setSaving(false);
  }
}

type BulkCatCtx = {
  bulkCategoryId: string;
  selectedRows: Set<string>;
  setSaving: (v: boolean) => void;
  setSelectedRows: (v: Set<string>) => void;
  setBulkCategoryDialogOpen: (v: boolean) => void;
  setBulkCategoryId: (v: string) => void;
  setSuccess: (v: boolean) => void;
  setError: (v: string) => void;
  messages: { assignCategoryError: string };
};

export async function applyBulkCategoryAction(
  loadData: () => Promise<void>,
  ctx: BulkCatCtx,
): Promise<void> {
  if (!ctx.bulkCategoryId) {
    return;
  }
  try {
    ctx.setSaving(true);
    const items = Array.from(ctx.selectedRows).map(id => ({
      id,
      updates: { categoryId: ctx.bulkCategoryId },
    }));
    await apiClient.post('/transactions/bulk-update', {
      items,
    } satisfies ContractInput<'BulkUpdateRequestBody'>);
    await loadData();
    invalidateDocumentLists();
    ctx.setSelectedRows(new Set());
    ctx.setBulkCategoryDialogOpen(false);
    ctx.setBulkCategoryId('');
    ctx.setSuccess(true);
    setTimeout(() => ctx.setSuccess(false), 3000);
  } catch (err: unknown) {
    ctx.setError(getApiErrorMessage(err, ctx.messages.assignCategoryError));
  } finally {
    ctx.setSaving(false);
  }
}
