'use client';

import React from 'react';
import { ChevronDown } from '@/app/components/icons';
import { useSidePanel } from '../../SidePanelContext';
import type { SidePanelSection } from '../../types';
import { RenderIcon } from './RenderIcon';

/** Section wrapper with optional collapse */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity
export function SectionWrapper({
  section,
  children,
}: {
  section: SidePanelSection;
  children: React.ReactNode;
}) {
  const { collapsedSections, toggleSection } = useSidePanel();
  const isCollapsed = section.collapsible
    ? collapsedSections.has(section.id) || (section.defaultCollapsed ?? false)
    : false;

  if (section.hidden) return null;

  return (
    // Dense rows, generous gaps between groups.
    <div style={{ marginBottom: 32 }} className={section.className}>
      {section.title && (
        <button
          type="button"
          onClick={() => section.collapsible && toggleSection(section.id)}
          disabled={!section.collapsible}
          className={section.titleClassName}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            // Lines the title up with the row labels (content 6px + row 10px).
            padding: '6px 16px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            background: 'none',
            border: 'none',
            cursor: section.collapsible ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {section.icon && <RenderIcon icon={section.icon} size={14} />}
            <span>{section.title}</span>
          </div>
          {section.collapsible && (
            <ChevronDown
              size={14}
              style={{
                transition: 'transform 200ms',
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              }}
            />
          )}
        </button>
      )}
      {/* Clip only while collapsed: an always-on overflow cuts the focus ring of the first row. */}
      <div
        style={{
          transition: 'all 200ms',
          overflow: isCollapsed ? 'hidden' : 'visible',
          maxHeight: isCollapsed ? 0 : 2000,
          opacity: isCollapsed ? 0 : 1,
        }}
        inert={isCollapsed}
      >
        <div
          style={{ padding: section.title ? '0 6px' : '12px 6px 0' }}
          className={section.contentClassName}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
