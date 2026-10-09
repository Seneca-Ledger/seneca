'use client';

import { Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import ConfirmModal from '@/app/components/ConfirmModal';
import { DataGrid, type GridColumnDef, useDataGrid } from '@/app/components/data-grid';
import { ExternalLink, Search, Trash2 } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { AppPagination } from '@/app/components/ui/pagination';
import { Select } from '@/app/components/ui/select';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { CreateTableDialog } from './components/CreateTableDialog';
import { useCreateTable } from './hooks/useCreateTable';
import { type SourceFilter, type TableListItem, useTablesList } from './hooks/useTablesList';
import { buildListLabels, type ListLabels } from './labels';
import type { SourceKind } from './sources';

function useListColumns(labels: ListLabels, onDelete: (item: TableListItem) => void) {
  const router = useRouter();
  return useMemo<GridColumnDef<TableListItem, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: row => row.name,
        header: labels.columns.name,
        size: 320,
        cell: ({ row }) => (
          <span className="lumio-ct__cell">
            <span className="lumio-ct__cell-text">
              <span className="lumio-ct__list-name">{row.original.name}</span>
              {row.original.description ? (
                <span className="lumio-ct__list-sub">{row.original.description}</span>
              ) : null}
            </span>
          </span>
        ),
      },
      {
        id: 'source',
        accessorFn: row => row.source,
        header: labels.columns.source,
        size: 150,
        cell: ({ row }) => {
          const kind = row.original.sourceBinding?.kind as SourceKind | undefined;
          let label = row.original.source;
          if (kind) {
            label = labels.create.sources[kind]?.name ?? kind;
          } else if (row.original.source === 'manual') {
            label = labels.actions.sourceManual;
          }
          return <span className="lumio-ct__badge lumio-ct__badge--neutral">{label}</span>;
        },
      },
      {
        id: 'category',
        accessorFn: row => row.category?.name ?? '',
        header: labels.columns.category,
        size: 160,
        cell: ({ row }) => row.original.category?.name ?? '—',
      },
      {
        id: 'rows',
        accessorFn: row => row.rowsCount ?? -1,
        header: labels.columns.rows,
        size: 90,
        sortFn: 'basic',
        meta: { align: 'end', className: 'lumio-grid__cell--numeric' },
        cell: ({ row }) => (row.original.rowsCount === undefined ? '…' : row.original.rowsCount),
      },
      {
        id: 'updated',
        accessorFn: row => row.updatedAt,
        header: labels.columns.updated,
        size: 130,
        sortFn: 'datetime',
        cell: ({ row }) => formatStoredDate(new Date(row.original.updatedAt)),
      },
      {
        id: 'actions',
        header: '',
        size: 110,
        enableSorting: false,
        enableHiding: false,
        meta: { align: 'end', label: labels.actions.rowActions },
        cell: ({ row }) => (
          <span className="lumio-ct__list-actions">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`${labels.actions.open}: ${row.original.name}`}
              onClick={event => {
                event.stopPropagation();
                router.push(`/custom-tables/${row.original.id}`);
              }}
            >
              <ExternalLink size={16} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`${labels.actions.delete}: ${row.original.name}`}
              onClick={event => {
                event.stopPropagation();
                onDelete(row.original);
              }}
            >
              <Trash2 size={16} aria-hidden />
            </Button>
          </span>
        ),
      },
    ],
    [labels, router, onDelete],
  );
}

export default function CustomTablesPage() {
  const t = useIntlayer('customTablesPage');
  const labels = useMemo(() => buildListLabels(t), [t]);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const list = useTablesList({
    enabled: !authLoading && Boolean(user),
    messages: {
      loadFailed: labels.toasts.loadTablesFailed,
      deleted: labels.toasts.deleted,
      deleteFailed: labels.toasts.deleteFailed,
    },
  });
  const create = useCreateTable({
    columnTitles: labels.create.columnTitles,
    messages: {
      created: labels.toasts.created,
      createdFromSource: labels.toasts.createdFromSource,
      createFailed: labels.toasts.createFailed,
      applying: labels.create.applying,
      partialFailed: labels.create.partialFailed,
    },
  });
  const [deleteTarget, setDeleteTarget] = useState<TableListItem | null>(null);
  const columns = useListColumns(labels, setDeleteTarget);
  const table = useDataGrid<TableListItem>({
    data: list.items,
    columns,
    getRowId: row => row.id,
    initialState: { sorting: [{ id: 'updated', desc: true }] },
  });

  if (authLoading || (list.loading && !list.items.length)) {
    return (
      <div className="lumio-ct" aria-busy>
        <Skeleton variant="text" width={200} height={36} />
        <Skeleton variant="rounded" height={40} />
        <Skeleton variant="rounded" height={320} />
      </div>
    );
  }

  return (
    <div className="lumio-ct">
      <div className="lumio-ct__toolbar">
        <label className="lumio-ct__search" data-tour-id="search-bar">
          <Search size={16} aria-hidden className="lumio-ct__search-icon" />
          <input
            type="search"
            className="lumio-ct__search-input"
            placeholder={labels.actions.search}
            aria-label={labels.actions.search}
            value={list.searchQuery}
            onChange={event => list.setSearchQuery(event.target.value)}
          />
        </label>
        <div className="lumio-ct__actions">
          <Select
            size="small"
            data-tour-id="custom-tables-source-filter"
            inputProps={{ 'aria-label': labels.columns.source }}
            value={list.sourceFilter}
            onChange={next => list.setSourceFilter(next as SourceFilter)}
            options={[
              { value: 'all', label: labels.actions.sourceAll },
              { value: 'manual', label: labels.actions.sourceManual },
            ]}
          />
          <Button
            size="sm"
            type="button"
            data-tour-id="custom-tables-create-export"
            onClick={() => create.setOpen(true)}
          >
            {labels.actions.newTable}
          </Button>
        </div>
      </div>
      <div data-tour-id="tables-list">
        <DataGrid
          table={table}
          caption={labels.actions.caption}
          loading={list.loading}
          onRowClick={row => router.push(`/custom-tables/${row.original.id}`)}
          emptyState={
            <EmptyState
              illustration="tables"
              size="sm"
              title={labels.empty.title}
              description={labels.empty.description}
              action={
                <Button size="sm" type="button" onClick={() => create.setOpen(true)}>
                  {labels.actions.newTable}
                </Button>
              }
              compact
            />
          }
        />
      </div>
      {list.totalPages > 1 ? (
        <div data-tour-id="pagination">
          <AppPagination page={list.page} total={list.totalPages} onChange={list.setPage} />
        </div>
      ) : null}
      <CreateTableDialog
        open={create.open}
        form={create.form}
        setForm={create.setForm}
        creating={create.creating}
        categories={list.categories}
        onSubmit={() => void create.submit()}
        onClose={create.close}
        labels={labels.create}
      />
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void list.deleteTable(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title={labels.confirmDelete.title}
        message={
          deleteTarget?.name
            ? `${labels.confirmDelete.messageWithNamePrefix}${deleteTarget.name}${labels.confirmDelete.messageWithNameSuffix}`
            : labels.confirmDelete.messageNoName
        }
        confirmText={labels.confirmDelete.confirm}
        cancelText={labels.confirmDelete.cancel}
        isDestructive
      />
    </div>
  );
}
