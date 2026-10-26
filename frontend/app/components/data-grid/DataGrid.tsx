'use client';

import type { Cell, Header, Row, RowData } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import type { GridColumnMeta, GridFeatures } from './features';
import type { DataGridTable } from './use-data-grid';

type GridRow<TData extends RowData> = Row<GridFeatures, TData>;
type GridCell<TData extends RowData> = Cell<GridFeatures, TData, unknown>;
type GridHeader<TData extends RowData> = Header<GridFeatures, TData, unknown>;

export interface DataGridVirtualization {
  /** Fixed row height in px; the body reserves space for off-screen rows. */
  rowHeight: number;
  overscan?: number;
}

export interface DataGridProps<TData extends RowData> {
  table: DataGridTable<TData>;
  /** Screen-reader caption; the visible title lives outside the grid. */
  caption: string;
  loading?: boolean;
  /**
   * While the first page loads (loading, no rows yet), draw this many
   * placeholder rows instead of the spinner. Unset keeps the spinner.
   */
  skeletonRows?: number;
  /** Rendered inside the body when there are no rows and nothing is loading. */
  emptyState?: ReactNode;
  /** Height cap that turns the wrapper into the scroll container. */
  maxHeight?: number | string;
  virtualization?: DataGridVirtualization;
  /** Called when the last rows scroll into view — hook for "load more". */
  onEndReached?: () => void;
  onRowClick?: (row: GridRow<TData>) => void;
  rowClassName?: (row: GridRow<TData>) => string | undefined;
  /** Adds a footer row when set; cells come from `columnDef.footer`. */
  showFooter?: boolean;
  /** Rows rendered before the footer, e.g. a "draft" or "add row" line. */
  trailing?: ReactNode;
  className?: string;
}

const alignClass = (meta: GridColumnMeta | undefined): string =>
  meta?.align ? ` seneca-grid__cell--${meta.align}` : '';

const cellClass = (base: string, meta: GridColumnMeta | undefined): string =>
  `${base}${alignClass(meta)}${meta?.className ? ` ${meta.className}` : ''}`;

const cellStyle = (size: number): CSSProperties => ({ width: size, minWidth: size });

