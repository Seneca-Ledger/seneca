'use client';

import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { tokens } from '@/lib/theme-tokens';
import type { StatementColumn, StatementColumnId } from './columns/statement-columns';
import { columnCellStyle } from './statements-list-item.cells';

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
// Names and amounts differ in length from row to row, as real ones do.
const SHARES = [1, 0.7, 0.85, 0.6, 0.95, 0.75, 0.9, 0.65];

const CHECKBOX_SLOT: React.CSSProperties = {
  width: 16,
  display: 'flex',
  justifyContent: 'center',
  opacity: 0.7,
  flexShrink: 0,
  marginRight: 16,
};

function Cell({
  columnId,
  share,
  reviewLabel,
}: {
  columnId: StatementColumnId;
  share: number;
  reviewLabel: string;
}): React.ReactNode {
  if (columnId === 'receipt') {
    return (
      <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: tokens.radius.xs }} />
    );
  }
  if (columnId === 'merchant') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Skeleton variant="text" width={`${Math.round(55 * share)}%`} height={22} />
        <Skeleton variant="text" width={80} height={18} />
      </div>
    );
  }
  if (columnId === 'category') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <Skeleton variant="circular" width={22} height={22} sx={{ flexShrink: 0 }} />
        <Skeleton variant="text" width={`${Math.round(70 * share)}%`} height={20} />
      </div>
    );
  }
  if (columnId === 'amount') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <Skeleton variant="text" width={Math.round(100 * share)} height={22} />
        <Skeleton variant="text" width={64} height={16} />
      </div>
    );
  }
  if (columnId === 'action') {
    // The same width as the real rows: the Review label sizes the column.
    return (
      <span
        aria-hidden
        className="seneca-stmt-list-item__view-btn seneca-stmt-list-item__action-sizer"
      >
        {reviewLabel}
      </span>
    );
  }
  return <Skeleton variant="text" width={`${Math.round(50 * share)}%`} height={20} />;
}

/**
 * Document rows while the list loads: the row of StatementsListItem with each
 * visible column in its place and a placeholder where its value will be.
 */
export function StatementsRowsSkeleton({
  columns,
  reviewLabel,
}: {
  columns: StatementColumn[];
  reviewLabel: string;
}): React.JSX.Element {
  return (
    <div aria-busy="true">
      {ROW_KEYS.map((key, row) => (
        <div key={key} className="seneca-stmt-list-item">
          <div className="seneca-stmt-list-item__mobile">
            <div className="seneca-stmt-list-item__mobile-select">
              <Checkbox disabled />
            </div>
            <Skeleton
              variant="rounded"
              width={40}
              height={40}
              sx={{ borderRadius: tokens.radius.xs }}
            />
            <div className="seneca-stmt-list-item__mobile-body">
              <Skeleton variant="text" width={`${Math.round(70 * SHARES[row])}%`} height={22} />
              <Skeleton variant="text" width="40%" height={18} />
            </div>
          </div>
          <div className="seneca-stmt-list-item__desktop">
            <div style={CHECKBOX_SLOT}>
              <Checkbox disabled style={{ height: 16, width: 16 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
              {columns.map(column => (
                <div key={column.id} style={columnCellStyle(column.id)}>
                  <Cell columnId={column.id} share={SHARES[row]} reviewLabel={reviewLabel} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
