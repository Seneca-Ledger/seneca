'use client';

import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { createDraftRow, isDraftReadyToSave, isDraftRowId } from '../helpers/draftRowHelpers';
import {
  applyRowDataPatch,
  createRowRequest,
  updateRowPatchRequest,
} from '../helpers/rowActionHelpers';
import type {
  CustomTableCellValue,
  CustomTableColumn,
  CustomTableGridRow,
  CustomTableRowPatch,
} from '../utils/types';

interface UseRowMutationsMessages {
  addRowLoading: string;
  addRowSuccess: string;
  addRowFailed: string;
}

export interface UseRowMutationsParams {
  tableId: string | null;
  /** Every column, hidden ones included: they decide whether a draft can be saved. */
  columns: CustomTableColumn[];
  rows: CustomTableGridRow[];
  setRows: React.Dispatch<React.SetStateAction<CustomTableGridRow[]>>;
  /** Fired after a persisted change so totals and groups can refresh. */
  onRowsChanged: () => void;
  messages: UseRowMutationsMessages;
}

export interface UseRowMutationsReturn {
  createRow: () => CustomTableGridRow | null;
  updateCell: (rowId: string, columnKey: string, value: CustomTableCellValue) => Promise<void>;
}

export function useRowMutations({
  tableId,
  columns,
  rows,
  setRows,
  onRowsChanged,
  messages,
}: UseRowMutationsParams): UseRowMutationsReturn {
  const draftSeqRef = useRef(0);
  // Rows whose POST is in flight: two quick cell edits must not create two rows.
  const promotingRef = useRef<Set<string>>(new Set());

  // Drafts live only on the client: the backend rejects an empty row while any
  // column is required, so the POST waits until the draft is complete.
  const createRow = useCallback((): CustomTableGridRow | null => {
    if (!tableId) {
      return null;
    }
    draftSeqRef.current += 1;
    const draft = createDraftRow(draftSeqRef.current, rows.length + 1);
    setRows(prev => [...prev, draft]);
    return draft;
  }, [tableId, rows.length, setRows]);

  const promoteDraftRow = useCallback(
    async (rowId: string, nextData: CustomTableRowPatch): Promise<void> => {
      if (!tableId || promotingRef.current.has(rowId) || !isDraftReadyToSave(nextData, columns)) {
        return;
      }
      promotingRef.current.add(rowId);
      const toastId = toast.loading(messages.addRowLoading);
      await (async () => {
        const created = await createRowRequest(tableId, rows.length, nextData);
        setRows(prev =>
          prev.map(r =>
            r.id === rowId ? { ...created, data: { ...nextData, ...created.data } } : r,
          ),
        );
        toast.success(messages.addRowSuccess, { id: toastId });
        onRowsChanged();
      })()
        .catch(async error => {
          // The row stays a draft: the next cell edit retries the POST.
          console.error('Failed to add row:', error);
          toast.error(messages.addRowFailed, { id: toastId });
        })
        .finally(async () => {
          promotingRef.current.delete(rowId);
        });
    },
    [tableId, columns, rows.length, setRows, onRowsChanged, messages],
  );

  const updateCell = useCallback(
    async (rowId: string, columnKey: string, value: CustomTableCellValue): Promise<void> => {
      if (!tableId) {
        return;
      }
      if (isDraftRowId(rowId)) {
        setRows(prev => applyRowDataPatch(prev, rowId, { [columnKey]: value }));
        const nextData = { ...(rows.find(r => r.id === rowId)?.data || {}), [columnKey]: value };
        await promoteDraftRow(rowId, nextData);
        return;
      }
      // A cell the import kept as text stops being an issue once someone edits it.
      const clearIssue = Boolean(rows.find(r => r.id === rowId)?.styles?.[columnKey]?.importIssue);
      // The reply carries recomputed formulas, so it wins over the local patch.
      const serverData = await updateRowPatchRequest(
        tableId,
        rowId,
        { [columnKey]: value },
        clearIssue ? { [columnKey]: {} } : undefined,
      );
      setRows(prev =>
        applyRowDataPatch(prev, rowId, { [columnKey]: value, ...serverData }).map(row =>
          clearIssue && row.id === rowId
            ? { ...row, styles: { ...(row.styles ?? {}), [columnKey]: {} } }
            : row,
        ),
      );
      onRowsChanged();
    },
    [tableId, rows, setRows, onRowsChanged, promoteDraftRow],
  );

  return { createRow, updateCell };
}
