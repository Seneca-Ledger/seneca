'use client';

import Link from 'next/link';
import React from 'react';
import { formatMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { tagReportHref } from '@/app/lib/category-report-href';
import { resolveStatementSortDate } from './StatementsListView.utils';
import { textCellStyle } from './statements-list-item.cells';
import type { StatementListItem } from './statements-list-item.types';
import { useDwellLink } from './use-dwell-link';

/** The statement's own month, `YYYY-MM`, for the report its links open. */
export const statementMonth = (statement: StatementListItem): string | null => {
  const sortDate = resolveStatementSortDate(statement);
  return sortDate > 0 ? formatMonthParam(new Date(sortDate)) : null;
};

/** One tag of the Tag column: lights up on a resting pointer and opens its By tag row. */
export function TagLink({
  name,
  month,
  title,
}: {
  name: string;
  month: string | null;
  title: string;
}): React.JSX.Element {
  const { lit, linkProps } = useDwellLink();
  return (
    <Link
      href={tagReportHref(name, month)}
      className={`seneca-stmt-category-link seneca-stmt-tag-link${lit ? ' seneca-stmt-category-link--lit' : ''}`}
      title={title}
      {...linkProps}
    >
      <span
        className="seneca-stmt-category-link__text"
        data-label={name}
        style={{ ...textCellStyle('tag'), width: 'auto', minWidth: 0 }}
      >
        {name}
      </span>
    </Link>
  );
}
