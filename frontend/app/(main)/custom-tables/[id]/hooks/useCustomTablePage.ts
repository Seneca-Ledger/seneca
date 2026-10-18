'use client';

import type { SortingState } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { resolveCurrencyCode } from '@/app/lib/format-money';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { downloadTableExport } from '../../exportTable';
import type { ConvertResult } from '../components/SendToStatementsDialog';
import { showUndoToast } from '../components/UndoToast';
import { isDraftRowId } from '../helpers/draftRowHelpers';
import { buildDetailLabels } from '../labels';
import { sourceViewDefaults } from '../utils/source-view-defaults';
import type { AggregateFn, CustomTableColumn } from '../utils/types';
import { useColumnEditor } from './useColumnEditor';
import { usePasteImport } from './usePasteImport';
import { useRowFilters } from './useRowFilters';
import { useRowMutations } from './useRowMutations';
import { useTableAggregates } from './useTableAggregates';
import { useTableData } from './useTableData';
import { useTableGrid } from './useTableGrid';
import { useTableGroups } from './useTableGroups';
import { useTableSummaries } from './useTableSummaries';

interface ConvertState {
  open: boolean;
  busy: boolean;
  result: ConvertResult | null;
}

interface PendingDelete {
  kind: 'rows' | 'column';
  column?: CustomTableColumn;
}

const sortParam = (sorting: SortingState) =>
  sorting[0]
    ? { col: sorting[0].id, dir: sorting[0].desc ? ('desc' as const) : ('asc' as const) }
    : null;

