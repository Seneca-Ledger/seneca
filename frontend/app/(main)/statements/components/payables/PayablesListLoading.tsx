'use client';

import type React from 'react';
import { SkeletonRows } from '@/app/components/ui/table-skeleton';
import type { Payable } from '@/app/lib/payables-api';
import PayablesList from './PayablesList';

type PayablesListProps = React.ComponentProps<typeof PayablesList>;

const TD = 'seneca-payable-list__td';
const LOADING_COLUMNS = [
  { className: TD, shape: 'text', size: 160 },
  { className: `${TD} seneca-payable-list__muted`, shape: 'text', size: 90 },
  { className: TD, shape: 'text', size: 80 },
  { className: `${TD} seneca-payable-list__amount`, shape: 'text', size: 90 },
  { className: TD, shape: 'none' },
] as const;

/**
 * The bills table, or while `items` is null its header over placeholder rows.
 * The source column shows only when bills differ in source, so it waits.
 */
export function PayablesListLoading({
  items,
  ...props
}: Omit<PayablesListProps, 'items'> & { items: Payable[] | null }): React.JSX.Element {
  if (items) return <PayablesList items={items} {...props} />;
  const { labels } = props;
  return (
    <div className="seneca-payable-list">
      <div className="seneca-payable-list__table-wrap">
        <table className="seneca-payable-list__table">
          <thead className="seneca-payable-list__thead">
            <tr>
              <th className="seneca-payable-list__th">{labels.vendor}</th>
              <th className="seneca-payable-list__th">{labels.dueDate}</th>
              <th className="seneca-payable-list__th">{labels.status}</th>
              <th className="seneca-payable-list__th seneca-payable-list__th--right">
                {labels.amount}
              </th>
              <th className="seneca-payable-list__th seneca-payable-list__th--right">
                <span className="u-visually-hidden">{labels.actions}</span>
              </th>
            </tr>
          </thead>
          <SkeletonRows columns={LOADING_COLUMNS} rows={7} />
        </table>
      </div>
    </div>
  );
}
