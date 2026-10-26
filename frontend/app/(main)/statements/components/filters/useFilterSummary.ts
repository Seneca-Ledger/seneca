'use client';

import { useIntlayer, useLocale } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { type FilterSpan, summarizeFilters } from './filter-summary';

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/**
 * Builds a page heading's summary: "{subject} between {from} and {to}" and the
 * other filters after it. `subject` is the pair "All expenses" / "Expenses",
 * or one word when the page has no "all" form (a tab name).
 */
export function useFilterSummary(): (
  subject: string | { all: string; some: string },
  span: FilterSpan,
  extras: string[],
) => string {
  const t = useIntlayer('transactionsPageTitle');
  const { locale } = useLocale();
  const tx = (key: string): string => resolveLabel(getNestedValue(t, [key]));
  const templates = {
    between: tx('between'),
    on: tx('on'),
    after: tx('after'),
    before: tx('before'),
    since: tx('since'),
    until: tx('until'),
    allTime: tx('allTime'),
  };
  return (subject, span, extras) => {
    const { all, some } = typeof subject === 'string' ? { all: subject, some: subject } : subject;
    return summarizeFilters(
      span,
      extras,
      { ...templates, subjectAll: all, subjectSome: some },
      date => formatStoredDateWithOptions(date, LONG_DATE, locale),
    );
  };
}
