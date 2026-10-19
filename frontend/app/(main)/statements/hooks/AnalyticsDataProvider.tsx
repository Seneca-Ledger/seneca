'use client';

import type React from 'react';
import { AnalyticsDataContext } from './analytics-data-context';
import { type UseAnalyticsDataParams, useAnalyticsDataFetch } from './useAnalyticsData';

type Props = UseAnalyticsDataParams & { children: React.ReactNode };

/**
 * Fetches the analytics data once for everything below it. Each `useAnalyticsData`
 * under this provider reads the result instead of paging through /statements,
 * /transactions and the Gmail receipts again, so a page that stacks several
 * analytics views costs one load rather than one per view.
 *
 * Pass the superset the children need (`includeTransactions` when any of them
 * reads transactions).
 */
export function AnalyticsDataProvider({ children, ...params }: Props): React.JSX.Element {
  const value = useAnalyticsDataFetch(params);
  return <AnalyticsDataContext.Provider value={value}>{children}</AnalyticsDataContext.Provider>;
}
