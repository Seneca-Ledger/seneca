import Skeleton from '@mui/material/Skeleton';
import { tokens } from '@/lib/theme-tokens';

const cardStyle = {
  border: '1px solid var(--border)',
  borderRadius: tokens.radius.md,
  background: 'var(--card)',
  padding: 4,
  display: 'grid',
} as const;

/** One account row as `AccountRow` lays it out: badge, name over bank, balance over status. */
function RowSkeleton(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
      <Skeleton variant="circular" width={36} height={36} sx={{ flexShrink: 0 }} />
      <span style={{ display: 'grid', gap: 2, flex: 1 }}>
        <Skeleton variant="text" width={140} height={23} />
        <Skeleton variant="text" width={100} height={20} />
      </span>
      <span style={{ display: 'grid', gap: 2, justifyItems: 'end' }}>
        <Skeleton variant="text" width={90} height={23} />
        <Skeleton variant="text" width={70} height={20} />
      </span>
    </div>
  );
}

/** The accounts page while it loads: the summary line and two groups of rows. */
export function AccountsSkeleton(): React.JSX.Element {
  return (
    <>
      <div style={{ display: 'flex', gap: 16 }}>
        <Skeleton variant="text" width={150} height={22} />
        <Skeleton variant="text" width={90} height={22} />
      </div>
      <div style={{ display: 'grid', gap: 24 }}>
        {[2, 1].map((rows, group) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <section key={group} style={{ display: 'grid', gap: 8 }}>
            <Skeleton variant="text" width={70} height={18} sx={{ ml: 0.5 }} />
            <div style={cardStyle}>
              {Array.from({ length: rows }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <RowSkeleton key={index} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
