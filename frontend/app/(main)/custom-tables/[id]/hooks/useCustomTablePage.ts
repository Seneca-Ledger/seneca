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
import { downloadTableExport } from '../../exportTable';
import type { ConvertResult } from '../components/SendToStatementsDialog';
import { showUndoToast } from '../components/UndoToast';
import { buildDetailLabels } from '../labels';
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
  const [sorting, setSorting] = useState<SortingState>([]);
  const grid = useTableGrid({
    tableId,
    isAuthenticated,
    combinedFiltersParam: filters.filtersParam,
    sort: sortParam(sorting),
    loadRowsFailedMessage: labels.toasts.loadRowsFailed,
  });

  const [rowSelection, setRowSelection] = useState<Record<string, true>>({});
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
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
        .patch(`/custom-tables/${tableId}/view-settings/columns`, { columnKey, aggregate: fn })
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
      const payload = (response.data?.data ?? response.data) as ConvertResult;
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
      const result = (response.data?.data ?? response.data) as {
        inserted: number;
        updated: number;
      };
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
        selectedIds.map(id => apiClient.delete(`/custom-tables/${tableId}/rows/${id}`)),
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
        await apiClient.patch(`/custom-tables/${tableId}`, { name });
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
    apiClient
      .get('/custom-tables')
      .then(response => {
        const items = (response.data?.data ?? response.data ?? []) as Array<{
          id: string;
          name: string;
        }>;
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
    summaries,
    pendingDelete,
    setPendingDelete,
    selectedIds,
    confirmDelete,
    rename,
  };
}

export type CustomTablePageState = ReturnType<typeof useCustomTablePage>;
