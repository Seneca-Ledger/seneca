'use client';

import {
  type ColumnVisibilityState,
  type OnChangeFn,
  type ReactTable,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type TableState,
  useTable,
} from '@tanstack/react-table';
import { type GridColumnDef, type GridFeatures, gridFeatures } from './features';

export type DataGridTable<TData extends RowData> = ReactTable<GridFeatures, TData>;

export interface UseDataGridOptions<TData extends RowData> {
  data: readonly TData[];
  columns: readonly GridColumnDef<TData, unknown>[];
  getRowId: (row: TData, index: number) => string;
  /** Controlled slices; each one needs its matching on*Change handler. */
  state?: Partial<Pick<TableState<GridFeatures>, 'sorting' | 'rowSelection' | 'columnVisibility'>>;
  initialState?: Partial<TableState<GridFeatures>>;
  onSortingChange?: OnChangeFn<SortingState>;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onColumnVisibilityChange?: OnChangeFn<ColumnVisibilityState>;
  /** True when the server sorts: the grid only reports the requested order. */
  manualSorting?: boolean;
  enableRowSelection?: boolean;
  enableSortingRemoval?: boolean;
}

/**
 * Thin wrapper over `useTable` bound to the shared feature registry. Consumers
 * never destructure instance methods off the result: v9 methods are not bound.
 */
export function useDataGrid<TData extends RowData>(
  options: UseDataGridOptions<TData>,
): DataGridTable<TData> {
  const {
    data,
    columns,
    getRowId,
    state,
    initialState,
    onSortingChange,
    onRowSelectionChange,
    onColumnVisibilityChange,
    manualSorting = false,
    enableRowSelection = false,
    enableSortingRemoval = true,
  } = options;

  // Keys must not be passed as `undefined`: v9 merges options with a spread,
  // so an explicit undefined would wipe the feature's default handler.
  const controlled = {
    ...(state ? { state } : {}),
    ...(initialState ? { initialState } : {}),
    ...(onSortingChange ? { onSortingChange } : {}),
    ...(onRowSelectionChange ? { onRowSelectionChange } : {}),
    ...(onColumnVisibilityChange ? { onColumnVisibilityChange } : {}),
  };

  return useTable<GridFeatures, TData>({
    features: gridFeatures,
    data,
    columns,
    getRowId,
    manualSorting,
    enableRowSelection,
    enableSortingRemoval,
    enableRowRangeSelection: false,
    ...controlled,
  });
}
