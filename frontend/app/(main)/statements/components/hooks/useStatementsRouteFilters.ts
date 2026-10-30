import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

function resolveRouteFilterLabel(
  routeCategoryId: string | null,
  routeReceiptStatus: string | null,
): string | null {
  if (routeCategoryId === 'uncategorized') {
    return 'Missing category';
  }
  if (routeCategoryId) {
    return 'Category filter';
  }
  return routeReceiptStatus ? 'Status filter' : null;
}

/**
 * Filters a link brings in the query string (a dashboard widget's category,
 * a chart's merchant and period, a receipt status), which the drawer never
 * shows, and the way to clear them.
 */
export function useStatementsRouteFilters({
  router,
  searchParams,
  setPage,
}: {
  router: AppRouterInstance;
  searchParams: ReadonlyURLSearchParams;
  setPage: (page: number) => void;
}) {
  const routeCategoryId = useMemo(() => {
    const categoryId = searchParams.get('categoryId');
    if (categoryId) {
      return categoryId;
    }
    return searchParams.get('missingCategory') === 'true' ? 'uncategorized' : null;
  }, [searchParams]);
  // A chart links its category or merchant with its period: only that period's rows count.
  const routeMerchant = searchParams.get('merchant');
  const transactionsFrom = searchParams.get('transactionsFrom');
  const transactionsTo = searchParams.get('transactionsTo');
  const routeRowsFilter = useMemo(
    () =>
      routeMerchant || transactionsFrom || transactionsTo
        ? {
            ...(routeMerchant ? { merchant: routeMerchant } : {}),
            ...(transactionsFrom ? { transactionsFrom } : {}),
            ...(transactionsTo ? { transactionsTo } : {}),
          }
        : null,
    [routeMerchant, transactionsFrom, transactionsTo],
  );
  const routeReceiptStatus = useMemo(() => searchParams.get('status') || null, [searchParams]);
  const routeFilterLabel =
    resolveRouteFilterLabel(routeCategoryId, routeReceiptStatus) ??
    (routeMerchant ? 'Merchant filter' : null);
  // Dashboard widgets link here with the filter in the query string, where the
  // drawer never shows it. Resetting has to clear it too, or the list stays
  // filtered by something the user cannot see.
  const resetRouteFilters = useCallback((): void => {
    if (!(routeCategoryId || routeReceiptStatus || routeMerchant)) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('categoryId');
    nextParams.delete('missingCategory');
    nextParams.delete('merchant');
    nextParams.delete('transactionsFrom');
    nextParams.delete('transactionsTo');
    nextParams.delete('status');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/statements/submit?${nextQuery}` : '/statements/submit');
    setPage(1);
  }, [routeCategoryId, routeReceiptStatus, routeMerchant, router, searchParams]);

  return {
    routeCategoryId,
    routeMerchant,
    routeRowsFilter,
    routeReceiptStatus,
    routeFilterLabel,
    resetRouteFilters,
  };
}
