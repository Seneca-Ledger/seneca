'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { hasChosenCategory } from '@/app/components/categories/NoCategoryBadge';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import type { Transaction } from '../editHelpers';

type CategoryChipProps = {
  category: Transaction['category'] | null;
  locale: string;
  noCategoryLabel: string;
  assignCategoryLabel: string;
  /** Shown instead of a category, e.g. when a payee's rows were filed differently. */
  label?: string;
  /**
   * The category is only suggested: dashed, with a hollow dot, until the row
   * is accepted. The text says so to a screen reader ("Suggested: Groceries").
   */
  suggestedLabel?: string;
  onClick: () => void;
};

/**
 * The category as text behind a small dot, not a filled pill down the whole
 * column: a light frame shows on the row under the pointer, saying it can be
 * changed. No category (or the fallback) is an ochre dot, a thing to do rather
 * than an error. A suggested category is dashed until accepted. A click opens
 * the category drawer.
 */
export function CategoryChip({
  category,
  locale,
  noCategoryLabel,
  assignCategoryLabel,
  label,
  suggestedLabel,
  onClick,
}: CategoryChipProps): React.ReactElement {
  const missing = !(label || hasChosenCategory(category?.name));
  const isDisabled = !label && category?.isEnabled === false;
  const displayName =
    label ??
    (category?.name
      ? getCategoryDisplayName(
          { name: category.name, source: category.source, isSystem: category.isSystem },
          locale,
        )
      : noCategoryLabel);
  return (
    <ButtonBase
      onClick={event => {
        event.stopPropagation();
        onClick();
      }}
      className="seneca-stmt-edit-table__category"
      aria-label={suggestedLabel ? `${suggestedLabel}: ${displayName}` : undefined}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.25,
        ml: -1,
        borderRadius: 999,
        border: suggestedLabel ? '1px dashed var(--border)' : '1px solid transparent',
        fontSize: 13.5,
        fontFamily: 'inherit',
        color: missing || label || suggestedLabel ? 'var(--text-muted)' : 'var(--foreground)',
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          boxSizing: 'border-box',
          border: suggestedLabel ? '1px solid var(--muted-foreground)' : 'none',
          bgcolor: suggestedLabel
            ? 'transparent'
            : missing || isDisabled
              ? 'var(--attention)'
              : 'var(--muted-foreground)',
        }}
      />
      {isDisabled ? `${displayName} — ${assignCategoryLabel}` : displayName}
    </ButtonBase>
  );
}
