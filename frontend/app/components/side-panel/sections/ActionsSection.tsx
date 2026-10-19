'use client';

import React, { useMemo } from 'react';
import { tokens } from '@/lib/theme-tokens';
import { Spinner } from '../../ui/spinner';
import type { ActionItem, ActionsSection } from '../types';
import { RenderIcon } from './components/RenderIcon';
import { SectionWrapper } from './components/SectionWrapper';
import { ACTION_SIZE_STYLES, ACTION_VARIANT_STYLES } from './helpers/section-constants';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-lines-per-function, complexity
function ActionItemComponent({ item }: { item: ActionItem }) {
  const sizeStyle = ACTION_SIZE_STYLES[item.size || 'md'];
  const variantStyle = ACTION_VARIANT_STYLES[item.variant || 'secondary'];

  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={item.disabled || item.loading}
      title={item.tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: tokens.radius.md,
        fontWeight: 500,
        cursor: item.disabled || item.loading ? 'not-allowed' : 'pointer',
        opacity: item.disabled || item.loading ? 0.5 : 1,
        ...sizeStyle,
        ...variantStyle,
      }}
    >
      {item.loading ? (
        <Spinner size={16} />
      ) : (
        item.icon && <RenderIcon icon={item.icon} size={16} />
      )}
      <span>{item.label}</span>
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function ActionsSectionRenderer({ section }: { section: ActionsSection }) {
  const layoutStyle = useMemo((): React.CSSProperties => {
    switch (section.layout) {
      case 'horizontal':
        return { display: 'flex', flexWrap: 'wrap', gap: 8 };
      case 'grid':
        return { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 };
      default:
        return { display: 'flex', flexDirection: 'column', gap: 8 };
    }
  }, [section.layout]);

  return (
    <SectionWrapper section={section}>
      <div style={layoutStyle}>
        {section.items.map(item => (
          <ActionItemComponent key={item.id} item={item} />
        ))}
      </div>
    </SectionWrapper>
  );
}
