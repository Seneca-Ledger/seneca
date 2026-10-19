'use client';

import type { ReactNode } from 'react';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  title: string;
  children: ReactNode;
  height?: number;
  spanColumns?: number;
};

export function AnalyticsChartCard({ title, children, spanColumns }: Props): React.JSX.Element {
  const style: React.CSSProperties = {
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    padding: 20,
    borderRadius: tokens.radius.lg,
  };

  if (spanColumns) {
    style.gridColumn = `span ${spanColumns}`;
  }

  return (
    <div style={style}>
      <div
        style={{
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
