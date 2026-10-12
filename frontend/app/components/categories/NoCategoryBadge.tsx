'use client';

import type React from 'react';
import { CircleHelp } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';

/** The workspace's fallback category: on screen it means the same as none. */
const UNCATEGORIZED_NAME = 'uncategorized';

/** Whether a row or document has a category someone actually chose. */
export function hasChosenCategory(name: string | null | undefined): name is string {
  const normalized = (name ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== UNCATEGORIZED_NAME;
}

/**
 * The category cell of something nobody has categorised yet. Said in words, in
 * the place a category chip would stand, so it reads as "still to do" rather
 * than as an empty cell.
 */
export function NoCategoryBadge({ size = 22 }: { size?: number }): React.JSX.Element {
  const t = useIntlayer('noCategory');
  const label = resolveLabel(getNestedValue(t, ['label']), 'No category');
  const hint = resolveLabel(getNestedValue(t, ['hint']), label);
  return (
    <span
      data-testid="no-category-badge"
      title={hint}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        color: 'var(--color-warning-soft-text)',
        fontWeight: 600,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: '50%',
          border: '1px dashed var(--color-warning-soft-border)',
          background: 'var(--color-warning-soft-bg)',
        }}
      >
        <CircleHelp size={Math.round(size * 0.6)} />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </span>
  );
}
