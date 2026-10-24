'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from '@/app/components/ConfirmModal';
import { CategoryFormDialog } from '@/app/components/categories/CategoryFormDialog';
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import { DataGrid, type GridColumnDef, useDataGrid } from '@/app/components/data-grid';
import {
  BookmarkOutline,
  Eye,
  EyeOff,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { PageTitle } from '@/app/components/ui/page-title';
import { useAuth } from '@/app/hooks/useAuth';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { CategoryItem, CategoryUsageCount } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { formatStoredDate } from '@/app/lib/user-format-store';

type Category = CategoryItem;

interface CategoryRowActions {
  onEdit: (category: Category) => void;
  onToggle: (category: Category) => void;
  onDelete: (category: Category) => void;
}

interface CategoryLabels {
  name: string;
  lastActivity: string;
  never: string;
  usesOne: string;
  usesMany: string;
  disabled: string;
  system: string;
  parsing: string;
  menu: string;
  edit: string;
  enable: string;
  disable: string;
  delete: string;
  search: string;
}

const formatUses = (labels: CategoryLabels, count: number): string =>
  (count === 1 ? labels.usesOne : labels.usesMany).replace('{count}', String(count));

function CategoryActionsMenu({
  category,
  labels,
  actions,
  tourAnchor,
}: {
  category: Category;
  labels: CategoryLabels;
  actions: CategoryRowActions;
  tourAnchor: boolean;
}) {
  const enabled = category.isEnabled !== false;
  // MUI Menu walks its children for focus; a Fragment would hide them, so the items are an array.
  const items = [
    <DropdownMenuItem key="edit" onSelect={() => actions.onEdit(category)}>
      <Pencil size={14} aria-hidden />
      {labels.edit}
    </DropdownMenuItem>,
    <DropdownMenuItem key="toggle" onSelect={() => actions.onToggle(category)}>
      {enabled ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
      {enabled ? labels.disable : labels.enable}
    </DropdownMenuItem>,
  ];
  if (!category.isSystem) {
    items.push(
      <DropdownMenuSeparator key="separator" />,
      <DropdownMenuItem key="delete" onSelect={() => actions.onDelete(category)}>
        <Trash2 size={14} aria-hidden />
        {labels.delete}
      </DropdownMenuItem>,
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="seneca-categories__menu"
          data-tour-id={tourAnchor ? 'category-toggle' : undefined}
          aria-label={`${labels.menu}: ${category.name}`}
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function useCategoryColumns(options: {
  labels: CategoryLabels;
  locale: string;
  usage: Record<string, CategoryUsageCount>;
  search: string;
  onSearch: (value: string) => void;
  actions: CategoryRowActions;
}) {
  const { labels, locale, usage, search, onSearch, actions } = options;
  return useMemo<GridColumnDef<Category, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: row => getCategoryDisplayName(row, locale),
        header: labels.name,
        sortFn: 'text',
        size: 360,
        meta: {
          label: labels.name,
          headerActions: (
            <input
              type="search"
              className="seneca-categories__search"
              value={search}
              onChange={event => onSearch(event.target.value)}
              placeholder={labels.search}
              aria-label={labels.search}
              data-tour-id="categories-search"
            />
          ),
        },
        cell: ({ row }) => {
          const category = row.original;
          const enabled = category.isEnabled !== false;
          return (
            <span
              className={`seneca-categories__name${enabled ? '' : ' seneca-categories__name--disabled'}`}
            >
              <CategoryIconBadge name={category.name} color={null} icon={category.icon} size={24} />
              <span className="seneca-categories__name-text">
                {getCategoryDisplayName(category, locale)}
              </span>
              {category.isSystem ? (
                <Lock size={13} className="seneca-categories__lock" aria-label={labels.system} />
              ) : null}
              {category.source === 'parsing' ? (
                <span className="seneca-categories__mark">{labels.parsing}</span>
              ) : null}
              {enabled ? null : <span className="seneca-categories__mark">{labels.disabled}</span>}
            </span>
          );
        },
      },
      {
        id: 'lastActivity',
        accessorFn: row => usage[row.id]?.lastUsedAt ?? '',
        header: labels.lastActivity,
        sortFn: 'text',
        size: 200,
        cell: ({ row }) => {
          const counts = usage[row.original.id];
          const lastUsedAt = counts?.lastUsedAt;
          return (
            <span className="seneca-categories__activity">
              <span>{lastUsedAt ? formatStoredDate(parseISO(lastUsedAt)) : labels.never}</span>
              {counts?.total ? (
                <span className="seneca-categories__uses">{formatUses(labels, counts.total)}</span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 64,
        enableSorting: false,
        enableHiding: false,
        meta: { align: 'end', label: labels.menu },
        cell: ({ row }) => (
          <CategoryActionsMenu
            category={row.original}
            labels={labels}
            actions={actions}
            tourAnchor={row.index === 0}
          />
        ),
      },
    ],
    [labels, locale, usage, search, onSearch, actions],
  );
}

export default function CategoriesPage() {
  const t = useIntlayer('categoriesPage');
  const { locale } = useLocale();
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

  const categories = categoriesQuery.data ?? [];
  const query = search.trim().toLowerCase();
  const visible = query
    ? categories.filter(category =>
        getCategoryDisplayName(category, locale).toLowerCase().includes(query),
      )
    : categories;

  const columns = useCategoryColumns({
    labels,
    locale,
    usage: usageQuery.data ?? {},
    search,
    onSearch: setSearch,
    actions,
  });
  const table = useDataGrid<Category>({
    data: visible,
    columns,
    getRowId: row => row.id,
    initialState: { sorting: [{ id: 'name', desc: false }] },
  });

  const [usedInBefore, usedInAfter = ''] = t.manage.disableDialog.usedIn.value.split('{name}');
  const noCategories = !categoriesQuery.isPending && categories.length === 0;

  return (
    <div className="seneca-categories">
      <PageTitle path="/categories" />
      <section className="seneca-categories__card">
        <header className="seneca-categories__header">
          <h2 className="seneca-categories__title">{t.title}</h2>
          <Button
            size="sm"
            type="button"
            data-tour-id="categories-add-button"
            onClick={() => openDialog(null)}
          >
            <Plus size={18} aria-hidden />
            {t.createNew}
          </Button>
        </header>
        <div data-tour-id="categories-list">
          {noCategories ? (
            <EmptyState
              icon={<BookmarkOutline size={28} />}
              size="sm"
              title={t.noData}
              description={t.emptyDescription}
              action={
                <Button size="sm" type="button" onClick={() => openDialog(null)}>
                  <Plus size={18} aria-hidden />
                  {t.createNew}
                </Button>
              }
              compact
            />
          ) : (
            <DataGrid
              table={table}
              caption={t.title.value}
              loading={categoriesQuery.isPending}
              skeletonRows={6}
              emptyState={<p className="seneca-categories__none">{t.noData}</p>}
            />
          )}
        </div>
      </section>

      <CategoryFormDialog
        open={dialogOpen}
        category={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={t.deleteTitle.value}
        message={
          deleteTarget ? (
            <>
              <strong>{getCategoryDisplayName(deleteTarget, locale)}</strong>
              {'. '}
              {t.deleteMessage}
            </>
          ) : null
        }
        confirmText={t.actions.delete.value}
        cancelText={t.dialog.cancel.value}
        isDestructive
        isLoading={deleting}
      />

      <ConfirmModal
        isOpen={disableConfirm !== null}
        onClose={() => setDisableConfirm(null)}
        onConfirm={() => {
          if (disableConfirm) {
            void setEnabled(disableConfirm.category, false);
          }
        }}
        title={t.manage.disableDialog.title.value}
        message={
          disableConfirm ? (
            <span className="seneca-categories__confirm">
              <span>
                {usedInBefore}
                <strong>{getCategoryDisplayName(disableConfirm.category, locale)}</strong>
                {usedInAfter}
              </span>
              <span>
                {(disableConfirm.usage.transactions === 1
                  ? t.manage.disableDialog.transactionsOne
                  : t.manage.disableDialog.transactionsMany
                ).value.replace('{count}', String(disableConfirm.usage.transactions))}
              </span>
              <span>
                {(disableConfirm.usage.statements === 1
                  ? t.manage.disableDialog.statementsOne
                  : t.manage.disableDialog.statementsMany
                ).value.replace('{count}', String(disableConfirm.usage.statements))}
              </span>
              <span>{t.manage.disableDialog.warning}</span>
            </span>
          ) : null
        }
        confirmText={t.manage.disable.value}
        cancelText={t.dialog.cancel.value}
        isDestructive
      />
    </div>
  );
}
