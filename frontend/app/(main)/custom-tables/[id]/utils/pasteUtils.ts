// Re-exports for backward compatibility

export {
  buildColumnMaps,
  buildMappedColumns,
  inferFieldFromColumn,
  inferNewColumnType,
  tryMapByHeaderMatch,
  tryMapByValueInference,
} from './pasteMappingBuilder';
export {
  matchFieldByName,
  normalizeToken,
  parseClipboardRows,
  parseCurrencyCell,
  parseDateCell,
  parseNumberCell,
  parsePaidCell,
  resolveCurrencyCode,
  splitDelimitedRow,
} from './pasteParser';
export { buildRowData } from './pasteRowBuilder';
export type {
  ImportedFormula,
  PasteColumn,
  PasteColumnMapping,
  PasteErrorKey,
  PasteFieldKey,
  PasteMappingSelection,
  PastePreviewCell,
  PastePreviewData,
  PastePreviewRow,
  PasteRowStyles,
  PasteSourceColumn,
  PasteTotals,
} from './pasteTypes';
export { PASTE_FIELD_ALIASES } from './pasteTypes';

// ---------------------------------------------------------------------------
// Imports used in this file
// ---------------------------------------------------------------------------

import {
  decideColumnFormula,
  type TranslationScope,
  translateTotalsFormula,
} from './excelFormulaTranslator';
import { classifyRows, isHeaderRow, type TotalsAggregate } from './importRows';
import { inferColumnType } from './importTypes';
import {
  buildColumnMaps,
  buildMappedColumns,
  tryMapByHeaderMatch,
  tryMapByValueInference,
} from './pasteMappingBuilder';
import { buildRowData } from './pasteRowBuilder';
import type {
  ImportedFormula,
  PasteColumn,
  PasteErrorKey,
  PasteFieldKey,
  PasteMappingSelection,
  PastePreviewData,
  PasteRowStyles,
  PasteSourceColumn,
  PasteTotals,
} from './pasteTypes';
import type { SheetLayout } from './tabularFileReader';
import type { CustomTableRowPatch } from './types';

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

export const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  if (element.closest("input, textarea, select, [contenteditable='true']")) {
    return true;
  }
  return Boolean(element.getAttribute('contenteditable') === 'true');
};

export const isAbortError = (error: unknown): boolean => {
  const candidate = error as { name?: string; code?: string } | null;
  return (
    candidate?.name === 'CanceledError' ||
    candidate?.name === 'AbortError' ||
    candidate?.code === 'ERR_CANCELED'
  );
};

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

/** Первая строка — шапка? Полный поиск по файлу делает findHeaderRow при загрузке. */
export const detectHeaderRow = (
  rows: string[][],
  fieldByColumnName: Map<string, PasteFieldKey>,
): boolean => rows.length > 0 && isHeaderRow(rows, 0, fieldByColumnName);

// ---------------------------------------------------------------------------
// Source column builder
// ---------------------------------------------------------------------------

const SAMPLE_ROWS = 50;

export const buildSourceColumns = (
  headerRow: string[],
  dataRows: string[][],
): PasteSourceColumn[] => {
  const maxLen = Math.max(headerRow.length, ...dataRows.map(row => row.length), 0);
  const columns: PasteSourceColumn[] = [];
  for (let index = 0; index < maxLen; index += 1) {
    const header = String(headerRow[index] ?? '').trim();
    const sampleValues = dataRows
      .slice(0, SAMPLE_ROWS)
      .map(row => String(row[index] ?? ''))
      .filter(value => value.trim() !== '');
    columns.push({ index, header, sampleValues });
  }
  return columns;
};

// ---------------------------------------------------------------------------
// Auto-mapping builder
// ---------------------------------------------------------------------------

type AutoMappingArgs = {
  sourceColumns: PasteSourceColumn[];
  maps: ReturnType<typeof buildColumnMaps>;
  useHeaders: boolean;
  defaults: Record<PasteFieldKey | 'columnPrefix', string>;
};

/**
 * Куда положить исходную колонку: в существующую с тем же названием или
 * ролью, иначе в новую с типом и настройками, угаданными по значениям.
 */
