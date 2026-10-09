'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { findHeaderRow } from '../utils/importRows';
import {
  buildPastePreview,
  isEditableTarget,
  type PasteMappingSelection,
  type PastePreviewData,
  type PasteRowStyles,
  type PasteTotals,
  parseClipboardRows,
} from '../utils/pasteUtils';
import { getResponseItems } from '../utils/tableHelpers';
import type { CustomTablePageColumn } from '../utils/tableTypes';
import {
  pickDefaultSheet,
  readTabularWorkbook,
  type SheetLayout,
  sheetToFormulaRows,
  sheetToLayout,
  sheetToTextRows,
  TabularFileError,
  type TabularWorkbook,
} from '../utils/tabularFileReader';
import type { CustomTableCellValue, CustomTableGridRow, CustomTableRowPatch } from '../utils/types';

/** Строк в одном запросе: сервер принимает до 1000, а прогресс приятнее видеть чаще. */
const CHUNK_SIZE = 500;
const ROLLBACK_PARALLEL = 25;

type Formulas = (string | undefined)[][] | undefined;
type NewColumn = NonNullable<PastePreviewData['columns'][number]>;

/**
 * Formula columns go last, and a formula that mentions another new column's
 * title waits for it: the server resolves titles to keys only for columns that
 * already exist.
 */
function orderNewColumns(columns: NewColumn[]): NewColumn[] {
  const plain = columns.filter(col => col.newType !== 'formula');
  const formulas = columns.filter(col => col.newType === 'formula');
  const titles = new Set(formulas.map(col => col.newTitle?.trim()));
  const refsOf = (col: NewColumn): string[] =>
    [...String(col.newConfig?.expression ?? '').matchAll(/\[([^\]]+)\]/g)]
      .map(match => match[1].trim())
      .filter(title => titles.has(title) && title !== col.newTitle?.trim());
  const ordered: NewColumn[] = [];
  const done = new Set<NewColumn>();
  const visit = (col: NewColumn, trail: Set<NewColumn>): void => {
    if (done.has(col) || trail.has(col)) {
      return;
    }
    trail.add(col);
    for (const ref of refsOf(col)) {
      const dep = formulas.find(item => item.newTitle?.trim() === ref);
      if (dep) {
        visit(dep, trail);
      }
    }
    done.add(col);
    ordered.push(col);
  };
  for (const col of formulas) {
    visit(col, new Set());
  }
  return [...plain, ...ordered];
}

function extractBatchInsertResult(
  response: { data?: Record<string, unknown> },
  fallbackCount: number,
): { normalizedRows: CustomTableGridRow[]; createdCount: number } {
  const payload = (response.data || {}) as Record<string, unknown>;
  const dataPayload = (payload.data || {}) as Record<string, unknown>;
  const createdRows = payload.rows || dataPayload.rows || payload.items || dataPayload.items || [];
  const normalizedRows = getResponseItems(createdRows);
  const createdCount = (payload.created ??
    dataPayload.created ??
    normalizedRows.length ??
    fallbackCount) as number;
  return { normalizedRows, createdCount };
}

function isTabularText(text: string): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.includes('\t') || normalized.split('\n').length > 1;
}

const countIssues = (rowStyles: Array<PasteRowStyles | null>): number =>
  rowStyles.reduce((total, styles) => total + (styles ? Object.keys(styles).length : 0), 0);

interface PasteDefaults {
  date: string;
  type: string;
  amount: string;
  currency: string;
  comment: string;
  paid: string;
  columnPrefix: string;
}

interface PasteMessages {
  noRows: string;
  missingColumnTitle: string;
  insertFailed: string;
  undoFailed: string;
  fileReadFailed: string;
  fileUnsupported: string;
  fileTooLarge: string;
  fileEmpty: string;
}

export interface PasteSheetOption {
  index: number;
  name: string;
  rows: number;
}

export interface PasteProgress {
  done: number;
  total: number;
}

