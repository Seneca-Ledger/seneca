import type { TotalsAggregate } from './importRows';
import type { ColumnType, CustomTableColumnConfig } from './types';

/** Формула Excel из файла и что с ней стало: перенесена в колонку или нет, и почему. */
export type ImportedFormula = {
  excel: string;
  expression?: string;
  reason?: string;
  /** Ячейки с обычным значением вместо формулы: после импорта будут пересчитаны. */
  overriddenCells: number;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PasteFieldKey = 'date' | 'type' | 'amount' | 'currency' | 'comment' | 'paid';

export type PasteErrorKey = 'date' | 'amount' | 'currency' | 'paid';

export type PasteColumnMapping = {
  sourceIndex: number | null;
  field: PasteFieldKey;
  columnKey: string | null;
  label: string;
  options?: string[];
  mode: 'existing' | 'new';
  newTitle?: string;
  newType?: ColumnType;
  /** Настройки новой колонки, угаданные по значениям: валюта, процент, варианты select. */
  newConfig?: CustomTableColumnConfig;
  formula?: ImportedFormula;
};

export type PasteSourceColumn = {
  index: number;
  header: string;
  sampleValues: string[];
};

export type PasteMappingSelection = {
  mode: 'ignore' | 'existing' | 'new';
  columnKey?: string;
  field?: PasteFieldKey | null;
  newTitle?: string;
  newType?: ColumnType;
  newConfig?: CustomTableColumnConfig;
  formula?: ImportedFormula;
};

export type PastePreviewCell = {
  value: string;
  /** Не разобралась по типу колонки: попадёт в таблицу текстом и будет подсвечена. */
  error: boolean;
  sourceIndex: number | null;
};

/** Стили строки для ячеек, оставленных текстом; ключ — ключ колонки. */
export type PasteRowStyles = Record<string, { importIssue: true }>;

export type PasteTotals = {
  /** Сколько итоговых строк исключено из данных. */
  excludedRows: number;
  /** Агрегат футера по ключу колонки (для новых — placeholder-ключ). */
  aggregates: Record<string, TotalsAggregate>;
};

export type PastePreviewRow = {
  id: number;
  rowIndex: number;
  cells: PastePreviewCell[];
};

export type PastePreviewData = {
  totalRows: number;
  previewRows: PastePreviewRow[];
  dataRows: import('./types').CustomTableRowPatch[];
  columns: PasteColumnMapping[];
  errors: Record<PasteErrorKey, number>;
  /** Есть ячейки, которые уйдут текстом; импорт это не блокирует. */
  hasErrors: boolean;
  /** Стили по строкам, параллельно dataRows; null — без замечаний. */
  rowStyles: Array<PasteRowStyles | null>;
  totals: PasteTotals;
  /** Формулы файла: сколько перенесено из скольких найденных. */
  formulas: { carried: number; total: number };
  /** Формулы строки «Итого», ставшие сводками под таблицей. */
  summaries: Array<{ title: string; expression: string }>;
  extraRowsCount: number;
  hasHeadersToggle: boolean;
  headersDetected: boolean;
};

/** Minimal column shape required by paste helpers. */
export interface PasteColumn {
  key: string;
  title?: string | null;
  type?: ColumnType | string | null;
  config?: CustomTableColumnConfig | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PASTE_FIELD_ALIASES: Record<PasteFieldKey, string[]> = {
  date: ['date', 'дата', 'день', 'day', 'dt', 'дт'],
  type: ['type', 'тип', 'category', 'категория', 'вид', 'account', 'операция'],
  amount: ['amount', 'sum', 'сумма', 'итого', 'total', 'value', 'стоимость'],
  currency: ['currency', 'валюта', 'curr', 'вал', 'code'],
  comment: ['comment', 'комментар', 'note', 'memo', 'описан', 'details', 'description'],
  paid: ['paid', 'оплач', 'оплата', 'неоплач', 'payment', 'status'],
};