const mapSourceColumn = (
  sourceColumn: PasteSourceColumn,
  ctx: Parameters<typeof tryMapByHeaderMatch>[1],
  defaults: Record<PasteFieldKey | 'columnPrefix', string>,
): PasteMappingSelection => {
  const { index, header, sampleValues } = sourceColumn;
  if (!(header || sampleValues.length)) {
    return { mode: 'ignore' };
  }
  const inferred = inferColumnType(sampleValues, { header });
  const headerResult = tryMapByHeaderMatch(sourceColumn, ctx);
  if (headerResult) {
    return headerResult.mode === 'new' && inferred.type !== 'text'
      ? { ...headerResult, newType: inferred.type, newConfig: inferred.config }
      : headerResult;
  }
  const valueResult =
    inferred.field && inferred.field !== 'comment'
      ? tryMapByValueInference(sourceColumn, inferred.field, ctx)
      : null;
  if (valueResult?.mode === 'existing') {
    return valueResult;
  }
  return {
    mode: 'new',
    field: inferred.field,
    newTitle: header || `${defaults.columnPrefix} ${index + 1}`,
    newType: inferred.type,
    newConfig: inferred.config,
  };
};

const buildAutoMapping = ({
  sourceColumns,
  maps,
  useHeaders,
  defaults,
}: AutoMappingArgs): Record<number, PasteMappingSelection> => {
  const usedExisting = new Set<string>();
  const ctx = {
    useHeaders,
    columnNameMap: maps.columnNameMap,
    fieldToColumn: maps.fieldToColumn,
    defaults,
    usedExisting,
  };
  const mapping: Record<number, PasteMappingSelection> = {};
  for (const sc of sourceColumns) {
    mapping[sc.index] = mapSourceColumn(sc, ctx, defaults);
  }
  return mapping;
};

// ---------------------------------------------------------------------------
// Row data builder
// ---------------------------------------------------------------------------

type DataPayloadArgs = {
  dataRows: string[][];
  mappedColumns: ReturnType<typeof buildMappedColumns>;
  edits: Record<string, string>;
};

type DataPayloadResult = {
  dataPayload: CustomTableRowPatch[];
  rowStyles: Array<PasteRowStyles | null>;
  previewRows: PastePreviewData['previewRows'];
  errors: Record<PasteErrorKey, number>;
  hasErrors: boolean;
};

const buildDataPayload = ({
  dataRows,
  mappedColumns,
  edits,
}: DataPayloadArgs): DataPayloadResult => {
  const dataPayload: CustomTableRowPatch[] = [];
  const rowStyles: Array<PasteRowStyles | null> = [];
  const previewRows: PastePreviewData['previewRows'] = [];
  const errors: Record<PasteErrorKey, number> = { date: 0, amount: 0, currency: 0, paid: 0 };
  let hasErrors = false;

  dataRows.forEach((row, rowIndex) => {
    if (!row || row.every(cell => !String(cell ?? '').trim())) {
      return;
    }
    const result = buildRowData({ row, rowIndex, mappedColumns, edits });
    for (const key of Object.keys(result.errors) as PasteErrorKey[]) {
      errors[key] += result.errors[key];
    }
    if (result.hasError) {
      hasErrors = true;
    }
    dataPayload.push(result.rowData);
    rowStyles.push(result.styles);
    if (previewRows.length < 50) {
      previewRows.push({ id: rowIndex, rowIndex, cells: result.cells });
    }
  });

  return { dataPayload, rowStyles, previewRows, errors, hasErrors };
};

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/** Агрегаты итоговой строки переводятся с индексов исходных колонок на ключи целевых. */
const mapTotals = (
  classification: ReturnType<typeof classifyRows>,
  mappedColumns: ReturnType<typeof buildMappedColumns>,
): PasteTotals => {
  const aggregates: PasteTotals['aggregates'] = {};
  for (const column of mappedColumns) {
    if (column.sourceIndex === null || !column.columnKey) {
      continue;
    }
    const aggregate = classification.totals.aggregates[column.sourceIndex];
    const numeric =
      column.field === 'amount' || column.newType === 'number' || column.newType === 'currency';
    if (aggregate && numeric) {
      aggregates[column.columnKey] = aggregate;
    }
  }
  return { excludedRows: classification.totals.rowIndexes.length, aggregates };
};

// ---------------------------------------------------------------------------
// Excel formulas
// ---------------------------------------------------------------------------

type FormulaCarryArgs = {
  headerRow: string[];
  bodyRows: string[][];
  bodyFormulas: (string | undefined)[][] | undefined;
  /** Sheet rows aligned with bodyRows; undefined for pasted text. */
  bodySheetRows: number[] | undefined;
  originCol: number;
  classification: ReturnType<typeof classifyRows>;
  mapping: Record<number, PasteMappingSelection>;
  columnByKey: Map<string, PasteColumn>;
};

type FormulaCarryResult = {
  formulas: PastePreviewData['formulas'];
  summaries: PastePreviewData['summaries'];
};

const NO_FORMULAS: FormulaCarryResult = { formulas: { carried: 0, total: 0 }, summaries: [] };