export interface PasteInsertResult {
  createdCount: number;
  /** Ячейки, которые вошли текстом и подсвечены. */
  issueCount: number;
}

export interface UsePasteImportReturn {
  pastePreviewOpen: boolean;
  pasteParsing: boolean;
  pasteApplying: boolean;
  pasteRawRows: string[][];
  pasteUseHeaders: boolean;
  pastePreview: PastePreviewData | null;
  pasteMapping: Record<number, PasteMappingSelection>;
  pasteEdits: Record<string, string>;
  hasMissingPasteColumnTitles: boolean;
  /** Вкладки файла; пусто для вставки из буфера и одностраничных файлов. */
  pasteSheets: PasteSheetOption[];
  pasteSheetIndex: number;
  selectSheet: (index: number) => void;
  /** Итоговую строку файла показать как итоги футера. */
  pasteApplyTotals: boolean;
  setPasteApplyTotals: (value: boolean) => void;
  pasteProgress: PasteProgress | null;
  startPastePreview: (text: string) => void;
  startFileImport: (file: File) => Promise<void>;
  resetPastePreview: () => void;
  handlePasteHeadersToggle: (checked: boolean) => void;
  handlePasteCellChange: (rowIndex: number, sourceIndex: number, value: string) => void;
  handlePasteMappingChange: (sourceIndex: number, selection: PasteMappingSelection) => void;
  handlePasteAdd: () => Promise<void>;
}

interface UsePasteImportParams {
  tableId: string | null;
  orderedColumns: CustomTablePageColumn[];
  pasteDefaults: PasteDefaults;
  loadTable: () => Promise<void>;
  /** Fired after rows were inserted or rolled back so totals can refresh. */
  onRowsChanged: () => void;
  setRows: React.Dispatch<React.SetStateAction<CustomTableGridRow[]>>;
  /** Called after successful paste — component renders the undo toast */
  onInsertSuccess: (result: PasteInsertResult, onUndo: () => void) => void;
  messages: PasteMessages;
}

/**
 * TabularFileError already carries a `reason` discriminator, so localise by that
 * and let its English message stand in for any kind we have no copy for.
 */
function describeFileError(error: unknown, messages: PasteMessages): string {
  if (!(error instanceof TabularFileError)) {
    return messages.fileReadFailed;
  }

  switch (error.reason) {
    case 'unsupported':
      return messages.fileUnsupported;
    case 'too-large':
      return messages.fileTooLarge;
    case 'empty':
      return messages.fileEmpty;
    case 'unreadable':
      return messages.fileReadFailed;
    default:
      return error.message;
  }
}