const ariaSort = (dir: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' =>
  dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none';

function HeaderCell<TData extends RowData>({
  header,
  table,
}: {
  header: GridHeader<TData>;
  table: DataGridTable<TData>;
}) {
  const meta = header.column.columnDef.meta;
  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();
  const content = header.isPlaceholder ? null : <table.FlexRender header={header} />;
  return (
    <th
      scope="col"
      className={cellClass('seneca-grid__th', meta)}
      style={cellStyle(header.getSize())}
      aria-sort={canSort ? ariaSort(sorted) : undefined}
    >
      <span className="seneca-grid__th-inner">
        {canSort ? (
          <button
            type="button"
            className={`seneca-grid__sort${sorted ? ' seneca-grid__sort--active' : ''}`}
            onClick={header.column.getToggleSortingHandler()}
          >
            <span className="seneca-grid__sort-label">{content}</span>
            {sorted === 'desc' ? (
              <ArrowDown className="seneca-grid__sort-icon" aria-hidden />
            ) : (
              <ArrowUp
                className={`seneca-grid__sort-icon${sorted ? '' : ' seneca-grid__sort-icon--idle'}`}
                aria-hidden
              />
            )}
          </button>
        ) : (
          content
        )}
        {meta?.headerActions}
      </span>
    </th>
  );
}

function BodyCell<TData extends RowData>({
  cell,
  table,
}: {
  cell: GridCell<TData>;
  table: DataGridTable<TData>;
}) {
  const meta = cell.column.columnDef.meta;
  return (
    <td className={cellClass('seneca-grid__td', meta)} style={cellStyle(cell.column.getSize())}>
      <table.FlexRender cell={cell} />
    </td>
  );
}

function BodyRow<TData extends RowData>({
  row,
  table,
  onRowClick,
  rowClassName,
  style,
}: {
  row: GridRow<TData>;
  table: DataGridTable<TData>;
  onRowClick?: (row: GridRow<TData>) => void;
  rowClassName?: (row: GridRow<TData>) => string | undefined;
  style?: CSSProperties;
}) {
  const selected = row.getIsSelected();
  const extra = rowClassName?.(row);
  const className = `seneca-grid__tr${selected ? ' seneca-grid__tr--selected' : ''}${
    onRowClick ? ' seneca-grid__tr--clickable' : ''
  }${extra ? ` ${extra}` : ''}`;
  return (
    <tr
      className={className}
      style={style}
      aria-selected={selected || undefined}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      {row.getVisibleCells().map(cell => (
        <BodyCell key={cell.id} cell={cell} table={table} />
      ))}
    </tr>
  );
}

/**
 * The first page loads as placeholder rows when the caller knows how many to
 * draw; "load more" and callers without a count keep the spinner.
 */
const loadingIndicator = (
  loading: boolean,
  rowCount: number,
  skeletonRows: number | undefined,
): { skeletonRows: number; spinner: boolean } => {
  const skeleton = loading && rowCount === 0 ? (skeletonRows ?? 0) : 0;
  return { skeletonRows: skeleton, spinner: loading && skeleton === 0 };
};

function SkeletonRows({
  count,
  columns,
  rowHeight,
}: {
  count: number;
  columns: number;
  rowHeight: number | undefined;
}) {
  return Array.from({ length: count }, (_, rowIndex) => (
    <tr
      // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
      key={rowIndex}
      aria-hidden
      className="seneca-grid__tr seneca-grid__skeleton-row"
      style={rowHeight ? { height: rowHeight } : undefined}
    >
      {Array.from({ length: columns }, (_, cellIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
        <td key={cellIndex} className="seneca-grid__td">
          <span className="seneca-grid__skeleton" />
        </td>
      ))}
    </tr>
  ));
}

/**
 * A whole grid drawn as placeholders, for when even the columns are not known
 * yet (the page is still fetching the table's definition).
 */
export function DataGridSkeleton({
  rows,
  columns,
  rowHeight,
  className,
}: {
  rows: number;
  columns: number;
  rowHeight?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`seneca-grid${className ? ` ${className}` : ''}`} aria-hidden>
      <div className="seneca-grid__scroll">
        <table className="seneca-grid__table" style={{ width: '100%' }}>
          <thead className="seneca-grid__thead">
            <tr>
              {Array.from({ length: columns }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
                <th key={index} className="seneca-grid__th">
                  <span className="seneca-grid__skeleton" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="seneca-grid__tbody">
            <SkeletonRows count={rows} columns={columns} rowHeight={rowHeight} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SpacerRow({ height, colSpan }: { height: number; colSpan: number }) {
  return height > 0 ? (
    <tr aria-hidden className="seneca-grid__spacer">
      <td colSpan={colSpan} style={{ height, padding: 0, border: 0 }} />
    </tr>
  ) : null;
}

function useEndReached(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  onEndReached: (() => void) | undefined,
) {
  useEffect(() => {
    const node = scrollRef.current;
    if (!(node && onEndReached)) {
      return;
    }
    const handler = () => {
      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 120) {
        onEndReached();
      }
    };
    node.addEventListener('scroll', handler, { passive: true });
    return () => node.removeEventListener('scroll', handler);
  }, [scrollRef, onEndReached]);
}

function GridFooter<TData extends RowData>({ table }: { table: DataGridTable<TData> }) {
  return (
    <tfoot className="seneca-grid__tfoot">
      {table.getFooterGroups().map(group => (
        <tr key={group.id} className="seneca-grid__tr">
          {group.headers.map(header => (
            <td
              key={header.id}
              className={cellClass('seneca-grid__tf', header.column.columnDef.meta)}
              style={cellStyle(header.getSize())}
            >
              {header.isPlaceholder ? null : <table.FlexRender footer={header} />}
            </td>
          ))}
        </tr>
      ))}
    </tfoot>
  );
}

/**
 * Semantic, headless-styled table for TanStack Table v9. State lives in the
 * table instance; this component only renders what the instance says.
 */
export function DataGrid<TData extends RowData>({
  table,
  caption,
  loading = false,
  skeletonRows,
  emptyState,
  maxHeight,
  virtualization,
  onEndReached,
  onRowClick,
  rowClassName,
  showFooter = false,
  trailing,
  className,
}: DataGridProps<TData>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rows = table.getRowModel().rows;
  const colSpan = Math.max(table.getVisibleLeafColumns().length, 1);
  const virtualizer = useVirtualizer({
    count: virtualization ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => virtualization?.rowHeight ?? 44,
    overscan: virtualization?.overscan ?? 8,
  });
  useEndReached(scrollRef, onEndReached);

  const items = virtualization ? virtualizer.getVirtualItems() : null;
  const first = items?.[0];
  const last = items?.at(-1);
  const topGap = first ? first.start : 0;
  const bottomGap = last ? virtualizer.getTotalSize() - last.end : 0;
  const visibleRows = items ? items.map(item => rows[item.index]) : rows;
  const isEmpty = !loading && rows.length === 0;
  const indicator = loadingIndicator(loading, rows.length, skeletonRows);

  return (
    <div className={`seneca-grid${className ? ` ${className}` : ''}`}>
      <div
        className="seneca-grid__scroll"
        ref={scrollRef}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="seneca-grid__table" style={{ width: table.getTotalSize() }}>
          <caption className="seneca-grid__caption">{caption}</caption>
          <thead className="seneca-grid__thead">
            {table.getHeaderGroups().map(group => (
              <tr key={group.id}>
                {group.headers.map(header => (
                  <HeaderCell key={header.id} header={header} table={table} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="seneca-grid__tbody" aria-busy={loading || undefined}>
            <SpacerRow height={topGap} colSpan={colSpan} />
            {visibleRows.map(row =>
              row ? (
                <BodyRow
                  key={row.id}
                  row={row}
                  table={table}
                  onRowClick={onRowClick}
                  rowClassName={rowClassName}
                  style={virtualization ? { height: virtualization.rowHeight } : undefined}
                />
              ) : null,
            )}
            <SpacerRow height={bottomGap} colSpan={colSpan} />
            <SkeletonRows
              count={indicator.skeletonRows}
              columns={colSpan}
              rowHeight={virtualization?.rowHeight}
            />
            {trailing}
            {isEmpty && emptyState ? (
              <tr className="seneca-grid__empty-row">
                <td colSpan={colSpan} className="seneca-grid__empty">
                  {emptyState}
                </td>
              </tr>
            ) : null}
            {indicator.spinner ? (
              <tr className="seneca-grid__loading-row">
                <td colSpan={colSpan} className="seneca-grid__loading">
                  <Spinner size={20} />
                </td>
              </tr>
            ) : null}
          </tbody>
          {showFooter ? <GridFooter table={table} /> : null}
        </table>
      </div>
    </div>
  );
}