const targetTitle = (
  selection: PasteMappingSelection | undefined,
  header: string,
  columnByKey: Map<string, PasteColumn>,
): string | null => {
  if (!selection || selection.mode === 'ignore') {
    return null;
  }
  if (selection.mode === 'existing') {
    const column = selection.columnKey ? columnByKey.get(selection.columnKey) : null;
    return column ? column.title || column.key : null;
  }
  return selection.newTitle?.trim() || header || null;
};

/**
 * Формулы из файла: колонка, в которой одна формула протянута вниз, становится
 * формульной колонкой; формулы строки «Итого» — сводками. Что перенести нельзя,
 * получает причину и остаётся значениями.
 */
const carryExcelFormulas = ({
  headerRow,
  bodyRows,
  bodyFormulas,
  bodySheetRows,
  originCol,
  classification,
  mapping,
  columnByKey,
}: FormulaCarryArgs): FormulaCarryResult => {
  if (!(bodyFormulas && bodySheetRows && bodyFormulas.some(row => row?.some(Boolean)))) {
    return NO_FORMULAS;
  }
  const dataIndexes = classification.kinds
    .map((kind, index) => (kind === 'data' ? index : -1))
    .filter(index => index >= 0);
  if (!dataIndexes.length) {
    return NO_FORMULAS;
  }
  const dataSheetRows = dataIndexes.map(index => bodySheetRows[index]);
  const dataRows = { first: Math.min(...dataSheetRows), last: Math.max(...dataSheetRows) };
  const totalsSheetRows = new Map<number, Record<number, TotalsAggregate>>();
  for (const index of classification.totals.rowIndexes) {
    totalsSheetRows.set(bodySheetRows[index], classification.totals.aggregates);
  }
  const scopeFor = (cellRow: number): TranslationScope => ({
    cellRow,
    dataRows,
    columnAt: sheetCol => {
      const sourceIndex = sheetCol - originCol;
      const title = targetTitle(mapping[sourceIndex], headerRow[sourceIndex] ?? '', columnByKey);
      return title ? { title } : null;
    },
    totalsAggregateAt: (sheetRow, sheetCol) => {
      const aggregate = totalsSheetRows.get(sheetRow)?.[sheetCol - originCol];
      return aggregate ?? null;
    },
  });

  let total = 0;
  let carried = 0;
  const maxLen = Math.max(headerRow.length, ...bodyRows.map(row => row.length), 0);
  for (let sourceIndex = 0; sourceIndex < maxLen; sourceIndex += 1) {
    const selection = mapping[sourceIndex];
    if (selection?.mode !== 'new') {
      continue;
    }
    const decision = decideColumnFormula(
      dataIndexes.map(index => ({
        formula: bodyFormulas[index]?.[sourceIndex],
        text: String(bodyRows[index]?.[sourceIndex] ?? ''),
      })),
      position => dataSheetRows[position],
      position => scopeFor(dataSheetRows[position]),
    );
    if (!decision) {
      continue;
    }
    total += 1;
    const formula: ImportedFormula = {
      excel: decision.excel,
      overriddenCells: decision.overriddenCells,
      ...(decision.translation.kind === 'unsupported'
        ? { reason: decision.translation.reason }
        : { expression: decision.translation.expression }),
    };
    selection.formula = formula;
    if (decision.translation.kind === 'row') {
      carried += 1;
      selection.newType = 'formula';
      selection.newConfig = { expression: decision.translation.expression };
    } else {
      selection.newConfig = { ...(selection.newConfig ?? {}), importedFormula: formula.excel };
    }
  }

  const summaries: PastePreviewData['summaries'] = [];
  const firstTotals = classification.totals.rowIndexes[0];
  if (firstTotals !== undefined) {
    const sheetRow = bodySheetRows[firstTotals];
    (bodyFormulas[firstTotals] ?? []).forEach((formula, sourceIndex) => {
      // Простые SUM/AVERAGE строки «Итого» уже стали итогами футера.
      if (!formula || classification.totals.aggregates[sourceIndex]) {
        return;
      }
      total += 1;
      const translation = translateTotalsFormula(formula, scopeFor(sheetRow));
      if (translation.kind === 'summary') {
        carried += 1;
        summaries.push({
          title:
            headerRow[sourceIndex]?.trim() ||
            String(bodyRows[firstTotals]?.[0] ?? '').trim() ||
            'Total',
          expression: translation.expression,
        });
      }
    });
  }
  return { formulas: { carried, total }, summaries };
};

// ---------------------------------------------------------------------------
// Main paste preview builder
// ---------------------------------------------------------------------------

