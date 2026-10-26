import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/hooks/useAuth';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { CategoryUsageCount } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { Category, CategoryLabels, CategoryRowActions } from '../category-labels';

/** The categories page's data, dialogs and row actions. */
export function useCategoriesPage() {
  const t = useIntlayer('categoriesPage');
  const { user } = useAuth();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState<{
    category: Category;
    usage: CategoryUsageCount;
  } | null>(null);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    enabled: Boolean(user),
  });
  const usageQuery = useQuery({
    queryKey: queryKeys.categoryUsage(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories/usage/counts', signal, contract: 'CategoryUsageCounts' }),
    enabled: Boolean(user),
  });

  const labels = useMemo<CategoryLabels>(
    () => ({
      name: t.columns.name.value,
      lastActivity: t.columns.lastActivity.value,
      never: t.never.value,
      usesOne: t.usesOne.value,
      usesMany: t.usesMany.value,
      disabled: t.disabledMark.value,
      system: t.sourceBadges.system.value,
      parsing: t.sourceBadges.parsing.value,
      menu: t.actions.menu.value,
      edit: t.actions.edit.value,
      enable: t.manage.enable.value,
      disable: t.manage.disable.value,
      delete: t.actions.delete.value,
      search: t.searchPlaceholder.value,
    }),
    [t],
  );

  const refresh = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryUsage(workspaceId) }),
    ]);
  };

  const setEnabled = async (category: Category, isEnabled: boolean): Promise<void> => {
    setDisableConfirm(null);
    await (async () => {
      await apiClient.put(`/categories/${category.id}`, {
        isEnabled,
      } satisfies ContractInput<'UpdateCategoryBody'>);
      // One row changes: patch it in the cache rather than blanking the list.
      queryClient.setQueryData<Category[]>(queryKeys.categories(workspaceId), previous =>
        (previous ?? []).map(item => (item.id === category.id ? { ...item, isEnabled } : item)),
      );
    })().catch(async error => {
      console.error('Failed to toggle category state:', error);
      toast.error(t.toasts.saveFailed.value);
    });
  };

  const handleToggle = async (category: Category): Promise<void> => {
    const nextEnabled = category.isEnabled === false;
    if (!nextEnabled) {
      const usage = await apiQueryDecoded({
        url: `/categories/${category.id}/usage-count`,
        contract: 'CategoryUsageCount',
      }).catch((error: unknown) => {
        console.error('Failed to get category usage count:', error);
        return null;
      });
      if (usage && usage.total > 0) {
        setDisableConfirm({ category, usage });
        return;
      }
    }
    await setEnabled(category, nextEnabled);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    await (async () => {
      await apiClient.delete(`/categories/${deleteTarget.id}`);
      toast.success(t.toasts.deleted.value);
      await refresh();
      setDeleteTarget(null);
    })()
      .catch(async error => {
        console.error('Failed to delete category:', error);
        toast.error(t.toasts.deleteFailed.value);
      })
      .finally(() => setDeleting(false));
  };

  const openDialog = (category: Category | null): void => {
    setEditing(category);
    setDialogOpen(true);
  };

  const actions: CategoryRowActions = {
    onEdit: category => openDialog(category),
    onToggle: category => void handleToggle(category),
    onDelete: category => setDeleteTarget(category),
  };

  return {
    t,
    categoriesQuery,
    usageQuery,
    labels,
    actions,
    search,
    setSearch,
    dialogOpen,
    editing,
    deleteTarget,
    deleting,
    disableConfirm,
    openDialog,
    closeDialog: (): void => {
      setDialogOpen(false);
      setEditing(null);
    },
    setDeleteTarget,
    setDisableConfirm,
    handleDelete,
    setEnabled,
  };
}
