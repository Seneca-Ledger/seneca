import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { Card } from '@/app/components/ui/card';
import { SkeletonRows } from '@/app/components/ui/table-skeleton';
import type { PayableDirection } from '@/app/lib/payables-api';
import { TransactionsPageTitle } from '../TransactionsPageTitle';

const SUMMARY_CARD_KEYS = ['card-0', 'card-1', 'card-2', 'card-3'];
const TOOLBAR_WIDTHS = [72, 84, 150, 130];
const TD = 'seneca-payable-list__td';
const ROW_COLUMNS = [
  { className: TD, shape: 'text', size: 160 },
  { className: TD, shape: 'text', size: 90 },
  { className: TD, shape: 'text', size: 80 },
  { className: `${TD} seneca-payable-list__amount`, shape: 'text', size: 90 },
  { className: TD, shape: 'none' },
] as const;

/**
 * The bills page before the account and workspace are known: the page title,
 * then the toolbar, cards and table in the places the loaded page puts them.
 */
export function PayablesViewSkeleton({
  direction = 'payable',
}: {
  direction?: PayableDirection;
}): React.JSX.Element {
  return (
    <div className="container-shared seneca-stmt-list" aria-busy="true">
      <div style={{ marginBottom: 24 }}>
        <div className="seneca-stmt-toolbar" style={{ width: '100%' }}>
          <TransactionsPageTitle
            page={direction === 'receivable' ? 'income' : 'expenses'}
            span={{ kind: 'allTime' }}
            extras={[]}
          />
          <div className="seneca-stmt-toolbar__group">
            {TOOLBAR_WIDTHS.map(width => (
              <Skeleton key={width} variant="rounded" width={width} height={36} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="seneca-payable-summary">
          {SUMMARY_CARD_KEYS.map(key => (
            <Card
              key={key}
              className="seneca-payable-summary__card"
              style={{ border: '1px solid var(--border-color)', boxShadow: 'none' }}
            >
              <div className="seneca-payable-summary__card-content">
                <Skeleton variant="text" width={80} />
                <Skeleton variant="text" width={120} className="seneca-payable-summary__value" />
                <Skeleton variant="text" width={56} />
              </div>
            </Card>
          ))}
        </div>
        <div className="seneca-payable-list">
          <div className="seneca-payable-list__table-wrap">
            <table className="seneca-payable-list__table">
              <SkeletonRows columns={ROW_COLUMNS} rows={7} />
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
