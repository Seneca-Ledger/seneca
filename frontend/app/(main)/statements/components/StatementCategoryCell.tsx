'use client';

import Link from 'next/link';
import type React from 'react';
import { hasChosenCategory, NoCategoryBadge } from '@/app/components/categories/NoCategoryBadge';
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import { Check } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { categoryReportHref } from '@/app/lib/category-report-href';
import { EMPTY_CELL, textCellStyle } from './statements-list-item.cells';
import { useDwellLink } from './use-dwell-link';

/**
 * The category cell of a statement with several rows. The statement has no
 * category of its own: each row takes one, from what the user taught about its
 * payee or by hand. The cell says how many still wait, and opens them under the
 * line; once none do, it says so.
 */
function StatementRowsCategory({
  uncategorizedCount,
  onOpenRows,
}: {
  uncategorizedCount: number;
  onOpenRows?: () => void;
}): React.JSX.Element {
  const text = useIntlayer('statementsListUi');
  if (uncategorizedCount === 0) {
    return (
      <span className="seneca-no-category seneca-no-category--done">
        <Check size={14} aria-hidden />
        <span className="seneca-no-category__text">{text.rowsAllCategorized.value}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid="statement-rows-uncategorized"
      className="seneca-no-category seneca-no-category--button"
      onClick={event => {
        // The row behind it opens the document; this opens its rows instead.
        event.stopPropagation();
        onOpenRows?.();
      }}
    >
      <span className="seneca-no-category__text">
        {text.rowsUncategorized.value.replace('{count}', String(uncategorizedCount))}
      </span>
    </button>
  );
}

/**
 * The Category cell of a documents row. A receipt or a one-row statement is
 * one purchase: its category links to its report, or an empty slot asks for
 * one. A statement with several rows shows how many of them still wait.
 */
export function StatementCategoryCell({
  category,
  label,
  text,
  month,
  rowsCount,
  uncategorizedCount,
  isReceipt,
  busy,
  pending,
  onAddCategory,
  onOpenRows,
}: {
  category?: { color?: string | null; icon?: string | null } | null;
  label: string | null;
  text: string | null;
  month: string | null;
  rowsCount: number;
  uncategorizedCount: number;
  isReceipt: boolean;
  /** Processing, or failed: nothing to ask for yet. */
  busy: boolean;
  /** Uploaded and not parsed yet. */
  pending: boolean;
  onAddCategory?: () => void;
  onOpenRows?: () => void;
}): React.JSX.Element {
  const listText = useIntlayer('statementsListUi');
  const { lit, linkProps } = useDwellLink();
  if (!isReceipt && rowsCount > 1 && !busy) {
    return (
      <StatementRowsCategory uncategorizedCount={uncategorizedCount} onOpenRows={onOpenRows} />
    );
  }
  if (!hasChosenCategory(label)) {
    return busy || pending ? (
      <span style={textCellStyle('category', true)}>{EMPTY_CELL}</span>
    ) : (
      <NoCategoryBadge onClick={onAddCategory} />
    );
  }
  return (
    <Link
      href={categoryReportHref(label, month)}
      className={`seneca-stmt-category-link${lit ? ' seneca-stmt-category-link--lit' : ''}`}
      {...linkProps}
      title={listText.categoryLink.value.replace('{category}', text ?? label)}
    >
      <span className="seneca-stmt-category-link__badge">
        <CategoryIconBadge name={label} color={category?.color} icon={category?.icon} size={22} />
      </span>
      <span
        className="seneca-stmt-category-link__text"
        data-label={text}
        style={{ ...textCellStyle('category'), width: 'auto', minWidth: 0 }}
      >
        {text}
      </span>
    </Link>
  );
}
