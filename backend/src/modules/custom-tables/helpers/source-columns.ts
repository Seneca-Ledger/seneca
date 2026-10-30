import { randomUUID } from 'node:crypto';
import type { CustomTable, CustomTableSourceBinding } from '../../../entities/custom-table.entity';
import type { CustomTableColumn } from '../../../entities/custom-table-column.entity';
import type { SourceAdapter, SourceColumnDef } from '../sources/source.types';

type ColumnSourceConfig = {
  kind?: string;
  field?: string;
  name?: string;
  colIndex?: number;
};

/** Where a column's values come from (`config.source`), or null for a plain column. */
export function columnSourceConfig(
  config: CustomTableColumn['config'] | null | undefined,
): ColumnSourceConfig | null {
  if (!config || typeof config !== 'object') {
    return null;
  }
  const source = (config as { source?: unknown }).source;
  return typeof source === 'object' && source !== null ? (source as ColumnSourceConfig) : null;
}

export function generateColumnKey(): string {
  const raw = randomUUID().replace(/-/g, '');
  return `col_${raw.slice(0, 12)}`;
}

/** A source column's config: the field it shows, plus money precision and currency. */
export function sourceColumnConfig(def: SourceColumnDef, currency: string | undefined) {
  return {
    ...(def.config ?? {}),
    ...(def.money ? { precision: 2, ...(currency ? { currency } : {}) } : {}),
    source: { kind: 'app_field', field: def.field },
  };
}

/** The fields a source gives a table a column for. */
export function sourceFields(adapter: SourceAdapter): string[] {
  return adapter.columns.map(def => def.field);
}

/** The binding of a table just made from a source. */
export function sourceBindingOf(
  adapter: SourceAdapter,
  filters: CustomTableSourceBinding['filters'],
): CustomTableSourceBinding {
  return { kind: adapter.kind, filters, syncedAt: null, fields: sourceFields(adapter) };
}

/**
 * The columns a bound table lacks for fields its source gained since the
 * table was made (Tags on a transactions table), appended after the others
 * with the default title. Fields the table already had a column for are
 * skipped even when the column is gone: the user deleted it. A table made
 * before `fields` was recorded counts the fields it has columns for, and one
 * with none gets nothing (refresh then refuses it as before).
 */
export function newSourceColumns(
  table: CustomTable,
  adapter: SourceAdapter,
): Array<Partial<CustomTableColumn>> {
  const existing = table.columns ?? [];
  const bound = existing
    .map(column => columnSourceConfig(column.config))
    .filter(source => source?.kind === 'app_field' && source.field)
    .map(source => String(source?.field));
  if (!bound.length) {
    return [];
  }
  const known = new Set([...(table.sourceBinding?.fields ?? []), ...bound]);
  const added = adapter.columns.filter(def => !known.has(def.field));
  const currency = existing
    .map(column => (column.config as { currency?: unknown } | null)?.currency)
    .find((value): value is string => typeof value === 'string' && value.length === 3);
  let position = Math.max(-1, ...existing.map(column => column.position ?? 0)) + 1;
  return added.map(def => ({
    tableId: table.id,
    key: generateColumnKey(),
    title: def.title.slice(0, 120),
    type: def.type,
    isRequired: false,
    isUnique: false,
    position: position++,
    config: sourceColumnConfig(def, currency),
  }));
}
