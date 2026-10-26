import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { tokens } from '@/lib/theme-tokens';

const SUMMARY_CARD_KEYS = ['card-0', 'card-1', 'card-2', 'card-3'];
const PAYABLE_ROW_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6'];

function PayablesSummaryCardSkeleton(): React.JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: tokens.radius.lg,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Skeleton variant="text" width="50%" height={16} />
        <Skeleton variant="rounded" width={16} height={16} />
      </div>
      <Skeleton variant="text" width="60%" height={28} style={{ marginTop: 8 }} />
      <Skeleton variant="text" width="40%" height={16} />
    </div>
  );
}

function PayablesRowSkeleton(): React.JSX.Element {
  return (
    <tr>
      <td className="seneca-payable-list__td">
        <Skeleton variant="text" width="70%" height={18} />
      </td>
      <td className="seneca-payable-list__td">
        <Skeleton variant="text" width="60%" height={16} />
      </td>
      <td className="seneca-payable-list__td">
        <Skeleton variant="text" width="60%" height={16} />
      </td>
      <td className="seneca-payable-list__td">
        <Skeleton variant="rounded" width={72} height={22} />
      </td>
      <td className="seneca-payable-list__td" style={{ textAlign: 'right' }}>
        <Skeleton variant="text" width={80} height={18} style={{ marginLeft: 'auto' }} />
      </td>
      <td className="seneca-payable-list__td">
        <Skeleton variant="rounded" width={120} height={28} style={{ marginLeft: 'auto' }} />
      </td>
    </tr>
  );
}

export function PayablesViewSkeleton(): React.JSX.Element {
  return (
    <div className="container-shared seneca-stmt-list">
      <div className="seneca-stat-tiles">
        {SUMMARY_CARD_KEYS.map(key => (
          <PayablesSummaryCardSkeleton key={key} />
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <table style={{ minWidth: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <tbody>
            {PAYABLE_ROW_KEYS.map(key => (
              <PayablesRowSkeleton key={key} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