export function usePasteImport({
  tableId,
  orderedColumns,
  pasteDefaults,
  loadTable,
  onRowsChanged,
  setRows,
  onInsertSuccess,
  messages,
}: UsePasteImportParams): UsePasteImportReturn {
  const [pastePreviewOpen, setPastePreviewOpen] = useState(false);
  const [pasteParsing, setPasteParsing] = useState(false);
  const [pasteApplying, setPasteApplying] = useState(false);
  const [pasteRawRows, setPasteRawRows] = useState<string[][]>([]);
  const [pasteFormulas, setPasteFormulas] = useState<Formulas>(undefined);
  const [pasteLayout, setPasteLayout] = useState<SheetLayout | undefined>(undefined);
  const [pasteSummaries, setPasteSummaries] = useState<PastePreviewData['summaries']>([]);
  const [pasteUseHeaders, setPasteUseHeaders] = useState(false);
  const [pastePreview, setPastePreview] = useState<PastePreviewData | null>(null);
  const [pasteMapping, setPasteMapping] = useState<Record<number, PasteMappingSelection>>({});
  const [pasteEdits, setPasteEdits] = useState<Record<string, string>>({});
  const [pasteWorkbook, setPasteWorkbook] = useState<TabularWorkbook | null>(null);
  const [pasteSheetIndex, setPasteSheetIndex] = useState(0);
  const [pasteApplyTotals, setPasteApplyTotals] = useState(true);
  const [pasteProgress, setPasteProgress] = useState<PasteProgress | null>(null);
  const pastePreviewTimerRef = useRef<number | null>(null);

  const hasMissingPasteColumnTitles = useMemo(
    () => Boolean(pastePreview?.columns.some(col => col.mode === 'new' && !col.newTitle?.trim())),
    [pastePreview],
  );

  const pasteSheets = useMemo<PasteSheetOption[]>(
    () =>
      pasteWorkbook && pasteWorkbook.sheets.length > 1
        ? pasteWorkbook.sheets.map((sheet, index) => ({
            index,
            name: sheet.name,
            rows: sheet.rows.length,
          }))
        : [],
    [pasteWorkbook],
  );

  const resetPastePreview = useCallback(() => {
    setPastePreviewOpen(false);
    setPastePreview(null);
    setPasteRawRows([]);
    setPasteFormulas(undefined);
    setPasteLayout(undefined);
    setPasteSummaries([]);
    setPasteUseHeaders(false);
    setPasteParsing(false);
    setPasteApplying(false);
    setPasteMapping({});
    setPasteEdits({});
    setPasteWorkbook(null);
    setPasteSheetIndex(0);
    setPasteApplyTotals(true);
    setPasteProgress(null);
    if (pastePreviewTimerRef.current) {
      window.clearTimeout(pastePreviewTimerRef.current);
      pastePreviewTimerRef.current = null;
    }
  }, []);

  const buildPreviewAsync = useCallback(
    (
      rows: string[][],
      useHeaders: boolean,
      mappingSelection: Record<number, PasteMappingSelection> | null,
      edits: Record<string, string>,
    ) => {
      setPasteParsing(true);
      if (pastePreviewTimerRef.current) {
        window.clearTimeout(pastePreviewTimerRef.current);
      }
      pastePreviewTimerRef.current = window.setTimeout(() => {
        const result = buildPastePreview({
          rawRows: rows,
          formulas: pasteFormulas,
          layout: pasteLayout,
          useHeaders,
          orderedColumns,
          mappingSelection,
          edits,
          defaults: pasteDefaults,
        });
        setPastePreview(result.preview);
        setPasteMapping(result.mapping);
        setPasteParsing(false);
        pastePreviewTimerRef.current = null;
      }, 0);
    },
    [orderedColumns, pasteDefaults, pasteFormulas, pasteLayout],
  );

  /**
   * Общий вход для вставки из буфера и импорта файлом. Шапка ищется по всему
   * началу файла: титульные строки над ней отбрасываются, и дальше первая
   * строка матрицы — либо заголовки, либо сразу данные.
   */
  const startPreviewFromRows = useCallback(
    (rows: string[][], formulas?: Formulas, layout?: SheetLayout) => {
      // An empty table is a fine target: the import creates the columns it needs.
      if (!rows.length) {
        return;
      }
      const headerIndex = findHeaderRow(rows);
      const offset = Math.max(headerIndex, 0);
      const trimmedRows = rows.slice(offset);
      const trimmedFormulas = formulas?.slice(offset);
      const trimmedLayout = layout
        ? { originCol: layout.originCol, sheetRows: layout.sheetRows.slice(offset) }
        : undefined;
      const useHeaders = headerIndex >= 0;
      setPasteRawRows(trimmedRows);
      setPasteFormulas(trimmedFormulas);
      setPasteLayout(trimmedLayout);
      setPasteUseHeaders(useHeaders);
      setPastePreviewOpen(true);
      setPasteParsing(true);
      setPasteEdits({});
      window.setTimeout(() => {
        const result = buildPastePreview({
          rawRows: trimmedRows,
          formulas: trimmedFormulas,
          layout: trimmedLayout,
          useHeaders,
          orderedColumns,
          mappingSelection: null,
          edits: {},
          defaults: pasteDefaults,
        });
        setPastePreview(result.preview);
        setPasteMapping(result.mapping);
        // Summaries are decided once, from the file; later mapping edits keep them.
        setPasteSummaries(result.preview.summaries);
        setPasteParsing(false);
      }, 0);
    },
    [orderedColumns, pasteDefaults],
  );

  const startPastePreview = useCallback(
    (text: string) => {
      const { rows } = parseClipboardRows(text);
      startPreviewFromRows(rows);
    },
    [startPreviewFromRows],
  );

  const loadSheet = useCallback(
    (workbook: TabularWorkbook, index: number) => {
      const sheet = workbook.sheets[index];
      if (!sheet) {
        return;
      }
      setPasteSheetIndex(index);
      startPreviewFromRows(sheetToTextRows(sheet), sheetToFormulaRows(sheet), sheetToLayout(sheet));
    },
    [startPreviewFromRows],
  );

  const startFileImport = useCallback(
    async (file: File) => {
      await (async () => {
        const workbook = await readTabularWorkbook(file);
        setPasteWorkbook(workbook);
        loadSheet(workbook, pickDefaultSheet(workbook));
      })().catch(async error => {
        console.error('Failed to read import file:', error);
        toast.error(describeFileError(error, messages));
      });
    },
    [loadSheet, messages],
  );

  const selectSheet = useCallback(
    (index: number) => {
      if (pasteWorkbook) {
        loadSheet(pasteWorkbook, index);
      }
    },
    [pasteWorkbook, loadSheet],
  );

  const handlePasteHeadersToggle = useCallback(
    (checked: boolean) => {
      setPasteUseHeaders(checked);
      if (!pasteRawRows.length) {
        return;
      }
      setPasteEdits({});
      buildPreviewAsync(pasteRawRows, checked, null, {});
    },
    [pasteRawRows, buildPreviewAsync],
  );

  const rebuildPasteWithState = useCallback(
    (nextMapping: Record<number, PasteMappingSelection>, nextEdits: Record<string, string>) => {
      if (!pasteRawRows.length) {
        return;
      }
      buildPreviewAsync(pasteRawRows, pasteUseHeaders, nextMapping, nextEdits);
    },
    [pasteRawRows, pasteUseHeaders, buildPreviewAsync],
  );

  const handlePasteMappingChange = useCallback(
    (sourceIndex: number, selection: PasteMappingSelection) => {
      const next = { ...pasteMapping, [sourceIndex]: selection };
      setPasteMapping(next);
      rebuildPasteWithState(next, pasteEdits);
    },
    [pasteMapping, pasteEdits, rebuildPasteWithState],
  );

  const handlePasteCellChange = useCallback(
    (rowIndex: number, sourceIndex: number, value: string) => {
      setPasteEdits(prev => {
        const cellKey = `${rowIndex}:${sourceIndex}`;
        const next = { ...prev, [cellKey]: value };
        rebuildPasteWithState(pasteMapping, next);
        return next;
      });
    },
    [pasteMapping, rebuildPasteWithState],
  );

  const appendRows = useCallback(
    (createdRows: CustomTableGridRow[]) => {
      setRows(prev => {
        const merged = [...prev, ...createdRows];
        const seen = new Set<string>();
        const deduped: CustomTableGridRow[] = [];
        for (const row of merged) {
          const id = row.id || String(row.rowNumber);
          if (!id || seen.has(id)) {
            continue;
          }
          seen.add(id);
          deduped.push(row);
        }
        deduped.sort((a, b) => (a.rowNumber ?? 0) - (b.rowNumber ?? 0));
        return deduped;
      });
    },
    [setRows],
  );

  /** Откат импорта: строки пачками, затем колонки, которые он же и создал. */
  const rollback = useCallback(
    async (rowIds: string[], columnIds: string[]) => {
      if (!tableId) {
        return;
      }
      await (async () => {
        for (let index = 0; index < rowIds.length; index += ROLLBACK_PARALLEL) {
          await Promise.all(
            rowIds
              .slice(index, index + ROLLBACK_PARALLEL)
              .map(rowId => apiClient.delete(`/custom-tables/${tableId}/rows/${rowId}`)),
          );
        }
        for (const columnId of columnIds) {
          await apiClient.delete(`/custom-tables/${tableId}/columns/${columnId}`);
        }
        setRows(prev => prev.filter(row => !rowIds.includes(row.id)));
        if (columnIds.length) {
          await loadTable();
        }
        onRowsChanged();
      })().catch(async error => {
        console.error('Failed to rollback import:', error);
        toast.error(messages.undoFailed);
      });
    },
    [tableId, onRowsChanged, setRows, loadTable, messages.undoFailed],
  );

  const createNewColumns = async (
    newColumns: NonNullable<typeof pastePreview>['columns'],
  ): Promise<{ keyMap: Map<string, string>; columnIds: string[] }> => {
    const keyMap = new Map<string, string>();
    const columnIds: string[] = [];
    if (!newColumns.length) {
      return { keyMap, columnIds };
    }
    // One by one: the server numbers positions by creation order, and the
    // table should read in the same order as the file.
    const created: Array<{ data?: { data?: Record<string, unknown> } & Record<string, unknown> }> =
      [];
    const ordered = orderNewColumns(newColumns);
    for (const col of ordered) {
      created.push(
        await apiClient.post(`/custom-tables/${tableId}/columns`, {
          title: col.newTitle?.trim(),
          type: col.newType ?? 'text',
          ...(col.newConfig ? { config: col.newConfig } : {}),
        }),
      );
    }
    for (let i = 0; i < created.length; i++) {
      const payload = (created[i].data?.data || created[i].data) as
        | { key?: string; id?: string }
        | undefined;
      const placeholderKey = ordered[i]?.columnKey || '';
      if (payload?.key && placeholderKey) {
        keyMap.set(placeholderKey, payload.key);
      }
      if (payload?.id) {
        columnIds.push(payload.id);
      }
    }
    await loadTable();
    return { keyMap, columnIds };
  };

  const buildPayloadRows = (
    dataRows: Record<string, unknown>[],
    rowStyles: Array<PasteRowStyles | null>,
    keyMap: Map<string, string>,
  ): Array<{ data: CustomTableRowPatch; styles?: PasteRowStyles }> =>
    dataRows.map((row, index) => {
      const data: CustomTableRowPatch = {};
      for (const [key, value] of Object.entries(row)) {
        data[keyMap.get(key) || key] = value as CustomTableCellValue;
      }
      const styles = rowStyles[index];
      if (!styles) {
        return { data };
      }
      const remapped: PasteRowStyles = {};
      for (const [key, style] of Object.entries(styles)) {
        remapped[keyMap.get(key) || key] = style;
      }
      return { data, styles: remapped };
    });

  /** Formulas of the file's totals row become summaries, next to the ones the table already has. */
  const applySummaries = async (summaries: PastePreviewData['summaries']): Promise<void> => {
    if (!summaries.length) {
      return;
    }
    const response = await apiClient.get(`/custom-tables/${tableId}/summaries`);
    const payload = (response.data?.data ?? response.data) as {
      items?: Array<{ id: string; title: string; expression: string }>;
    };
    const existing = (payload?.items ?? []).map(({ id, title, expression }) => ({
      id,
      title,
      expression,
    }));
    await apiClient.patch(`/custom-tables/${tableId}/view-settings/summaries`, {
      summaries: [...existing, ...summaries].slice(0, 20),
    });
  };

  const applyTotals = async (totals: PasteTotals, keyMap: Map<string, string>): Promise<void> => {
    const entries = Object.entries(totals.aggregates);
    if (!entries.length) {
      return;
    }
    for (const [key, aggregate] of entries) {
      await apiClient.patch(`/custom-tables/${tableId}/view-settings/columns`, {
        columnKey: keyMap.get(key) || key,
        aggregate,
      });
    }
    await loadTable();
  };

  const handlePasteAdd = useCallback(async () => {
    if (!(tableId && pastePreview) || pasteApplying) {
      return;
    }
    if (!pastePreview.dataRows.length) {
      toast.error(messages.noRows);
      return;
    }

    const newColumns = pastePreview.columns.filter(col => col.mode === 'new');
    if (newColumns.some(col => !col.newTitle?.trim())) {
      toast.error(messages.missingColumnTitle);
      return;
    }

    setPasteApplying(true);
    const created: CustomTableGridRow[] = [];
    const createdColumnIds: string[] = [];

    await (async () => {
      const { keyMap, columnIds } = await createNewColumns(newColumns);
      createdColumnIds.push(...columnIds);
      const payloadRows = buildPayloadRows(pastePreview.dataRows, pastePreview.rowStyles, keyMap);
      const total = payloadRows.length;
      setPasteProgress({ done: 0, total });
      for (let index = 0; index < total; index += CHUNK_SIZE) {
        const chunk = payloadRows.slice(index, index + CHUNK_SIZE);
        const response = await apiClient.post(`/custom-tables/${tableId}/rows/batch`, {
          rows: chunk,
        });
        created.push(...extractBatchInsertResult(response, chunk.length).normalizedRows);
        setPasteProgress({ done: Math.min(index + CHUNK_SIZE, total), total });
      }
      if (pasteApplyTotals) {
        await applyTotals(pastePreview.totals, keyMap);
        await applySummaries(pasteSummaries);
      }
      // Formula values come from the server after its recalc: reload the rows we appended.
      const hasFormulas = newColumns.some(col => col.newType === 'formula');
      const issueCount = countIssues(pastePreview.rowStyles);
      appendRows(created);
      resetPastePreview();
      onRowsChanged();
      if (hasFormulas) {
        await loadTable();
      }
      onInsertSuccess({ createdCount: created.length || total, issueCount }, () =>
        rollback(created.map(row => row.id).filter(Boolean), createdColumnIds),
      );
    })()
      .catch(async error => {
        // The server names the column and value that stopped the batch; show that, not a generic line.
        toast.error(getApiErrorMessage(error, messages.insertFailed));
        // Часть пачек могла уже войти: покажем их, а не оставим таблицу вразнобой с сервером.
        if (created.length) {
          appendRows(created);
          onRowsChanged();
        }
      })
      .finally(async () => {
        setPasteApplying(false);
        setPasteProgress(null);
      });
  }, [
    tableId,
    pastePreview,
    pasteApplying,
    pasteApplyTotals,
    pasteSummaries,
    appendRows,
    resetPastePreview,
    loadTable,
    onRowsChanged,
    rollback,
    onInsertSuccess,
    messages.noRows,
    messages.missingColumnTitle,
    messages.insertFailed,
    createNewColumns,
    applyTotals,
    applySummaries,
  ]);

  // Global paste event listener
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (pastePreviewOpen || pasteApplying) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      const clipboardText = event.clipboardData?.getData('text/plain') || '';
      if (!isTabularText(clipboardText)) {
        return;
      }
      event.preventDefault();
      startPastePreview(clipboardText);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [pastePreviewOpen, pasteApplying, startPastePreview]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pastePreviewTimerRef.current) {
        window.clearTimeout(pastePreviewTimerRef.current);
      }
    };
  }, []);

  return {
    pastePreviewOpen,
    pasteParsing,
    pasteApplying,
    pasteRawRows,
    pasteUseHeaders,
    pastePreview,
    pasteMapping,
    pasteEdits,
    hasMissingPasteColumnTitles,
    pasteSheets,
    pasteSheetIndex,
    selectSheet,
    pasteApplyTotals,
    setPasteApplyTotals,
    pasteProgress,
    startPastePreview,
    startFileImport,
    resetPastePreview,
    handlePasteHeadersToggle,
    handlePasteCellChange,
    handlePasteMappingChange,
    handlePasteAdd,
  };
}
