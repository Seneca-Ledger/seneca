'use client';

import type React from 'react';
import { Plus } from '@/app/components/icons';
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
 * The category cell of something nobody has categorised yet: an empty slot the
 * shape of a category chip (dashed circle, grey "Add category"), quiet until
 * hovered. The row's own "To review" carries the alarm; this only says what to do.
 */
export function NoCategoryBadge({
  size = 22,
  onClick,
}: {
  size?: number;
  /** Makes the slot a button, e.g. one that opens the category drawer. */
  onClick?: () => void;
}): React.JSX.Element {
  const t = useIntlayer('noCategory');
  const label = resolveLabel(getNestedValue(t, ['label']));
  const hint = resolveLabel(getNestedValue(t, ['hint']));
  const content = (
    <>
      <span aria-hidden className="seneca-no-category__slot" style={{ width: size, height: size }}>
        <Plus size={Math.round(size * 0.6)} />
      </span>
      <span className="seneca-no-category__text">{label}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        data-testid="no-category-badge"
        className="seneca-no-category seneca-no-category--button"
        onClick={event => {
          // The row behind it opens the document; this opens the category drawer instead.
          event.stopPropagation();
          onClick();
        }}
      >
        {content}
      </button>
    );
  }
  return (
    <span data-testid="no-category-badge" title={hint} className="seneca-no-category">
      {content}
    </span>
  );
}
