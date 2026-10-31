'use client';

import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { RotateCcw, Trash2 } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { tokens } from '@/lib/theme-tokens';

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
// File names differ in length from row to row, as real ones do.
const SHARES = [1, 0.7, 0.85, 0.6, 0.95, 0.75, 0.9];

interface TrashSkeletonLabels {
  selectAll: string;
  typeHeader: string;
  deletedAtHeader: string;
  autoDeleteHeader: string;
  nameHeader: string;
  actionsHeader: string;
  restore: string;
  delete: string;
}

/**
 * The trash while it loads: the real column titles over rows shaped like
 * TrashListItem, placeholders where the type, dates and file name go.
 */
export function TrashListSkeleton({ labels }: { labels: TrashSkeletonLabels }): React.JSX.Element {
  return (
    <div className="seneca-trash-list__items" aria-busy="true">
      <div className="seneca-trash-list__select-all-mobile">
        <Checkbox disabled style={{ height: 16, width: 16, borderRadius: tokens.radius.xs }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>{labels.selectAll}</span>
      </div>
      <div className="seneca-trash-list__thead">
        <div style={{ width: 16 }}>
          <Checkbox disabled style={{ height: 16, width: 16, borderRadius: tokens.radius.xs }} />
        </div>
        <div style={{ width: 176 }}>{labels.typeHeader}</div>
        <div style={{ width: 440, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <span>{labels.deletedAtHeader}</span>
          <span>{labels.autoDeleteHeader}</span>
        </div>
        <div style={{ flex: 1 }}>{labels.nameHeader}</div>
        <div style={{ width: 144, textAlign: 'right' }}>{labels.actionsHeader}</div>
      </div>
      {ROW_KEYS.map((key, row) => (
        <div key={key} className="seneca-trash-item">
          <div className="seneca-trash-item__inner">
            <div className="seneca-trash-item__type-col">
              <Checkbox disabled style={{ height: 16, width: 16 }} />
              <div className="seneca-trash-item__type-label">
                <Skeleton variant="circular" width={16} height={16} />
                <Skeleton variant="text" width={72} />
              </div>
            </div>
            <div className="seneca-trash-item__dates-col">
              {[labels.deletedAtHeader, labels.autoDeleteHeader].map(caption => (
                <div key={caption} style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="seneca-trash-item__date-label">{caption}</span>
                  <Skeleton variant="text" width={120} />
                </div>
              ))}
            </div>
            <div className="seneca-trash-item__file-col">
              <Skeleton variant="circular" width={20} height={20} sx={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <Skeleton variant="text" width={`${Math.round(60 * SHARES[row])}%`} />
                <Skeleton variant="text" width={80} height={16} />
              </div>
            </div>
            <div className="seneca-trash-item__actions">
              <button type="button" disabled className="seneca-trash-item__restore-btn">
                <RotateCcw size={14} />
                {labels.restore}
              </button>
              <button
                type="button"
                disabled
                className="seneca-trash-item__delete-btn"
                aria-label={labels.delete}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
