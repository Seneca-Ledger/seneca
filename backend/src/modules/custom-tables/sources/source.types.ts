import type { CustomTableColumnType } from '../../../entities/custom-table-column.entity';

export const CUSTOM_TABLE_SOURCE_KINDS = [
  'transactions',
  'subscriptions',
  'payables',
  'invoices',
  'budgets',
] as const;

export type CustomTableSourceKind = (typeof CUSTOM_TABLE_SOURCE_KINDS)[number];

export type SourceValue = string | number | boolean | null;

/** One table column derived from a source record field. */
export interface SourceColumnDef {
  field: string;
  /** English fallback; the client sends translated titles. */
  title: string;
  type: CustomTableColumnType;
  config?: Record<string, unknown>;
  /** Money column: gets the workspace currency code on creation. */
  money?: boolean;
}

export interface SourceRow {
  /** Id of the source record; stored on the row so a refresh can find it again. */
  sourceKey: string;
  values: Record<string, SourceValue>;
}

/** Every adapter reads only the filters it knows; the rest are ignored. */
export interface SourceFilters {
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string[];
  type?: string;
  currency?: string;
  statementIds?: string[];
  status?: string;
  direction?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  /** Only these records (by id); used to open a fresh import as a table. */
  ids?: string[];
}

export interface SourceAdapter {
  readonly kind: CustomTableSourceKind;
  readonly columns: SourceColumnDef[];
  fetchRows(workspaceId: string, filters: SourceFilters): Promise<SourceRow[]>;
}
