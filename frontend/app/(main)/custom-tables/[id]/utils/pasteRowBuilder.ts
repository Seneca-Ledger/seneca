import { parseCurrencyCell, parseDateCell, parseNumberCell, parsePaidCell } from './pasteParser';
import type {
  PasteColumnMapping,
  PasteErrorKey,
  PastePreviewCell,
  PasteRowStyles,
} from './pasteTypes';
import type { CustomTableCellValue, CustomTableRowPatch } from './types';

// ---------------------------------------------------------------------------
// Row data builder
// ---------------------------------------------------------------------------

export type ParsedRowResult = {
  rowData: CustomTableRowPatch;
  cells: PastePreviewCell[];
  errors: Record<PasteErrorKey, number>;
  hasError: boolean;
  /** Ячейки, оставленные текстом, — чтобы подсветить их после вставки. */
  styles: PasteRowStyles | null;
};

type CellParseResult = {
  parsedValue: CustomTableCellValue;
  errorFlag: boolean;
  errorKey: PasteErrorKey | null;
};

const parseDateField = (v: string): CellParseResult => {
  const r = parseDateCell(v);
  return { parsedValue: r.value, errorFlag: r.error, errorKey: 'date' };
};
const parseAmountField = (v: string): CellParseResult => {
  const r = parseNumberCell(v);
  return { parsedValue: r.value, errorFlag: r.error, errorKey: 'amount' };
};
const parseCurrencyField = (v: string, options?: string[]): CellParseResult => {
  const r = parseCurrencyCell(v, options);
  return { parsedValue: r.value, errorFlag: r.error, errorKey: 'currency' };
};
const parsePaidField = (v: string): CellParseResult => {
  const r = parsePaidCell(v);
  return { parsedValue: r.value, errorFlag: r.error, errorKey: 'paid' };
};

const parseCellByField = (col: PasteColumnMapping, editedValue: string): CellParseResult => {
  if (col.field === 'date') {
    return parseDateField(editedValue);
  }
  if (col.field === 'amount') {
    return parseAmountField(editedValue);
  }
  if (col.field === 'currency') {
    return parseCurrencyField(editedValue, col.options);
  }
  if (col.field === 'paid') {
    return parsePaidField(editedValue);
  }
  const trimmed = editedValue.trim();
  return { parsedValue: trimmed || null, errorFlag: false, errorKey: null };
};

type GetEditedArgs = {
  row: string[];
  sourceIndex: number | null;
  key: string;
  edits: Record<string, string>;
};

const getEditedValue = ({ row, sourceIndex, key, edits }: GetEditedArgs): string => {
  const rawValue =
    sourceIndex !== null && row[sourceIndex] !== undefined ? String(row[sourceIndex]) : '';
  return sourceIndex !== null && edits[key] !== undefined ? edits[key] : rawValue;
};

type RowAcc = {
  rowData: CustomTableRowPatch;
  cells: PastePreviewCell[];
  errors: Record<PasteErrorKey, number>;
  hasError: boolean;
  styles: PasteRowStyles | null;
};

const processColumn = (col: PasteColumnMapping, editedValue: string, acc: RowAcc): void => {
  const isFormula = col.mode === 'new' && col.newType === 'formula';
  const parsed = parseCellByField(col, editedValue);
  const { parsedValue } = parsed;
  const errorFlag = isFormula ? false : parsed.errorFlag;
  const errorKey = isFormula ? null : parsed.errorKey;
  if (errorFlag && errorKey) {
    acc.errors[errorKey] += 1;
  }
  if (errorFlag) {
    acc.hasError = true;
  }
  acc.cells.push({ value: editedValue.trim(), error: errorFlag, sourceIndex: col.sourceIndex });
  if (!col.columnKey || (col.mode === 'new' && col.newType === 'formula')) {
    // Формульная колонка считается сервером: значение из файла только показывается.
    return;
  }
  if (errorFlag) {
    // Нераспознанная ячейка не должна ронять импорт: пусть войдёт как текст и подсветится.
    acc.rowData[col.columnKey] = editedValue.trim() || null;
    acc.styles = { ...(acc.styles ?? {}), [col.columnKey]: { importIssue: true } };
    return;
  }
  acc.rowData[col.columnKey] = parsedValue;
};

export type BuildRowArgs = {
  row: string[];
  rowIndex: number;
  mappedColumns: PasteColumnMapping[];
  edits: Record<string, string>;
};

export const buildRowData = ({
  row,
  rowIndex,
  mappedColumns,
  edits,
}: BuildRowArgs): ParsedRowResult => {
  const acc: RowAcc = {
    rowData: {},
    cells: [],
    errors: { date: 0, amount: 0, currency: 0, paid: 0 },
    hasError: false,
    styles: null,
  };
  for (const col of mappedColumns) {
    const { sourceIndex } = col;
    const key = sourceIndex !== null ? `${rowIndex}:${sourceIndex}` : '';
    const editedValue = getEditedValue({ row, sourceIndex, key, edits });
    processColumn(col, editedValue, acc);
  }
  return acc;
};
