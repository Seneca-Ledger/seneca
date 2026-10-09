'use client';
import { resolveBankLogo } from '@bank-logos';
import Skeleton from '@mui/material/Skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from '@/app/components/ConfirmModal';
import { RotateCcw, Search, Trash2 } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { AppPagination } from '@/app/components/ui/pagination';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import {
  areAllVisibleSelected,
  toggleSelectAllVisible,
  toggleStatementSelection,
} from '@/app/lib/statement-selection';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { TrashListItem, type TrashListItemModel } from './TrashListItem';
import {
  resolvePermanentDeletionDate,
  resolveTrashEntityType,
  type TrashEntityType,
} from './trash-utils';

const PAGE_SIZE = 30;
const DEFAULT_TRASH_TTL_DAYS = 30;

type TrashFile = TrashListItemModel & {
  status?: string;
  itemType?: string | null;
  resourceType?: string | null;
  objectType?: string | null;
  type?: string | null;
};

const getBankDisplayName = (bankName: string) => {
  const resolved = resolveBankLogo(bankName);
  if (!resolved) {
    return bankName;
  }
  return resolved.key !== 'other' ? resolved.displayName : bankName;
};

const resolveDateValue = (file: TrashFile): number => {
  const value = file.deletedAt || file.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const TRASH_ROW_SKELETON_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6'];

function TrashListRowSkeleton(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <div style={{ width: 16 }}>
        <Skeleton variant="rounded" width={16} height={16} />
      </div>
      <div style={{ width: 176 }}>
        <Skeleton variant="text" width="70%" height={16} />
      </div>
      <div style={{ width: 440, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Skeleton variant="text" width="80%" height={16} />
        <Skeleton variant="text" width="80%" height={16} />
      </div>
      <div style={{ flex: 1 }}>
        <Skeleton variant="text" width="50%" height={16} />
      </div>
      <div style={{ width: 144, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Skeleton variant="rounded" width={32} height={32} />
        <Skeleton variant="rounded" width={32} height={32} />
      </div>
    </div>
  );
}

export default function TrashListView() {
  const t = useIntlayer('statementsPage');
  const { locale } = useLocale();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const localeCode = locale === 'kk' ? 'kk-KZ' : locale === 'ru' ? 'ru-RU' : 'en-US';
  const trashTtlDays = useMemo(() => {
    const parsed = Number.parseInt(process.env.NEXT_PUBLIC_STORAGE_TRASH_TTL_DAYS || '', 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return DEFAULT_TRASH_TTL_DAYS;
  }, []);

  const labels = {
    title: resolveLabel(getNestedValue(t, ['trash', 'title']), 'Trash'),
    retentionPolicy: resolveLabel(
      getNestedValue(t, ['trash', 'retentionPolicy']),
      `Deleted items are permanently removed after ${trashTtlDays} days.`,
    ),
    searchPlaceholder: resolveLabel(
      getNestedValue(t, ['trash', 'searchPlaceholder']),
      'Search in trash...',
    ),
    selectedCountTemplate: resolveLabel(
      getNestedValue(t, ['trash', 'selectedCount']) ??
        getNestedValue(t, ['trash', 'selectedLabel']),
      'Selected: {count}',
    ),
    restore: resolveLabel(getNestedValue(t, ['trash', 'restore']), 'Restore'),
    delete: resolveLabel(getNestedValue(t, ['trash', 'delete']), 'Delete'),
    emptyTrash: resolveLabel(
      getNestedValue(t, ['trash', 'emptyTrash']) ?? getNestedValue(t, ['trash', 'emptyAction']),
      'Empty trash',
    ),
    emptyTitle: resolveLabel(
      getNestedValue(t, ['trash', 'empty', 'title']) ?? getNestedValue(t, ['trash', 'emptyTitle']),
      'Trash is empty',
    ),
    emptyDescription: resolveLabel(
      getNestedValue(t, ['trash', 'empty', 'subtitle']) ??
        getNestedValue(t, ['trash', 'emptyDescription']),
      'Deleted files will appear here',
    ),
    typeHeader: resolveLabel(getNestedValue(t, ['trash', 'listHeader', 'type']), 'Type'),
    deletedAtHeader: resolveLabel(
      getNestedValue(t, ['trash', 'listHeader', 'deletedAt']) ??
        getNestedValue(t, ['trash', 'listHeader', 'deleted']),
      'Deleted at',
    ),
    autoDeleteHeader: resolveLabel(
      getNestedValue(t, ['trash', 'listHeader', 'willDeleteAt']),
      'Will be permanently deleted on',
    ),
    nameHeader: resolveLabel(getNestedValue(t, ['trash', 'listHeader', 'name']), 'Name'),
    actionsHeader: resolveLabel(getNestedValue(t, ['trash', 'listHeader', 'actions']), 'Actions'),
    entityTypeStatement: resolveLabel(
      getNestedValue(t, ['trash', 'entityTypes', 'statement']),
      'Statement',
    ),
    entityTypeTable: resolveLabel(getNestedValue(t, ['trash', 'entityTypes', 'table']), 'Table'),
    entityTypeWorkspace: resolveLabel(
      getNestedValue(t, ['trash', 'entityTypes', 'workspace']),
      'Workspace',
    ),
    selectAll: resolveLabel(getNestedValue(t, ['trash', 'selectAll']), 'Select all in trash'),
    restoreLoading: resolveLabel(getNestedValue(t, ['trash', 'restoreLoading']), 'Restoring...'),
    restoreSuccess: resolveLabel(getNestedValue(t, ['trash', 'restoreSuccess']), 'File restored'),
    restoreFailed: resolveLabel(
      getNestedValue(t, ['trash', 'restoreFailed']),
      'Failed to restore file',
    ),
    deleteLoading: resolveLabel(
      getNestedValue(t, ['trash', 'deleteLoading']),
      'Deleting forever...',
    ),
    deleteSuccess: resolveLabel(
      getNestedValue(t, ['trash', 'deleteSuccess']),
      'File deleted permanently',
    ),
    deleteFailed: resolveLabel(
      getNestedValue(t, ['trash', 'deleteFailed']),
      'Failed to delete file permanently',
    ),
    loadError: resolveLabel(
      getNestedValue(t, ['trash', 'loadError']) ?? getNestedValue(t, ['loadListError']),
      'Failed to load trash',
    ),
    confirmDeleteTitle: resolveLabel(
      getNestedValue(t, ['trash', 'confirmDeleteTitle']) ??
        getNestedValue(t, ['trash', 'bulkDeleteTitle']),
      'Delete permanently?',
    ),
    confirmDeleteMessage: resolveLabel(
      getNestedValue(t, ['trash', 'confirmDeleteMessage']) ??
        getNestedValue(t, ['trash', 'bulkDeleteMessage']),
      'Selected files will be permanently deleted.',
    ),
    confirmDelete: resolveLabel(
      getNestedValue(t, ['trash', 'confirmDelete']) ??
        getNestedValue(t, ['trash', 'bulkDeleteConfirm']),
      'Delete',
    ),
    confirmCancel: resolveLabel(
      getNestedValue(t, ['trash', 'confirmCancel']) ??
        getNestedValue(t, ['trash', 'bulkDeleteCancel']),
      'Cancel',
    ),
    confirmEmptyTitle: resolveLabel(
      getNestedValue(t, ['trash', 'confirmEmptyTitle']) ??
        getNestedValue(t, ['trash', 'emptyTitle']),
      'Empty trash?',
    ),
    confirmEmptyMessage: resolveLabel(
      getNestedValue(t, ['trash', 'confirmEmptyMessage']) ??
        getNestedValue(t, ['trash', 'emptyMessage']),
      'All files in trash will be deleted permanently.',
    ),
    confirmEmpty: resolveLabel(
      getNestedValue(t, ['trash', 'confirmEmpty']) ?? getNestedValue(t, ['trash', 'emptyConfirm']),
      'Empty',
    ),
    irreversibleWarning: resolveLabel(
      getNestedValue(t, ['trash', 'irreversibleWarning']),
      'This action is irreversible',
    ),
    paginationShown: resolveLabel(
      getNestedValue(t, ['pagination', 'shown']),
      'Showing {from}–{to} of {count}',
    ),
    paginationPrevious: resolveLabel(getNestedValue(t, ['pagination', 'previous']), 'Previous'),
    paginationNext: resolveLabel(getNestedValue(t, ['pagination', 'next']), 'Next'),
    paginationPageOf: resolveLabel(
      getNestedValue(t, ['pagination', 'pageOf']),
      'Page {page} of {count}',
    ),
  };

  const [files, setFiles] = useState<TrashFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
      setPage(1);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const loadTrashFiles = async () => {
    await (async () => {
      setLoading(true);
      const response = await apiClient.get('/storage/files', {
        params: { deleted: 'only' },
      });
      const payload = response.data;
      const nextFiles = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      setFiles(nextFiles);
    })()
      .catch(async error => {
        console.error('Failed to load trash files:', error);
        toast.error(labels.loadError);
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadTrashFiles();
  }, [user]);

  const filteredFiles = useMemo(() => {
    const filtered = search
      ? files.filter(file => {
          const fileName = (file.fileName || '').toLowerCase();
          const bankName = (file.bankName || '').toLowerCase();
          return fileName.includes(search) || bankName.includes(search);
        })
      : files;

    return [...filtered].sort((a, b) => resolveDateValue(b) - resolveDateValue(a));
  }, [files, search]);

  const total = filteredFiles.length;
  const totalPagesCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPagesCount);
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFiles.slice(start, start + PAGE_SIZE);
  }, [filteredFiles, currentPage]);

  const visibleIds = useMemo(() => paginatedFiles.map(file => file.id), [paginatedFiles]);
  const allVisibleSelected = useMemo(
    () => areAllVisibleSelected(selectedIds, visibleIds),
    [selectedIds, visibleIds],
  );

  useEffect(() => {
    const visibleSet = new Set(filteredFiles.map(file => file.id));
    setSelectedIds(prev => prev.filter(id => visibleSet.has(id)));
  }, [filteredFiles]);

  const selectedCount = selectedIds.length;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(total, currentPage * PAGE_SIZE);

  const replaceTokens = (template: string, values: Record<string, string | number>) => {
    return Object.entries(values).reduce(
      (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
      template,
    );
  };

  const selectedLabel = replaceTokens(labels.selectedCountTemplate, { count: selectedCount });
  const shownLabel = replaceTokens(labels.paginationShown, {
    from: rangeStart,
    to: rangeEnd,
    count: total,
  });
  const pageOfLabel = replaceTokens(labels.paginationPageOf, {
    page: currentPage,
    count: totalPagesCount,
  });
  const entityTypeLabelByType: Record<TrashEntityType, string> = {
    statement: labels.entityTypeStatement,
    table: labels.entityTypeTable,
    workspace: labels.entityTypeWorkspace,
  };

  const removeFilesFromState = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }
    setFiles(prev => prev.filter(file => !ids.includes(file.id)));
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  };

  const handleRestore = async (id: string) => {
    const toastId = toast.loading(labels.restoreLoading);

    await (async () => {
      await apiClient.post(`/storage/files/${id}/trash/restore`);
      removeFilesFromState([id]);
      await queryClient.invalidateQueries({ queryKey: ['statements'] });
      toast.success(labels.restoreSuccess, { id: toastId });
    })().catch(async error => {
      console.error('Failed to restore trash file:', error);
      toast.error(labels.restoreFailed, { id: toastId });
    });
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    const toastId = toast.loading(labels.restoreLoading);

    await (async () => {
      await apiClient.post('/storage/files/trash/bulk/restore', {
        statementIds: selectedIds,
      });
      removeFilesFromState(selectedIds);
      await queryClient.invalidateQueries({ queryKey: ['statements'] });
      toast.success(labels.restoreSuccess, { id: toastId });
    })().catch(async error => {
      console.error('Failed to bulk restore trash files:', error);
      toast.error(labels.restoreFailed, { id: toastId });
    });
  };

  const openDeleteConfirm = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }
    setPendingDeleteIds(ids);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (pendingDeleteIds.length === 0) {
      return;
    }

    const ids = [...pendingDeleteIds];
    const toastId = toast.loading(labels.deleteLoading);
    setConfirmLoading(true);

    await (async () => {
      if (ids.length === 1) {
        await apiClient.delete(`/storage/files/${ids[0]}/trash`);
      } else {
        await apiClient.post('/storage/files/bulk/trash/delete', {
          statementIds: ids,
        });
      }

      removeFilesFromState(ids);
      setDeleteConfirmOpen(false);
      setPendingDeleteIds([]);
      toast.success(labels.deleteSuccess, { id: toastId });
    })()
      .catch(async error => {
        console.error('Failed to permanently delete trash files:', error);
        toast.error(labels.deleteFailed, { id: toastId });
      })
      .finally(async () => {
        setConfirmLoading(false);
      });
  };

  const handleConfirmEmptyTrash = async () => {
    if (files.length === 0) {
      setEmptyConfirmOpen(false);
      return;
    }

    const ids = files.map(file => file.id);
    const toastId = toast.loading(labels.deleteLoading);
    setConfirmLoading(true);

    await (async () => {
      await apiClient.post('/storage/files/bulk/trash/delete', {
        statementIds: ids,
      });
      removeFilesFromState(ids);
      setEmptyConfirmOpen(false);
      toast.success(labels.deleteSuccess, { id: toastId });
    })()
      .catch(async error => {
        console.error('Failed to empty trash:', error);
        toast.error(labels.deleteFailed, { id: toastId });
      })
      .finally(async () => {
        setConfirmLoading(false);
      });
  };

  const formatDateTime = (value?: string | Date | null) => {
    if (!value) {
      return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return formatStoredDateWithOptions(
      date,
      {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      },
      localeCode,
    );
  };

  const formatPermanentDeletionDate = (deletedAt?: string | null) => {
    const expiresAt = resolvePermanentDeletionDate(deletedAt, trashTtlDays);
    return formatDateTime(expiresAt);
  };

  const confirmDeleteMessage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ color: c.ink700, lineHeight: 1.6 }}>
        {labels.confirmDeleteMessage.replace('{count}', String(pendingDeleteIds.length))}
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: c.danger }}>{labels.irreversibleWarning}</p>
    </div>
  );

  const confirmEmptyMessage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ color: c.ink700, lineHeight: 1.6 }}>{labels.confirmEmptyMessage}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: c.danger }}>{labels.irreversibleWarning}</p>
    </div>
  );

  return (
    <div className="container-shared lumio-trash-list">
      <div className="lumio-trash-list__header">
        <div className="lumio-trash-list__search-row">
          <div className="lumio-trash-list__search">
            <Search className="lumio-trash-list__search-icon" size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchPlaceholder}
              className="lumio-trash-list__search-input"
            />
          </div>
        </div>

        <div className="lumio-trash-list__actions-row">
          <span style={{ fontSize: 12, fontWeight: 500, color: c.ink500 }}>{selectedLabel}</span>
          <button
            type="button"
            onClick={() => void handleBulkRestore()}
            disabled={selectedCount === 0}
            className="lumio-trash-list__restore-btn"
          >
            <RotateCcw size={14} />
            {labels.restore}
          </button>

          <button
            type="button"
            onClick={() => openDeleteConfirm(selectedIds)}
            disabled={selectedCount === 0}
            className="lumio-trash-list__delete-btn"
          >
            <Trash2 size={14} />
            {labels.delete}
          </button>

          <button
            type="button"
            onClick={() => setEmptyConfirmOpen(true)}
            disabled={files.length === 0}
            className="lumio-trash-list__empty-btn"
          >
            <Trash2 size={14} />
            {labels.emptyTrash}
          </button>
        </div>
      </div>

      <div className="lumio-trash-list__body">
        {loading ? (
          <div className="lumio-trash-list__items">
            {TRASH_ROW_SKELETON_KEYS.map(key => (
              <TrashListRowSkeleton key={key} />
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="lumio-trash-list__empty-state">
            <EmptyStateIllustration name="trash" size="lg" />
            <h3 style={{ fontSize: 18, fontWeight: 500, color: c.ink900 }}>{labels.emptyTitle}</h3>
            <p style={{ marginTop: 4, color: c.ink500 }}>{labels.emptyDescription}</p>
          </div>
        ) : (
          <>
            <div className="lumio-trash-list__items">
              <div className="lumio-trash-list__select-all-mobile">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={selectedIds.length > 0 && !allVisibleSelected}
                  onCheckedChange={checked =>
                    setSelectedIds(prev => toggleSelectAllVisible(prev, visibleIds, checked))
                  }
                  style={{ height: 16, width: 16, borderRadius: tokens.radius.xs }}
                  aria-label={labels.selectAll}
                />
                <span style={{ fontSize: 14, fontWeight: 500, color: c.ink700 }}>
                  {labels.selectAll}
                </span>
              </div>

              <div className="lumio-trash-list__thead">
                <div style={{ width: 16 }}>
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={selectedIds.length > 0 && !allVisibleSelected}
                    onCheckedChange={checked =>
                      setSelectedIds(prev => toggleSelectAllVisible(prev, visibleIds, checked))
                    }
                    style={{ height: 16, width: 16, borderRadius: tokens.radius.xs }}
                    aria-label={labels.selectAll}
                  />
                </div>
                <div style={{ width: 176 }}>{labels.typeHeader}</div>
                <div
                  style={{ width: 440, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
                >
                  <span>{labels.deletedAtHeader}</span>
                  <span>{labels.autoDeleteHeader}</span>
                </div>
                <div style={{ flex: 1 }}>{labels.nameHeader}</div>
                <div style={{ width: 144, textAlign: 'right' }}>{labels.actionsHeader}</div>
              </div>

              {paginatedFiles.map(file => {
                const entityType = resolveTrashEntityType(
                  file as unknown as Record<string, unknown>,
                );
                const bankName = (file.bankName || '').trim();
                const safeBankName = bankName || 'other';
                const bankDisplayName = bankName ? getBankDisplayName(bankName) : '';

                return (
                  <TrashListItem
                    key={file.id}
                    item={{
                      ...file,
                      bankName: safeBankName,
                      entityType,
                    }}
                    selected={selectedIds.includes(file.id)}
                    onToggleSelect={() =>
                      setSelectedIds(prev => toggleStatementSelection(prev, file.id))
                    }
                    onRestore={() => void handleRestore(file.id)}
                    onDelete={() => openDeleteConfirm([file.id])}
                    bankDisplayName={bankDisplayName}
                    typeLabel={entityTypeLabelByType[entityType]}
                    deletedAtLabel={formatDateTime(file.deletedAt)}
                    autoDeleteAtLabel={formatPermanentDeletionDate(file.deletedAt)}
                    deletedAtCaption={labels.deletedAtHeader}
                    autoDeleteAtCaption={labels.autoDeleteHeader}
                    restoreLabel={labels.restore}
                    deleteLabel={labels.delete}
                  />
                );
              })}
            </div>

            <div className="lumio-trash-list__pagination">
              <div style={{ fontSize: 14, color: c.ink500 }}>{shownLabel}</div>
              <div className="lumio-trash-list__pagination-info">
                <span style={{ fontSize: 14, color: c.ink700, minWidth: 120, textAlign: 'center' }}>
                  {pageOfLabel}
                </span>
                <AppPagination page={currentPage} total={totalPagesCount} onChange={setPage} />
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          if (confirmLoading) {
            return;
          }
          setDeleteConfirmOpen(false);
          setPendingDeleteIds([]);
        }}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        title={labels.confirmDeleteTitle}
        message={confirmDeleteMessage}
        confirmText={labels.confirmDelete}
        cancelText={labels.confirmCancel}
        isDestructive={true}
        isLoading={confirmLoading}
      />

      <ConfirmModal
        isOpen={emptyConfirmOpen}
        onClose={() => {
          if (confirmLoading) {
            return;
          }
          setEmptyConfirmOpen(false);
        }}
        onConfirm={() => {
          void handleConfirmEmptyTrash();
        }}
        title={labels.confirmEmptyTitle}
        message={confirmEmptyMessage}
        confirmText={labels.confirmEmpty}
        cancelText={labels.confirmCancel}
        isDestructive={true}
        isLoading={confirmLoading}
      />
    </div>
  );
}
