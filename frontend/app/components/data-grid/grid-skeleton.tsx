import Skeleton from '@mui/material/Skeleton';
import type { CSSProperties } from 'react';
import type { GridColumnMeta, GridSkeletonCell } from './features';

const alignClass = (meta: GridColumnMeta | undefined): string =>
  meta?.align ? ` seneca-grid__cell--${meta.align}` : '';

export const cellClass = (base: string, meta: GridColumnMeta | undefined): string =>
  `${base}${alignClass(meta)}${meta?.className ? ` ${meta.className}` : ''}`;

export const cellStyle = (size: number): CSSProperties => ({ width: size, minWidth: size });

// Rows differ in length the way real names and amounts do.
const ROW_SHARES = [1, 0.7, 0.85, 0.6, 0.95, 0.75, 0.9, 0.65];

/** What a placeholder column needs: its width and how its cells look. */
export interface SkeletonGridColumn {
  size: number;
  meta?: GridColumnMeta;
}

function Placeholder({
  cell,
  size,
  row,
}: {
  cell: GridSkeletonCell | undefined;
  size: number;
  row: number;
}) {
  const shape = cell?.shape ?? 'text';
  if (shape === 'none') {
    return null;
  }
  if (shape === 'circle') {
    const diameter = cell?.height ?? 20;
    return (
      <Skeleton
        variant="circular"
        width={diameter}
        height={diameter}
        sx={{ display: 'inline-block', verticalAlign: 'middle' }}
      />
    );
  }
  if (shape === 'rounded') {
    return (
      <Skeleton
        variant="rounded"
        width={cell?.width ?? 48}
        height={cell?.height ?? 22}
        sx={{
          display: 'inline-block',
          verticalAlign: 'middle',
          borderRadius: cell?.radius,
        }}
      />
    );
  }
  // A text line: at most 60% of the column, like a name that does not fill it.
  const longest = cell?.width ?? Math.min(160, Math.round(size * 0.6));
  const line = (
    <Skeleton
      variant="text"
      width={Math.round(longest * ROW_SHARES[row % ROW_SHARES.length])}
      sx={{ display: 'inline-block', verticalAlign: 'middle', maxWidth: '100%' }}
    />
  );
  if (!cell?.icon) {
    return line;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: '100%' }}>
      <Skeleton variant="circular" width={cell.icon} height={cell.icon} sx={{ flexShrink: 0 }} />
      {line}
    </span>
  );
}

/** Placeholder rows with the real columns' widths, classes and value shapes. */
export function GridSkeletonRows({
  count,
  columns,
  rowHeight,
}: {
  count: number;
  columns: readonly SkeletonGridColumn[];
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
      {columns.map((column, cellIndex) => (
        <td
          // biome-ignore lint/suspicious/noArrayIndexKey: columns are fixed while loading
          key={cellIndex}
          className={cellClass('seneca-grid__td', column.meta)}
          style={cellStyle(column.size)}
        >
          <Placeholder cell={column.meta?.skeleton} size={column.size} row={rowIndex} />
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
  const placeholders = Array.from({ length: columns }, () => ({ size: 160 }));
  return (
    <div className={`seneca-grid${className ? ` ${className}` : ''}`} aria-hidden>
      <div className="seneca-grid__scroll">
        <table className="seneca-grid__table" style={{ width: '100%' }}>
          <thead className="seneca-grid__thead">
            <tr>
              {placeholders.map((column, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
                <th key={index} className="seneca-grid__th">
                  <Placeholder cell={undefined} size={column.size} row={index} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="seneca-grid__tbody">
            <GridSkeletonRows count={rows} columns={placeholders} rowHeight={rowHeight} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
