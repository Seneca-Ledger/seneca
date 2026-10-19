'use client';

import Link from 'next/link';
import React from 'react';
import { ChevronRight } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import { Spinner } from '../../ui/spinner';
import type { NavigationItem, NavigationSection } from '../types';
import { RenderIcon } from './components/RenderIcon';
import { SectionWrapper } from './components/SectionWrapper';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-lines-per-function, complexity
function NavigationItemComponent({ item, depth = 0 }: { item: NavigationItem; depth?: number }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const emphasis = item.emphasis || 'default';
  const isHighEmphasis = emphasis === 'high';

  const content = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        {item.icon && (
          <span
            style={{
              display: 'flex',
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              color: item.active ? 'var(--primary)' : 'var(--muted-foreground)',
            }}
          >
            <RenderIcon icon={item.icon} size={20} />
          </span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {item.badgeLoading && <Spinner size={14} style={{ color: 'var(--muted-foreground)' }} />}
        {!item.badgeLoading && item.badge !== undefined && Number(item.badge) > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              fontSize: 11,
              // Counts stay quiet: grey, or a soft green tint (same as the row
              // highlight above) for the current item — never a solid fill.
              fontWeight: item.active ? 600 : 500,
              borderRadius: tokens.radius.full,
              backgroundColor: item.active ? 'rgba(var(--primary-rgb),0.15)' : 'transparent',
              color: item.active ? 'var(--primary)' : 'var(--muted-foreground)',
            }}
          >
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <ChevronRight
            size={14}
            style={{
              color: 'var(--muted-foreground)',
              transition: 'transform 200ms',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        )}
      </div>
    </>
  );

  const itemStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 10px',
    fontSize: 13.5,
    textDecoration: 'none',
    transition: 'background-color 200ms',
    border: 'none',
    cursor: item.disabled ? 'not-allowed' : 'pointer',
    opacity: item.disabled ? 0.5 : 1,
    borderRadius: tokens.radius.md,
    backgroundColor: item.active
      ? isHighEmphasis
        ? 'rgba(var(--primary-rgb),0.1)'
        : 'rgba(0,0,0,0.06)'
      : 'transparent',
    color: item.active ? 'var(--foreground)' : 'var(--text-secondary)',
    fontWeight: item.active ? 500 : 400,
    ...(depth > 0 ? { marginLeft: 24 } : {}),
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
    if (item.onClick && !item.disabled) {
      item.onClick();
    }
  };

  return (
    <div>
      {item.href && !hasChildren ? (
        <Link href={item.href} style={itemStyle}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={handleClick} disabled={item.disabled} style={itemStyle}>
          {content}
        </button>
      )}
      {hasChildren && isExpanded && (
        <div style={{ marginTop: 4 }}>
          {(item.children ?? []).map(child => (
            <NavigationItemComponent key={child.id} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function NavigationSectionRenderer({ section }: { section: NavigationSection }) {
  return (
    <SectionWrapper section={section}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {section.items.map(item => (
          <NavigationItemComponent key={item.id} item={item} />
        ))}
      </div>
    </SectionWrapper>
  );
}