/** Everything the table page needs, composed from the data hooks. */
export function useCustomTablePage(tableId: string) {
  const t = useIntlayer('customTableDetailPage');
  const labels = useMemo(() => buildDetailLabels(t), [t]);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user);
  const { currentWorkspace } = useWorkspace();
  const defaultCurrency = resolveCurrencyCode(currentWorkspace?.currency);

  const data = useTableData({
    tableId,
    isAuthenticated,
    authLoading,
    loadTableFailedMessage: labels.toasts.loadTableFailed,
  });
  const columns = useMemo(
    () => [...(data.table?.columns ?? [])].sort((a, b) => a.position - b.position),
    [data.table],
  );

  const filters = useRowFilters();
  // A table filled from Lumio opens newest first and without the columns that
  // repeat the row (type, statement, a single currency). These defaults are
  // derived during render, never set in an effect after the rows arrive: that
  // re-sorted an already drawn table, emptied it and drew it again, so the old
  // layout flashed after the skeleton. Whatever the user picks overrides them.
  const isSourceTable = Boolean(data.table?.sourceBinding);
  const defaultSorting = useMemo(
    () => (isSourceTable ? sourceViewDefaults(columns, []).sorting : []),
    [isSourceTable, columns],
  );
  const [userSorting, setUserSorting] = useState<{ tableId: string; value: SortingState } | null>(
    null,
  );
  const sorting =
    userSorting && userSorting.tableId === tableId ? userSorting.value : defaultSorting;
  const setSorting = useCallback(
    (updater: SortingState | ((current: SortingState) => SortingState)) =>
      setUserSorting(prev => {
        const current = prev && prev.tableId === tableId ? prev.value : defaultSorting;
        return {
          tableId: tableId ?? '',
          value: typeof updater === 'function' ? updater(current) : updater,
        };
      }),
    [tableId, defaultSorting],
  );
  const grid = useTableGrid({
    tableId,
    // The first page is asked once the table is known, so it comes already in
    // the order the table opens with, not re-sorted a moment later.
    isAuthenticated: isAuthenticated && Boolean(data.table),
    combinedFiltersParam: filters.filtersParam,
    sort: sortParam(sorting),
    loadRowsFailedMessage: labels.toasts.loadRowsFailed,
  });

  const [rowSelection, setRowSelection] = useState<Record<string, true>>({});
  const [userVisibility, setUserVisibility] = useState<Record<string, boolean>>({});
  // The currency column hides while every loaded row has one currency (and
  // before any row is in, the usual case), so it does not pop out on arrival.
  const defaultHidden = useMemo(
    () =>
      isSourceTable ? sourceViewDefaults(columns, grid.rows, { assumeSingle: true }).hidden : [],
    [isSourceTable, columns, grid.rows],
  );
  const columnVisibility = useMemo(
    () => ({ ...Object.fromEntries(defaultHidden.map(key => [key, false])), ...userVisibility }),
    [defaultHidden, userVisibility],
  );
  const setColumnVisibility = useCallback(
    (
      updater:
        | Record<string, boolean>
        | ((current: Record<string, boolean>) => Record<string, boolean>),
    ) =>
      setUserVisibility(prev =>
        typeof updater === 'function'
          ? updater({ ...Object.fromEntries(defaultHidden.map(key => [key, false])), ...prev })
          : updater,
      ),
    [defaultHidden],
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const onRowsChanged = useCallback(() => setRefreshToken(n => n + 1), []);

  const [aggregates, setAggregates] = useState<Record<string, AggregateFn>>({});
  useEffect(() => {
    const saved = data.table?.viewSettings?.columns ?? {};
    const next: Record<string, AggregateFn> = {};
    for (const [key, settings] of Object.entries(saved)) {
      if (settings?.aggregate) {
        next[key] = settings.aggregate;
      }
    }
    setAggregates(next);
  }, [data.table?.viewSettings?.columns]);

  const aggregateState = useTableAggregates({
    tableId,
    isAuthenticated,
    combinedFiltersParam: filters.filtersParam,
    selection: aggregates,
    refreshToken,
  });
  const summaries = useTableSummaries({
    tableId,
    isAuthenticated,
    refreshToken,
    messages: {
      loadFailed: labels.summaries.loadFailed,
      saveFailed: labels.summaries.saveFailed,
    },
  });
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const groupState = useTableGroups({
    tableId,
    isAuthenticated,
    groupBy,
    combinedFiltersParam: filters.filtersParam,
    aggregates,
    refreshToken,
  });

  const setAggregate = useCallback(
    (columnKey: string, fn: AggregateFn | null) => {
      setAggregates(prev => {
        const { [columnKey]: _removed, ...rest } = prev;
        return fn ? { ...rest, [columnKey]: fn } : rest;
      });
      apiClient
        .patch(`/custom-tables/${tableId}/view-settings/columns`, {
          columnKey,
          aggregate: fn,
        } satisfies ContractInput<'UpdateCustomTableViewSettingsColumnBody'>)
        .catch(error => console.error('Failed to persist column aggregate:', error));
    },
    [tableId],
  );

  const mutations = useRowMutations({
    tableId,
    columns,
    rows: grid.rows,
    setRows: grid.setRows,
    onRowsChanged,
    messages: labels.toasts,
  });

  // A new or changed formula column changes every row: reload them with the table.
  const reloadTableAndRows = useCallback(async () => {
    await data.loadTable();
    await grid.loadRows({ reset: true });
  }, [data.loadTable, grid.loadRows]);

  const columnEditor = useColumnEditor({
    tableId,
    defaultCurrency,
    reloadTable: reloadTableAndRows,
    messages: {
      saved: labels.toasts.columnSaved,
      saveFailed: labels.toasts.columnSaveFailed,
      deleted: labels.toasts.columnDeleted,
      deleteFailed: labels.toasts.columnDeleteFailed,
    },
  });

  const onInsertSuccess = useCallback(
    (
      { createdCount, issueCount }: { createdCount: number; issueCount: number },
      onUndo: () => void,
    ) =>
      showUndoToast(
        (issueCount ? labels.import.insertedWithIssues : labels.import.inserted)
          .replace('{{count}}', String(createdCount))
          .replace('{{issues}}', String(issueCount)),
        labels.import.undo,
        onUndo,
      ),
    [labels.import.inserted, labels.import.insertedWithIssues, labels.import.undo],
  );

  const paste = usePasteImport({
    tableId,
    orderedColumns: data.table?.columns ?? [],
    pasteDefaults: labels.import.defaults,
    loadTable: data.loadTable,
    onRowsChanged,
    setRows: grid.setRows,
    onInsertSuccess,
    messages: labels.import,
  });

  const [exporting, setExporting] = useState(false);
  const exportView = useCallback(
    async (format: 'xlsx' | 'csv') => {
      setExporting(true);
      const sort = sortParam(sorting);
      const visible = columns.filter(c => columnVisibility[c.key] !== false).map(c => c.key);
      await downloadTableExport(tableId, format, {
        filters: filters.filtersParam,
        sort: sort ? JSON.stringify(sort) : undefined,
        columnKeys: visible,
      })
        .catch(error => {
          console.error('Failed to export table:', error);
          toast.error(getApiErrorMessage(error, labels.toasts.exportFailed));
        })
        .finally(() => setExporting(false));
    },
    [tableId, sorting, columns, columnVisibility, filters.filtersParam, labels.toasts.exportFailed],
  );

  const [convert, setConvert] = useState<ConvertState>({ open: false, busy: false, result: null });
  const runConvert = useCallback(async () => {
    setConvert(prev => ({ ...prev, busy: true }));
    await (async () => {
      const response = await apiClient.post(`/custom-tables/${tableId}/convert-to-statement`);
      const payload = await checkContract(
        'ConvertedToStatement',
        response.data,
        '/custom-tables/:id/convert-to-statement',
      );
      setConvert({ open: true, busy: false, result: payload });
    })().catch(async error => {
      console.error('Failed to convert table:', error);
      toast.error(getApiErrorMessage(error, labels.convert.failed));
      setConvert(prev => ({ ...prev, busy: false }));
    });
  }, [tableId, labels.convert.failed]);

  const [refreshing, setRefreshing] = useState(false);
  const runRefreshSource = useCallback(async () => {
    setRefreshing(true);
    await (async () => {
      const response = await apiClient.post(`/custom-tables/${tableId}/refresh-from-source`);
      const result = await checkContract(
        'RefreshedFromSource',
        response.data,
        '/custom-tables/:id/refresh-from-source',
      );
      toast.success(
        labels.toasts.refreshed
          .replace('{{inserted}}', String(result.inserted))
          .replace('{{updated}}', String(result.updated)),
      );
      await data.loadTable();
      await grid.loadRows({ reset: true });
      onRowsChanged();
    })()
      .catch(async error => {
        console.error('Failed to refresh table from source:', error);
        toast.error(getApiErrorMessage(error, labels.toasts.refreshFailed));
      })
      .finally(async () => setRefreshing(false));
  }, [tableId, data, grid, onRowsChanged, labels.toasts]);

  // "Restore to default": undo the table's app changes and rebuild it from the source.
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const runRestoreDefault = useCallback(async () => {
    setRestoring(true);
    await (async () => {
      const response = await apiClient.post(`/custom-tables/${tableId}/restore-default`);
      const result = await checkContract(
        'RestoredTableDefault',
        response.data,
        '/custom-tables/:id/restore-default',
      );
      toast.success(labels.toasts.restored.replace('{{reverted}}', String(result.reverted)));
      if (result.skippedChanged) {
        toast(labels.toasts.restoredSkipped.replace('{{count}}', String(result.skippedChanged)));
      }
      if (result.failed.length) {
        toast.error(
          labels.toasts.restoredFailed.replace('{{count}}', String(result.failed.length)),
        );
      }
      // The view settings the server just cleared, and the ones kept only here.
      // The restore changed app records back: drop cached document lists too.
      invalidateDocumentLists();
      setAggregates({});
      setGroupBy(null);
      setSorting([]);
      setColumnVisibility({});
      setRowSelection({});
      filters.clearFilters();
      filters.setSearchQuery('');
      await data.loadTable();
      await grid.loadRows({ reset: true });
      onRowsChanged();
    })()
      .catch(async error => {
        console.error('Failed to restore table to default:', error);
        toast.error(getApiErrorMessage(error, labels.toasts.restoreFailed));
      })
      .finally(async () => {
        setRestoring(false);
        setRestoreOpen(false);
      });
  }, [tableId, data, grid, filters, onRowsChanged, labels.toasts]);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) {
      return;
    }
    if (pendingDelete.kind === 'column' && pendingDelete.column) {
      await columnEditor.deleteColumn(pendingDelete.column);
      setPendingDelete(null);
      return;
    }
    await (async () => {
      await Promise.all(
        // Drafts were never saved, so the server has nothing to delete.
        selectedIds
          .filter(id => !isDraftRowId(id))
          .map(id => apiClient.delete(`/custom-tables/${tableId}/rows/${id}`)),
      );
      grid.setRows(prev => prev.filter(row => !selectedIds.includes(row.id)));
      setRowSelection({});
      toast.success(labels.toasts.rowsDeleted.replace('{{count}}', String(selectedIds.length)));
      onRowsChanged();
    })().catch(async error => {
      console.error('Failed to delete rows:', error);
      toast.error(getApiErrorMessage(error, labels.toasts.rowsDeleteFailed));
    });
    setPendingDelete(null);
  }, [pendingDelete, selectedIds, tableId, grid, columnEditor, onRowsChanged, labels.toasts]);

  const rename = useCallback(
    async (name: string) => {
      await (async () => {
        await apiClient.patch(`/custom-tables/${tableId}`, {
          name,
        } satisfies ContractInput<'UpdateCustomTableBody'>);
        data.setTable(prev => (prev ? { ...prev, name } : prev));
        toast.success(labels.toasts.renamed);
      })().catch(async error => {
        toast.error(getApiErrorMessage(error, labels.toasts.renameFailed));
      });
    },
    [tableId, data, labels.toasts.renamed, labels.toasts.renameFailed],
  );

  const [relationTargets, setRelationTargets] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (columnEditor.dialog.mode === 'closed' || relationTargets.length) {
      return;
    }
    apiQueryDecoded({ url: '/custom-tables', contract: 'CustomTableList' })
      .then(({ items }) => {
        setRelationTargets(
          items.filter(item => item.id !== tableId).map(({ id, name }) => ({ id, name })),
        );
      })
      .catch(error => console.error('Failed to load relation targets:', error));
  }, [columnEditor.dialog.mode, relationTargets.length, tableId]);

  const pickGroup = useCallback(
    (key: string | null) => {
      if (!groupBy) {
        return;
      }
      filters.addFilter(
        key === null ? { col: groupBy, op: 'isEmpty' } : { col: groupBy, op: 'eq', value: key },
      );
    },
    [groupBy, filters],
  );

  return {
    labels,
    router,
    defaultCurrency,
    data,
    columns,
    filters,
    sorting,
    setSorting,
    grid,
    rowSelection,
    setRowSelection,
    columnVisibility,
    setColumnVisibility,
    aggregates,
    aggregateValues: aggregateState.values,
    setAggregate,
    groupBy,
    setGroupBy,
    groups: groupState,
    pickGroup,
    mutations,
    columnEditor,
    relationTargets,
    paste,
    exporting,
    exportView,
    convert,
    setConvert,
    runConvert,
    refreshing,
    runRefreshSource,
    restoreOpen,
    setRestoreOpen,
    restoring,
    runRestoreDefault,
    summaries,
    pendingDelete,
    setPendingDelete,
    selectedIds,
    confirmDelete,
    rename,
  };
}

export type CustomTablePageState = ReturnType<typeof useCustomTablePage>;
