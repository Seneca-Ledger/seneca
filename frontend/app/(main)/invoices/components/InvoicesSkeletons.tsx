import Skeleton from '@mui/material/Skeleton';
import type React from 'react';

const ROW_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4', 'row-5'];
const FIELD_KEYS = ['field-0', 'field-1', 'field-2', 'field-3'];

const CELL_KEYS = ['cell-0', 'cell-1', 'cell-2', 'cell-3', 'cell-4', 'cell-5'];

// The real tables' classes, so rows land where the loaded ones will.
// `textColumns` cells, then the actions cell on the right.
function TableSkeleton({ textColumns }: { textColumns: number }): React.JSX.Element {
  return (
    <div className="seneca-payable-list">
      <div className="seneca-payable-list__table-wrap">
        <table className="seneca-payable-list__table">
          <tbody className="seneca-payable-list__tbody">
            {ROW_KEYS.map(row => (
              <tr key={row}>
                {CELL_KEYS.slice(0, textColumns).map(cell => (
                  <td key={cell} className="seneca-payable-list__td">
                    <Skeleton variant="text" width="60%" height={18} />
                  </td>
                ))}
                <td className="seneca-payable-list__td">
                  <Skeleton
                    variant="rounded"
                    width={96}
                    height={28}
                    style={{ marginLeft: 'auto' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InvoicesListSkeleton(): React.JSX.Element {
  return (
    <div className="container-shared seneca-stmt-list">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Skeleton variant="rounded" width={88} height={40} />
        <Skeleton variant="rounded" width={148} height={40} />
      </div>
      <TableSkeleton textColumns={6} />
    </div>
  );
}

export function ClientsListSkeleton(): React.JSX.Element {
  return (
    <div className="container-shared seneca-stmt-list">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton variant="rounded" width={20} height={20} />
        <div style={{ flex: 1 }} />
        <Skeleton variant="rounded" width={132} height={40} />
      </div>
      <TableSkeleton textColumns={3} />
    </div>
  );
}

export function InvoiceDetailSkeleton(): React.JSX.Element {
  return (
    <div className="container-shared seneca-invoice-detail">
      <div className="seneca-invoice-detail__header">
        <Skeleton variant="rounded" width={20} height={20} />
        <Skeleton variant="text" width={160} height={32} />
        <Skeleton variant="rounded" width={64} height={22} />
        <div className="seneca-invoice-detail__actions">
          <Skeleton variant="rounded" width={120} height={40} />
          <Skeleton variant="rounded" width={88} height={40} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
        {FIELD_KEYS.map(key => (
          <div key={key}>
            <Skeleton variant="text" width={120} height={18} />
            <Skeleton variant="rounded" height={40} />
          </div>
        ))}
      </div>
    </div>
  );
}
