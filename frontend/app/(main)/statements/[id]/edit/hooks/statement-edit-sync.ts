import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import { getQueryClient } from '@/app/lib/query-client';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import type { CategoryOption, Transaction } from '../editHelpers';

function findCategory(nodes: CategoryOption[], id: string): CategoryOption | undefined {
  for (const node of nodes) {
    const found = node.id === id ? node : findCategory(node.children ?? [], id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export type CategoryCtx = {
  categories: CategoryOption[];
  setTransactions: (fn: (prev: Transaction[]) => Transaction[]) => void;
  setError: (v: string) => void;
  messages: { saveTransactionError: string };
};

/**
 * Files rows under one category (an empty id clears it), each row to its own
 * entry of `categoryIds`. Answers whether it was saved.
 */
export async function saveCategoriesAction(
  categoryIds: Record<string, string>,
  ctx: CategoryCtx,
): Promise<boolean> {
  const ids = Object.keys(categoryIds);
  if (ids.length === 0) {
    return true;
  }
  try {
    const [onlyId] = ids;
    if (ids.length === 1 && onlyId) {
      // PUT: the API has no PATCH route for transactions.
      await apiClient.put(`/transactions/${onlyId}`, {
        categoryId: categoryIds[onlyId] || null,
      } satisfies ContractInput<'UpdateTransactionBody'>);
    } else {
      await apiClient.post('/transactions/bulk-update', {
        items: ids.map(id => ({ id, updates: { categoryId: categoryIds[id] || null } })),
      } satisfies ContractInput<'BulkUpdateRequestBody'>);
    }
    const categoryOf = (categoryId: string | undefined): Transaction['category'] => {
      const node = categoryId ? findCategory(ctx.categories, categoryId) : undefined;
      return node
        ? {
            id: node.id,
            name: node.name,
            isEnabled: node.isEnabled,
            source: node.source,
            isSystem: node.isSystem,
          }
        : undefined;
    };
    ctx.setTransactions(prev =>
      prev.map(t => {
        if (!(t.id in categoryIds)) {
          return t;
        }
        const category = categoryOf(categoryIds[t.id]);
        return { ...t, categoryId: category?.id, category };
      }),
    );
    // The dashboard and transaction lists show these rows too.
    const queryClient = getQueryClient();
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    invalidateDocumentLists();
    return true;
  } catch (err: unknown) {
    ctx.setError(getApiErrorMessage(err, ctx.messages.saveTransactionError));
    return false;
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
