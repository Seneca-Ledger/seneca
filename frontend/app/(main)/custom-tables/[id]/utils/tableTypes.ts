import type { AggregateFn, CustomTableColumn } from './types';

export interface CustomTablePageColumn extends CustomTableColumn {
  isRequired: boolean;
  isUnique: boolean;
}

export interface CustomTableViewColumnSettings {
  width?: number;
  aggregate?: AggregateFn;
}

export interface CustomTableViewSettings {
  columns?: Record<string, CustomTableViewColumnSettings>;
  [key: string]: unknown;
}

export interface CustomTableCategory {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface CustomTable {
  id: string;
  name: string;
  description: string | null;
  source: string;
  /** Set when the table was filled from app data and can be refreshed. */
  sourceBinding?: {
    kind: string;
    filters: Record<string, unknown>;
    syncedAt: string | null;
  } | null;
  categoryId?: string | null;
  category?: CustomTableCategory | null;
  columns: CustomTablePageColumn[];
  viewSettings?: CustomTableViewSettings | null;
}
