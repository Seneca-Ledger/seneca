'use client';

import { useQueryClient } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from '@/app/components/ConfirmModal';
import { DataGrid, type GridColumnDef, useDataGrid } from '@/app/components/data-grid';
import { MoreHorizontal, Pencil, Plus, Tag, Trash2 } from '@/app/components/icons';
import { TagFormDialog } from '@/app/components/tags/TagFormDialog';
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
import { useTags } from '@/app/hooks/useTags';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { TagListItem } from '@/app/lib/contracts';
import { queryKeys } from '@/app/lib/query-keys';
import { formatStoredDate } from '@/app/lib/user-format-store';

interface TagLabels {
  name: string;
  date: string;
  usage: string;
  notUsed: string;
  usesOne: string;
  usesMany: string;
  menu: string;
  edit: string;
  delete: string;
  search: string;
}

interface TagRowActions {
  onEdit: (tag: TagListItem) => void;
  onDelete: (tag: TagListItem) => void;
}

const formatUses = (labels: TagLabels, count: number): string =>
  (count === 1 ? labels.usesOne : labels.usesMany).replace('{count}', String(count));

function TagActionsMenu({
  tag,
  labels,
  actions,
}: {
  tag: TagListItem;
  labels: TagLabels;
  actions: TagRowActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="seneca-tags__menu"
          aria-label={`${labels.menu}: ${tag.name}`}
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      {/* MUI Menu walks its children for focus; a Fragment would hide them, so the items are an array. */}
      <DropdownMenuContent align="end">
        {[
          <DropdownMenuItem key="edit" onSelect={() => actions.onEdit(tag)}>
            <Pencil size={14} aria-hidden />
            {labels.edit}
          </DropdownMenuItem>,
          <DropdownMenuSeparator key="separator" />,
          <DropdownMenuItem key="delete" onSelect={() => actions.onDelete(tag)}>
            <Trash2 size={14} aria-hidden />
            {labels.delete}
          </DropdownMenuItem>,
        ]}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useTagColumns(options: {
  labels: TagLabels;
  search: string;
  onSearch: (value: string) => void;
  actions: TagRowActions;
}) {
  const { labels, search, onSearch, actions } = options;
  return useMemo<GridColumnDef<TagListItem, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: row => row.name,
        header: labels.name,
        sortFn: 'text',
        size: 380,
        meta: {
          label: labels.name,
          headerActions: (
            <input
              type="search"
              className="seneca-tags__search"
              value={search}
              onChange={event => onSearch(event.target.value)}
              placeholder={labels.search}
              aria-label={labels.search}
            />
          ),
        },
        cell: ({ row }) => (
          <span className="seneca-tags__activity">
            <span className="seneca-tags__name">
              <Tag size={16} color="var(--text-muted)" aria-hidden style={{ flexShrink: 0 }} />
              <span className="seneca-tags__name-text">{row.original.name}</span>
            </span>
            {row.original.description ? (
              <span className="seneca-tags__description">{row.original.description}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'date',
        accessorFn: row => row.tagDate ?? '',
        header: labels.date,
        sortFn: 'text',
        size: 160,
        cell: ({ row }) => (
          <span className="seneca-tags__activity">
            {row.original.tagDate ? formatStoredDate(parseISO(row.original.tagDate)) : '—'}
          </span>
        ),
      },
      {
        id: 'usage',
        accessorFn: row => row.usageCount,
        header: labels.usage,
        sortFn: 'basic',
        size: 160,
        cell: ({ row }) =>
          row.original.usageCount > 0 ? (
            <span className="seneca-tags__activity">
              {formatUses(labels, row.original.usageCount)}
            </span>
          ) : (
            <span className="seneca-tags__uses">{labels.notUsed}</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        size: 64,
        enableSorting: false,
        enableHiding: false,
        meta: { align: 'end', label: labels.menu },
        cell: ({ row }) => <TagActionsMenu tag={row.original} labels={labels} actions={actions} />,
      },
    ],
    [labels, search, onSearch, actions],
  );
}

/** The workspace's tags: what each groups, its date and how often it is used. */
export default function TagsPage() {
  const t = useIntlayer('tagsPage');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const tagsQuery = useTags();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TagListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const labels = useMemo<TagLabels>(
    () => ({
      name: t.columns.name.value,
      date: t.columns.date.value,
      usage: t.columns.usage.value,
      notUsed: t.notUsed.value,
      usesOne: t.usesOne.value,
      usesMany: t.usesMany.value,
      menu: t.actions.menu.value,
      edit: t.actions.edit.value,
      delete: t.actions.delete.value,
      search: t.searchPlaceholder.value,
    }),
    [t],
  );

  const openDialog = (tag: TagListItem | null): void => {
    setEditing(tag);
    setDialogOpen(true);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    await (async () => {
      await apiClient.delete(`/tags/${deleteTarget.id}`);
      toast.success(t.toasts.deleted.value);
      await queryClient.invalidateQueries({ queryKey: queryKeys.tags(workspaceId) });
      // Document rows carry tag names: the deleted tag leaves them too.
      void queryClient.invalidateQueries({ queryKey: ['statements'] });
      void queryClient.invalidateQueries({ queryKey: ['receipt-documents'] });
      setDeleteTarget(null);
    })()
      .catch(async error => {
        console.error('Failed to delete tag:', error);
        toast.error(t.toasts.deleteFailed.value);
      })
      .finally(() => setDeleting(false));
  };

  const actions: TagRowActions = {
    onEdit: tag => openDialog(tag),
    onDelete: tag => setDeleteTarget(tag),
  };

  const tags = tagsQuery.data ?? [];
  const query = search.trim().toLowerCase();
  const visible = query
    ? tags.filter(
        tag =>
          tag.name.toLowerCase().includes(query) ||
          (tag.description ?? '').toLowerCase().includes(query),
      )
    : tags;

  const columns = useTagColumns({ labels, search, onSearch: setSearch, actions });
  const table = useDataGrid<TagListItem>({
    data: visible,
    columns,
    getRowId: row => row.id,
    initialState: { sorting: [{ id: 'name', desc: false }] },
  });

  const noTags = !tagsQuery.isPending && tags.length === 0;

  return (
    <div className="seneca-tags">
      <PageTitle path="/tags" />
      <section className="seneca-tags__card">
        <header className="seneca-tags__header">
          <h2 className="seneca-tags__title">{t.title}</h2>
          <Button size="sm" type="button" onClick={() => openDialog(null)}>
            <Plus size={18} aria-hidden />
            {t.createNew}
          </Button>
        </header>
        {noTags ? (
          <EmptyState
            icon={<Tag size={28} />}
            size="sm"
            title={t.emptyTitle}
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
            loading={tagsQuery.isPending}
            skeletonRows={6}
            emptyState={<p className="seneca-tags__none">{t.noMatches}</p>}
          />
        )}
      </section>

      <TagFormDialog
        open={dialogOpen}
        tag={editing}
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
              <strong>{deleteTarget.name}</strong>
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
    </div>
  );
}
