import Skeleton from '@mui/material/Skeleton';
import clsx from 'clsx';
import type React from 'react';
import { ListRow } from './ListRow';

/** List rows of a dashboard card while it loads: name over a caption, a figure on the right. */
export function ListRowsSkeleton({
  rows,
  leading = 0,
}: {
  rows: number;
  /** Size of the round icon or avatar in front of each row; 0 for none. */
  leading?: number;
}): React.JSX.Element {
  return (
    <div className="seneca-dashboard__list">
      {Array.from({ length: rows }, (_, index) => (
        <ListRow
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          key={index}
          leading={
            leading > 0 ? <Skeleton variant="circular" width={leading} height={leading} /> : null
          }
          primary={<Skeleton variant="text" width="55%" />}
          secondary={<Skeleton variant="text" width="35%" />}
          trailing={<Skeleton variant="text" width={64} />}
        />
      ))}
    </div>
  );
}

/** The budget rows of the dashboard's budgets card: name and share over a thin bar. */
export function BudgetRowsSkeleton({
  rows,
  wide = false,
}: {
  rows: number;
  /** With the row to itself the card lays budgets out in columns, each with its amounts. */
  wide?: boolean;
}): React.JSX.Element {
  return (
    <div className={clsx('seneca-dashboard__list', wide && 'seneca-dashboard__list--columns')}>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <div key={index} className="seneca-dashboard__budget-row">
          <div className="seneca-dashboard__budget-head">
            <span className="seneca-dashboard__row-primary">
              <Skeleton variant="text" width={120} />
            </span>
            <span className="seneca-dashboard__budget-pct">
              <Skeleton variant="text" width={32} />
            </span>
          </div>
          <div className="seneca-dashboard__budget-bar">
            <Skeleton variant="rounded" height={5} sx={{ borderRadius: '3px' }} />
          </div>
          {wide && (
            <div className="seneca-dashboard__budget-amounts">
              <Skeleton variant="text" width={100} />
              <Skeleton variant="text" width={70} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
