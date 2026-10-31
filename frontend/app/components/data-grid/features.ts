import {
  type ColumnDef,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  metaHelper,
  type RowData,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table';
import type { ReactNode } from 'react';

export type GridAlign = 'start' | 'center' | 'end';

/**
 * How a cell looks while the grid loads: a text line (the default), a round
 * mark (icon, avatar), a rounded block (chip, button) or nothing.
 */
export interface GridSkeletonCell {
  shape: 'text' | 'circle' | 'rounded' | 'none';
  /** Text: the longest line. Rounded: the block's width. */
  width?: number;
  /** Circle: its diameter. Rounded: the block's height. */
  height?: number;
  /** Rounded: the real element's radius. */
  radius?: string;
  /** Text: a round mark of this size before the line (a category icon). */
  icon?: number;
}

/** Per-column presentation hints read by DataGrid when rendering th/td. */
export interface GridColumnMeta {
  align?: GridAlign;
  /** Extra class on both th and td, e.g. for monospace numbers. */
  className?: string;
  /** Header label for the column-visibility menu when `header` is a component. */
  label?: string;
  /** Extra header controls rendered next to (not inside) the sort button. */
  headerActions?: ReactNode;
  /** The placeholder in this column's cells while the first rows load. */
  skeleton?: GridSkeletonCell;
}

/**
 * The one feature registry every grid in the app shares. Keep it small: every
 * feature listed here ships to the client for all consumers.
 */
export const gridFeatures = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: metaHelper<GridColumnMeta>(),
});

export type GridFeatures = typeof gridFeatures;

export type GridColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  GridFeatures,
  TData,
  TValue
>;

export const createGridColumnHelper = <TData extends RowData>() =>
  createColumnHelper<GridFeatures, TData>();
