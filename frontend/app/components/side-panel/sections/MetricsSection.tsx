'use client';

import React from 'react';
import type { ChartItem, MetricsSection, SummaryItem } from '../types';
import { SectionWrapper } from './components/SectionWrapper';
import { SummaryItemComponent } from './SummarySection';

// eslint-disable-next-line max-lines-per-function, complexity
export function ChartItemComponent({ item }: { item: ChartItem }): React.JSX.Element | null {
  // Simple progress bar renderer
  if (item.type === 'progress') {
    const value = Array.isArray(item.data) && typeof item.data[0] === 'number' ? item.data[0] : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
            {item.title}
          </span>
          <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>{value}%</span>
        </div>
        <div style={{ height: 8, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, value))}%`,
              height: '100%',
              transition: 'width 300ms',
              backgroundColor: item.color || 'var(--primary)',
            }}
          />
        </div>
      </div>
    );
  }

  // Simple sparkline renderer
  if (item.type === 'sparkline' && Array.isArray(item.data)) {
    const numericData = item.data.filter((d): d is number => typeof d === 'number');
    const max = Math.max(...numericData, 1);
    const min = Math.min(...numericData, 0);
    const range = max - min || 1;
    const height = item.height || 40;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
          {item.title}
        </span>
        <svg width="100%" height={height} aria-label={item.title} role="img">
          <polyline
            fill="none"
            stroke={item.color || 'var(--primary)'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={numericData
              // eslint-disable-next-line max-params
              .map((d, i) => {
                const x = (i / (numericData.length - 1)) * 100;
                const y = height - ((d - min) / range) * height;
                return `${x}%,${y}`;
              })
              .join(' ')}
          />
        </svg>
      </div>
    );
  }

  // Custom renderer
  if (item.type === 'custom' && item.customRenderer) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
          {item.title}
        </span>
        {item.customRenderer(item.data)}
      </div>
    );
  }

  return null;
}

export function isChartItem(item: SummaryItem | ChartItem): item is ChartItem {
  return 'type' in item && typeof (item as ChartItem).data !== 'undefined';
}

export function MetricsSectionRenderer({
  section,
}: {
  section: MetricsSection;
}): React.JSX.Element {
  return (
    <SectionWrapper section={section}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {section.items.map(item =>
          isChartItem(item) ? (
            <ChartItemComponent key={item.id} item={item} />
          ) : (
            <SummaryItemComponent key={item.id} item={item as SummaryItem} />
          ),
        )}
      </div>
    </SectionWrapper>
  );
}
