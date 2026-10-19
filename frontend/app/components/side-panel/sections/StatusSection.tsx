'use client';

import { useMemo } from 'react';
import { tokens } from '@/lib/theme-tokens';
import type { StatusItem, StatusSection } from '../types';
import { RenderIcon } from './components/RenderIcon';
import { SectionWrapper } from './components/SectionWrapper';
import { STATUS_COLOR_MAP } from './helpers/section-constants';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-lines-per-function
function StatusItemComponent({ item }: { item: StatusItem }) {
  const formattedTime = useMemo(() => {
    if (!item.timestamp) return null;
    const date = typeof item.timestamp === 'string' ? new Date(item.timestamp) : item.timestamp;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [item.timestamp]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: tokens.radius.full,
          flexShrink: 0,
          backgroundColor: STATUS_COLOR_MAP[item.status] ?? 'var(--muted-foreground)',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {item.icon && <RenderIcon icon={item.icon} size={14} />}
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </span>
        </div>
        {item.description && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted-foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
              marginBottom: 0,
            }}
          >
            {item.description}
          </p>
        )}
      </div>
      {formattedTime && (
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>
          {formattedTime}
        </span>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function StatusSectionRenderer({ section }: { section: StatusSection }) {
  return (
    <SectionWrapper section={section}>
      <div>
        {section.items.map(item => (
          <StatusItemComponent key={item.id} item={item} />
        ))}
      </div>
    </SectionWrapper>
  );
}
