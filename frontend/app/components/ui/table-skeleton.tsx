import Skeleton from '@mui/material/Skeleton';
import type React from 'react';

/** One column of a loading row: the cell's own class, and what stands in for its value. */
export interface SkeletonColumn {
  className?: string;
  /** A round mark of this size (an icon, an avatar), a text line, or nothing. */
  shape: 'circle' | 'text' | 'none';
  /** Circle: its size. Text: the longest line, in px; rows vary below it. */
  size?: number;
}

// Rows of one table differ in length the way real names and amounts do.
const ROW_SHARES = [1, 0.7, 0.85, 0.6, 0.95, 0.75, 0.9, 0.65];

/**
 * The body of a table while its rows load: the same cells as the real rows, with
 * a line or a mark where each value will be, so the header above stays real.
 */
export function SkeletonRows({
  columns,
  rows = 6,
}: {
  columns: readonly SkeletonColumn[];
  rows?: number;
}): React.JSX.Element {
  return (
    <tbody aria-busy="true">
      {Array.from({ length: rows }, (_, row) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <tr key={row}>
          {columns.map((column, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: columns are fixed per table
            <td key={index} className={column.className}>
              {column.shape === 'circle' ? (
                <Skeleton variant="circular" width={column.size} height={column.size} />
              ) : column.shape === 'text' ? (
                <Skeleton
                  variant="text"
                  width={Math.round((column.size ?? 120) * ROW_SHARES[row % ROW_SHARES.length])}
                  sx={{ display: 'inline-block', maxWidth: '100%' }}
                />
              ) : null}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
