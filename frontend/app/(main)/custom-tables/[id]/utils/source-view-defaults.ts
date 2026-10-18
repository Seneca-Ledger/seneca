import type { SortingState } from '@tanstack/react-table';
import type { CustomTableColumn, CustomTableGridRow } from './types';

/** Columns a table filled from Lumio carries for completeness, not for reading. */
const SECONDARY_SOURCE_FIELDS = new Set(['type', 'statement']);

const sourceField = (column: CustomTableColumn): unknown =>
  (column.config?.source as { field?: unknown } | undefined)?.field;

/**
 * How a table filled from Lumio opens until the user changes it: newest first,
 * and without the columns that only repeat what the row already says. The type
 * repeats the amount's sign (and drifts from it once either is edited), the
 * statement is a long file name, the currency is the same on every row.
 */
export function sourceViewDefaults(
  columns: CustomTableColumn[],
  rows: CustomTableGridRow[],
  /** Treat "no rows yet" as one currency, so the column is hidden from the first paint. */
  options: { assumeSingle?: boolean } = {},
): { sorting: SortingState; hidden: string[] } {
  const date = columns.find(column => sourceField(column) === 'date');
  const currency = columns.find(column => sourceField(column) === 'currency');
  const currencies = currency
    ? new Set(
        rows.map(row => row.data?.[currency.key]).filter(value => value !== null && value !== ''),
      )
    : new Set();
  return {
    sorting: date ? [{ id: date.key, desc: true }] : [],
    hidden: [
      ...columns.filter(column => SECONDARY_SOURCE_FIELDS.has(String(sourceField(column)))),
      ...(currency && (rows.length > 0 || options.assumeSingle) && currencies.size <= 1
        ? [currency]
        : []),
    ].map(column => column.key),
  };
}
