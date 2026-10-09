'use client';

import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, Minus } from '@/app/components/icons';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { tokens } from '@/lib/theme-tokens';
import type { SummaryItem, SummarySection } from '../types';
import { RenderIcon } from './components/RenderIcon';
import { SectionWrapper } from './components/SectionWrapper';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity
export function SummaryItemComponent({ item }: { item: SummaryItem }) {
  // eslint-disable-next-line complexity
  const formattedValue = useMemo(() => {
    if (typeof item.value === 'string') return item.value;

    let formatted: string;
    switch (item.format) {
      case 'currency':
        formatted = new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: FALLBACK_CURRENCY,
          minimumFractionDigits: 0,
        }).format(item.value);
        break;
      case 'percentage':
        formatted = `${item.value}%`;
        break;
      case 'number':
        formatted = new Intl.NumberFormat('ru-RU').format(item.value);
        break;
      default:
        formatted = String(item.value);
    }

    return `${item.prefix || ''}${formatted}${item.suffix || ''}`;
  }, [item]);

  return (
    <div style={{ padding: 12, backgroundColor: 'var(--muted)', borderRadius: tokens.radius.lg }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted-foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            {item.label}
          </p>
          <p
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--foreground)',
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            {formattedValue}
          </p>
          {item.change && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              {item.change.type === 'increase' && (
                <ArrowUp size={12} style={{ color: tokens.color.success }} />
              )}
              {item.change.type === 'decrease' && (
                <ArrowDown size={12} style={{ color: 'var(--destructive)' }} />
              )}
              {item.change.type === 'neutral' && (
                <Minus size={12} style={{ color: 'var(--muted-foreground)' }} />
              )}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color:
                    item.change.type === 'increase'
                      ? tokens.color.success
                      : item.change.type === 'decrease'
                        ? tokens.color.danger
                        : 'var(--muted-foreground)',
                }}
              >
                {item.change.value > 0 ? '+' : ''}
                {item.change.value}%
              </span>
              {item.change.period && (
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {item.change.period}
                </span>
              )}
            </div>
          )}
        </div>
        {item.icon && (
          <div
            style={{
              padding: 8,
              borderRadius: tokens.radius.sm,
              backgroundColor: 'rgba(var(--primary-rgb),0.1)',
            }}
          >
            <RenderIcon icon={item.icon} size={16} />
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function SummarySectionRenderer({ section }: { section: SummarySection }) {
  const gridStyle = useMemo((): React.CSSProperties => {
    if (section.layout === 'list') {
      return { display: 'flex', flexDirection: 'column', gap: 8 };
    }
    return {
      display: 'grid',
      gap: 8,
      gridTemplateColumns: `repeat(${section.columns || 2}, 1fr)`,
    };
  }, [section.layout, section.columns]);

  return (
    <SectionWrapper section={section}>
      <div style={gridStyle}>
        {section.items.map(item => (
          <SummaryItemComponent key={item.id} item={item} />
        ))}
      </div>
    </SectionWrapper>
  );
}
