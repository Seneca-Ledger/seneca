'use client';

import { format } from 'date-fns';

/** Расширения, которые умеет разобрать readTabularWorkbook. */
export const TABULAR_FILE_ACCEPT = '.csv,.tsv,.xlsx,.xls';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export class TabularFileError extends Error {
  constructor(
    message: string,
    readonly reason: 'too-large' | 'unsupported' | 'empty' | 'unreadable',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'TabularFileError';
  }
}

/**
 * Ровно то, что нужно для чтения: настоящий File этому удовлетворяет.
 * Узкий тип заодно позволяет тестам не поднимать весь File API.
 */
export interface ReadableTabularFile {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export type TabularCellKind = 'empty' | 'text' | 'number' | 'date' | 'boolean' | 'error';

/**
 * Ячейка с тем, что знает о ней сама таблица: формулой и числовым форматом.
 * Текст — отформатированное значение, как его видит человек в Excel, поэтому
 * «12%» и «$1,234.50» доходят до определения типов вместе с символами.
 */
export interface TabularCell {
  text: string;
  kind: TabularCellKind;
  formula?: string;
  numFmt?: string;
}

export interface TabularSheet {
  name: string;
  rows: TabularCell[][];
  /** Where the used range starts in the sheet (0-based), so A1 references can be mapped. */
  originCol: number;
  /** 0-based sheet row of every entry in `rows`: blank rows are dropped, numbers are not. */
  sheetRows: number[];
}

/** Sheet geometry the Excel formula translator needs, aligned with the text matrix. */
export interface SheetLayout {
  originCol: number;
  sheetRows: number[];
}

export interface TabularWorkbook {
  sheets: TabularSheet[];
}

type SheetJsCell = {
  t?: string;
  v?: unknown;
  w?: string;
  f?: string;
  z?: unknown;
};

const EMPTY_CELL: TabularCell = { text: '', kind: 'empty' };

function isSupported(fileName: string): boolean {
  return /\.(csv|tsv|xlsx|xls)$/i.test(fileName);
}

const isTextFormat = (fileName: string): boolean => /\.(csv|tsv)$/i.test(fileName);

/** windows-1251 — обычный подозреваемый, когда банк отдаёт CSV не в UTF-8. */
function decodeText(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('�')) {
    return utf8;
  }
  try {
    return new TextDecoder('windows-1251').decode(buffer);
  } catch {
    return utf8;
  }
}

function cellKind(cell: SheetJsCell, text: string): TabularCellKind {
  if (cell.t === 'n') {
    return cell.v instanceof Date ? 'date' : 'number';
  }
  if (cell.t === 'd') {
    return 'date';
  }
  if (cell.t === 'b') {
    return 'boolean';
  }
  if (cell.t === 'e') {
    return 'error';
  }
  return text ? 'text' : 'empty';
}

function cellText(cell: SheetJsCell): string {
  if (cell.v instanceof Date) {
    // ISO вместо локального "1/15/26": наш парсер дат не гадает, где день, а где месяц.
    return Number.isNaN(cell.v.getTime()) ? '' : format(cell.v, 'yyyy-MM-dd');
  }
  if (typeof cell.w === 'string' && cell.w.trim()) {
    return cell.w.trim();
  }
  return cell.v === null || cell.v === undefined ? '' : String(cell.v).trim();
}

function toCell(cell: SheetJsCell | undefined): TabularCell {
  if (!cell || cell.t === 'z') {
    return EMPTY_CELL;
  }
  const text = cellText(cell);
  const kind = cellKind(cell, text);
  if (kind === 'empty') {
    return EMPTY_CELL;
  }
  return {
    text,
    kind,
    ...(typeof cell.f === 'string' && cell.f ? { formula: cell.f } : {}),
    ...(typeof cell.z === 'string' && cell.z ? { numFmt: cell.z } : {}),
  };
}

const isEmptyRow = (row: TabularCell[]): boolean => row.every(cell => cell.kind === 'empty');

type SheetJsUtils = {
  decode_range: (ref: string) => { s: { r: number; c: number }; e: { r: number; c: number } };
  encode_cell: (address: { r: number; c: number }) => string;
};

function readSheet(
  utils: SheetJsUtils,
  name: string,
  sheet: Record<string, unknown> & { '!ref'?: string },
): TabularSheet {
  const ref = sheet['!ref'];
  if (!ref) {
    return { name, rows: [], originCol: 0, sheetRows: [] };
  }
  const range = utils.decode_range(ref);
  const rows: TabularCell[][] = [];
  const sheetRows: number[] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: TabularCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      row.push(toCell(sheet[utils.encode_cell({ r, c })] as SheetJsCell | undefined));
    }
    if (!isEmptyRow(row)) {
      // Полностью пустые строки только мешают предпросмотру и определению итогов.
      rows.push(row);
      sheetRows.push(r);
    }
  }
  return { name, rows, originCol: range.s.c, sheetRows };
}

/** Читает все вкладки; у каждой ячейки — текст, тип, формула и числовой формат. */
export async function readTabularWorkbook(file: ReadableTabularFile): Promise<TabularWorkbook> {
  if (!isSupported(file.name)) {
    throw new TabularFileError('File format is not supported', 'unsupported');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new TabularFileError('File is too large', 'too-large');
  }

  let sheets: TabularSheet[];
  try {
    const xlsx = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = isTextFormat(file.name)
      ? // raw: текст CSV остаётся текстом, дальше его разбирает наш парсер.
        xlsx.read(decodeText(buffer), { type: 'string', raw: true })
      : xlsx.read(buffer, { type: 'array', cellDates: true, cellFormula: true, cellNF: true });
    sheets = workbook.SheetNames.map(name =>
      readSheet(
        xlsx.utils as unknown as SheetJsUtils,
        name,
        workbook.Sheets[name] as Record<string, unknown> & { '!ref'?: string },
      ),
    );
  } catch (error) {
    if (error instanceof TabularFileError) {
      throw error;
    }
    // cause сохраняем: без неё причина сбоя парсера теряется навсегда.
    throw new TabularFileError('Could not read the file', 'unreadable', { cause: error });
  }

  const usable = sheets.filter(sheet => sheet.rows.length);
  if (!usable.length) {
    throw new TabularFileError('The file contains no data', 'empty');
  }
  return { sheets: usable };
}

/** Вкладка с наибольшим числом строк — почти всегда та, ради которой файл открыли. */
export function pickDefaultSheet(workbook: TabularWorkbook): number {
  let best = 0;
  workbook.sheets.forEach((sheet, index) => {
    if (sheet.rows.length > workbook.sheets[best].rows.length) {
      best = index;
    }
  });
  return best;
}

export const sheetToTextRows = (sheet: TabularSheet): string[][] =>
  sheet.rows.map(row => row.map(cell => cell.text));

export const sheetToLayout = (sheet: TabularSheet): SheetLayout => ({
  originCol: sheet.originCol,
  sheetRows: sheet.sheetRows,
});

/** Формулы ячеек той же формы, что и матрица текста; undefined там, где формулы нет. */
export const sheetToFormulaRows = (sheet: TabularSheet): (string | undefined)[][] =>
  sheet.rows.map(row => row.map(cell => cell.formula));

/**
 * Приводит файл к матрице строк, как при вставке из буфера: первая
 * содержательная вкладка, только текст.
 */
export async function readTabularFile(file: ReadableTabularFile): Promise<string[][]> {
  const workbook = await readTabularWorkbook(file);
  return sheetToTextRows(workbook.sheets[pickDefaultSheet(workbook)]);
}
