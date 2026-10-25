import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import type { Category } from './useCategoryManagement';

type BulkActionsParams = {
  categories: Category[];
  selectedIds: Set<string>;
  setSelectedIds: (v: Set<string>) => void;
  loadCategories: () => Promise<void>;
  saveFailed: string;
};

/** Enables, disables or deletes every selected category at once. */
export function useCategoryBulkActions({
  categories,
  selectedIds,
  setSelectedIds,
  loadCategories,
  saveFailed,
}: BulkActionsParams): {
  handleBulkEnable: (enable: boolean) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
} {
  const { manage } = useIntlayer('categoriesPage');

  const handleBulkEnable = async (enable: boolean): Promise<void> => {
    await (async () => {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          apiClient.put(`/categories/${id}`, {
            isEnabled: enable,
          } satisfies ContractInput<'UpdateCategoryBody'>),
        ),
      );
      toast.success((enable ? manage.toasts.enabled : manage.toasts.disabled).value);
      await loadCategories();
      setSelectedIds(new Set());
    })().catch(async err => {
      console.error('Bulk toggle failed:', err);
      toast.error(saveFailed);
    });
  };

  const handleBulkDelete = async (): Promise<void> => {
    if (!window.confirm(manage.confirmBulkDelete.value)) {
      return;
    }

    await (async () => {
      const ids = Array.from(selectedIds).filter(
        id => !categories.find(c => c.id === id)?.isSystem,
      );
      await Promise.all(ids.map(id => apiClient.delete(`/categories/${id}`)));
      toast.success(manage.toasts.deleted.value);
      await loadCategories();
      setSelectedIds(new Set());
    })().catch(async err => {
      console.error('Bulk delete failed:', err);
      toast.error(manage.toasts.deleteFailed.value);
    });
  };

  return { handleBulkEnable, handleBulkDelete };
}
