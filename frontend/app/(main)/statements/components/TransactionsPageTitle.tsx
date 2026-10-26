'use client';

import { Shuffle } from '@/app/components/icons';
import { PageTitle } from '@/app/components/ui/page-title';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import type { FilterSpan } from './filters/filter-summary';
import { useFilterSummary } from './filters/useFilterSummary';

type TransactionsPage = 'all' | 'statements' | 'expenses' | 'income';

const PATHS: Record<TransactionsPage, string> = {
  all: '/statements/transactions',
  statements: '/statements',
  expenses: '/statements/pay',
  income: '/statements/receive',
};

/**
 * The heading of each page in the sidebar's Transactions group, with the
 * group's icon. Beside it a line says what the list shows right now: the
 * period and every other filter in force.
 */
export function TransactionsPageTitle({
  page,
  span,
  extras,
}: {
  page: TransactionsPage;
  span: FilterSpan;
  extras: string[];
}): React.JSX.Element {
  const t = useIntlayer('transactionsPageTitle');
  const summarize = useFilterSummary();
  const summary = summarize(
    {
      all: resolveLabel(getNestedValue(t, [`${page}All`])),
      some: resolveLabel(getNestedValue(t, [`${page}Some`])),
    },
    span,
    extras,
  );

  return <PageTitle path={PATHS[page]} icon={<Shuffle />} summary={summary} />;
}