export type BuildPastePreviewArgs = {
  rawRows: string[][];
  /** Формулы ячеек той же формы, что rawRows; есть только у файлов. */
  formulas?: (string | undefined)[][];
  /** Геометрия листа для перевода A1-ссылок; есть только у файлов. */
  layout?: SheetLayout;
  useHeaders: boolean;
  orderedColumns: PasteColumn[];
  mappingSelection: Record<number, PasteMappingSelection> | null;
  edits: Record<string, string>;
  defaults: Record<PasteFieldKey | 'columnPrefix', string>;
};

type PreviewResult = {
  preview: PastePreviewData;
  mapping: Record<number, PasteMappingSelection>;
  sourceColumns: PasteSourceColumn[];
};

const NO_TOTALS: PasteTotals = { excludedRows: 0, aggregates: {} };

/** После правок маппинга счётчик формул берётся из самих колонок. */
const countFormulas = (
  mappedColumns: ReturnType<typeof buildMappedColumns>,
): PastePreviewData['formulas'] => {
  const withFormula = mappedColumns.filter(column => column.formula);
  return {
    total: withFormula.length,
    carried: withFormula.filter(
      column => column.formula?.expression && column.newType === 'formula',
    ).length,
  };
};

type EmptyPreviewArgs = {
  headersDetected: boolean;
  hasHeadersToggle: boolean;
  mapping: Record<number, PasteMappingSelection>;
  sourceColumns: PasteSourceColumn[];
};
const makeEmptyPreview = ({
  headersDetected,
  hasHeadersToggle,
  mapping,
  sourceColumns,
}: EmptyPreviewArgs): PreviewResult => ({
  preview: {
    totalRows: 0,
    previewRows: [],
    dataRows: [],
    columns: [],
    errors: { date: 0, amount: 0, currency: 0, paid: 0 },
    hasErrors: false,
    rowStyles: [],
    totals: NO_TOTALS,
    formulas: { carried: 0, total: 0 },
    summaries: [],
    extraRowsCount: 0,
    hasHeadersToggle,
    headersDetected,
  },
  mapping,
  sourceColumns,
});

export const buildPastePreview = ({
  rawRows,
  formulas,
  layout,
  useHeaders,
  orderedColumns,
  mappingSelection,
  edits,
  defaults,
}: BuildPastePreviewArgs): PreviewResult => {
  const maps = buildColumnMaps(orderedColumns);
  const headersDetected = detectHeaderRow(rawRows, maps.columnNameToField);
  const hasHeadersToggle = headersDetected || rawRows.length > 1;
  const headerRow = useHeaders ? (rawRows[0] ?? []) : [];
  const bodyRows = useHeaders ? rawRows.slice(1) : rawRows;
  const bodyFormulas = useHeaders ? formulas?.slice(1) : formulas;
  const classification = classifyRows(bodyRows, bodyFormulas);
  const dataRows = bodyRows.filter((_row, index) => classification.kinds[index] === 'data');
  const sourceColumns = buildSourceColumns(headerRow, dataRows);
  const mapping =
    mappingSelection ?? buildAutoMapping({ sourceColumns, maps, useHeaders, defaults });
  // Формулы решаются один раз, на первичном маппинге: дальше пользователь правит сам.
  const carried = mappingSelection
    ? null
    : carryExcelFormulas({
        headerRow,
        bodyRows,
        bodyFormulas,
        bodySheetRows: layout ? layout.sheetRows.slice(useHeaders ? 1 : 0) : undefined,
        originCol: layout?.originCol ?? 0,
        classification,
        mapping,
        columnByKey: maps.columnByKey,
      });
  const mappedColumns = buildMappedColumns({
    sourceColumns,
    mapping,
    columnByKey: maps.columnByKey,
    defaults,
  });

  if (!mappedColumns.length) {
    return makeEmptyPreview({ headersDetected, hasHeadersToggle, mapping, sourceColumns });
  }

  const { dataPayload, rowStyles, previewRows, errors, hasErrors } = buildDataPayload({
    dataRows,
    mappedColumns,
    edits,
  });
  const totalRows = dataPayload.length;
  return {
    preview: {
      totalRows,
      previewRows,
      dataRows: dataPayload,
      columns: mappedColumns,
      errors,
      hasErrors,
      rowStyles,
      totals: mapTotals(classification, mappedColumns),
      formulas: carried?.formulas ?? countFormulas(mappedColumns),
      summaries: carried?.summaries ?? [],
      extraRowsCount: totalRows > 50 ? totalRows - 50 : 0,
      hasHeadersToggle,
      headersDetected,
    },
    mapping,
    sourceColumns,
  };
};
