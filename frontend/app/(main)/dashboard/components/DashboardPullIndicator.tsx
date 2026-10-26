'use client';

import { RefreshCcw } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import { text } from '../helpers/dashboard-helpers';

type PullIndicatorProps = {
  isMobile: boolean;
  pullDistance: number;
  pullRefreshing: boolean;
  isReadyToRefresh: boolean;
  t: { loading?: unknown; ready?: unknown; idle?: unknown } | null | undefined;
};

const CONTAINER_STYLE: React.CSSProperties = {
  pointerEvents: 'none',
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 16,
};

export function DashboardPullIndicator({
  isMobile,
  pullDistance,
  pullRefreshing,
  isReadyToRefresh,
  t,
}: PullIndicatorProps): React.JSX.Element | null {
  if (!isMobile || (pullDistance <= 0 && !pullRefreshing)) {
    return null;
  }
  const isActive = isReadyToRefresh || pullRefreshing;
  const label = pullRefreshing
    ? text(t?.loading)
    : isReadyToRefresh
      ? text(t?.ready)
      : text(t?.idle);
  return (
    <div style={CONTAINER_STYLE}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: tokens.radius.full,
          border: '1px solid',
          borderColor: isActive ? 'rgba(var(--primary-rgb),0.4)' : 'var(--border-color)',
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 500,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          backgroundColor: 'var(--card-bg)',
          color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
        }}
      >
        <RefreshCcw
          style={{ width: 14, height: 14 }}
          className={pullRefreshing ? 'animate-spin' : undefined}
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
