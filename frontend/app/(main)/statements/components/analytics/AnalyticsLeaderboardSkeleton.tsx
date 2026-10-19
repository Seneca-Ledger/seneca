'use client';

import Skeleton from '@mui/material/Skeleton';
import { tokens } from '@/lib/theme-tokens';

const STAT_CARD_KEYS = ['stat-0', 'stat-1', 'stat-2', 'stat-3'];
const ROW_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6', 'row-7'];

function StatCardSkeleton(): React.JSX.Element {
  return (
    <div className="seneca-view-page__stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Skeleton variant="text" width="50%" height={12} />
        <Skeleton variant="rounded" width={16} height={16} />
      </div>
      <div style={{ marginTop: 8 }}>
        <Skeleton variant="text" width="60%" height={22} />
      </div>
      <Skeleton variant="text" width="40%" height={14} />
    </div>
  );
}

function LeaderboardRowSkeleton(): React.JSX.Element {
  return (
    <tr style={{ borderTop: '1px solid var(--muted)' }}>
      <td style={{ padding: '8px 16px 8px 0' }}>
        <Skeleton variant="text" width="70%" height={18} />
      </td>
      <td style={{ padding: '8px 16px 8px 0' }}>
        <Skeleton variant="rounded" width={72} height={22} />
      </td>
      <td style={{ padding: '8px 16px 8px 0', textAlign: 'right' }}>
        <Skeleton variant="text" width={24} height={16} style={{ marginLeft: 'auto' }} />
      </td>
      <td style={{ padding: '8px 16px 8px 0', textAlign: 'right' }}>
        <Skeleton variant="text" width={60} height={16} style={{ marginLeft: 'auto' }} />
      </td>
      <td style={{ padding: '8px 16px 8px 0', textAlign: 'right' }}>
        <Skeleton variant="text" width={70} height={16} style={{ marginLeft: 'auto' }} />
      </td>
      <td style={{ padding: '8px 0', textAlign: 'right' }}>
        <Skeleton variant="text" width={80} height={16} style={{ marginLeft: 'auto' }} />
      </td>
    </tr>
  );
}

export function AnalyticsLeaderboardSkeleton(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      <div className="seneca-stat-tiles">
        {STAT_CARD_KEYS.map(key => (
          <StatCardSkeleton key={key} />
        ))}
      </div>
      <div
        style={{
          border: '1px solid var(--border-color)',
          background: 'var(--card-bg)',
          padding: 20,
          borderRadius: tokens.radius.lg,
        }}
      >
        <div
          style={{
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Skeleton variant="text" width={140} height={18} />
          <Skeleton variant="rounded" width={180} height={26} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <tbody>
              {ROW_KEYS.map(key => (
                <LeaderboardRowSkeleton key={key} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
