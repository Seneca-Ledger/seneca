export type ColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'currency'
  | 'formula'
  | 'relation'
  | 'ai';

export type CustomTableCellValue = string | number | boolean | string[] | null;
export type CustomTableRowPatch = Record<string, CustomTableCellValue>;

/** Select option: the cell stores `value`; label and colour are display-only. */
export interface SelectOptionDef {
  value: string;
  label?: string;
  /** #rrggbb — chip background at low alpha, text in the colour itself. */
  color?: string;
}

export interface CustomTableColumnConfig {
  options?: Array<string | SelectOptionDef>;
  /** ISO 4217 code for currency columns. */
  currency?: string;
  precision?: number;
  format?: 'plain' | 'percent';
  /** Formula expression, e.g. "[a] * [b]". */
  expression?: string;
  /** What a formula yields; the server infers it from the expression. */
  resultType?: 'number' | 'text' | 'boolean' | 'date';
  targetTableId?: string;
  displayColumnKey?: string;
  /** Model instruction for ai columns. */
  prompt?: string;
  [key: string]: unknown;
}

export interface CustomTableColumn {
  id: string;
  key: string;
  title: string;
  type: ColumnType;
  position: number;
  config: CustomTableColumnConfig | null;
  isRequired?: boolean;
  isUnique?: boolean;
  width?: number;
}

export interface CustomTableGridRow {
  id: string;
  rowNumber: number;
  data: CustomTableRowPatch;
  /** Per-column cell styles from the server; `importIssue` marks cells an import kept as text. */
  styles?: Record<string, { importIssue?: boolean } & Record<string, unknown>>;
  /** Labels of linked rows, resolved by the server for relation columns. */
  relationLabels?: Record<string, string>;
}

export type RowFilterOp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'startsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'search';

export type RowFilter = { col: string; op: RowFilterOp; value?: unknown };

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const AGGREGATE_FNS = ['sum', 'avg', 'min', 'max', 'count'] as const;
export type AggregateFn = (typeof AGGREGATE_FNS)[number];
