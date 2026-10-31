import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { tokens } from '@/lib/theme-tokens';

type ReviewColumn = 'receipt' | 'merchant' | 'category' | 'amount';

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
// Names and amounts differ in length from row to row, as real ones do.
const SHARES = [1, 0.7, 0.85, 0.6, 0.95, 0.75];

/**
 * Review rows while they load: the same row, checkbox, thumbnail, merchant
 * and date, category and amount, with a placeholder in each slot.
 */
export function ReviewRowsSkeleton({
  columnStyle,
  selectCellSx,
  showCategory,
}: {
  columnStyle: (column: ReviewColumn) => React.CSSProperties;
  selectCellSx: Record<string, unknown>;
  showCategory: boolean;
}): React.JSX.Element {
  return (
    <div aria-busy="true">
      {ROW_KEYS.map((key, row) => (
        <Box
          key={key}
          className="seneca-stmt-list-item"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Box sx={{ ...selectCellSx, mr: 2 }}>
            <Checkbox disabled style={{ height: 16, width: 16 }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <div style={columnStyle('receipt')}>
              <Skeleton
                variant="rounded"
                width={40}
                height={40}
                sx={{ borderRadius: tokens.radius.xs }}
              />
            </div>
            <div
              style={{ ...columnStyle('merchant'), flexDirection: 'column', alignItems: 'stretch' }}
            >
              <Skeleton variant="text" width={`${Math.round(60 * SHARES[row])}%`} height={22} />
              <Skeleton variant="text" width={`${Math.round(40 * SHARES[row])}%`} height={16} />
            </div>
            {showCategory ? (
              <div style={{ ...columnStyle('category'), gap: 8 }}>
                <Skeleton variant="circular" width={22} height={22} sx={{ flexShrink: 0 }} />
                <Skeleton variant="text" width={Math.round(110 * SHARES[row])} height={20} />
              </div>
            ) : null}
            <div style={columnStyle('amount')}>
              <Skeleton variant="text" width={Math.round(90 * SHARES[(row + 2) % 6])} height={20} />
            </div>
          </Box>
        </Box>
      ))}
    </div>
  );
}
