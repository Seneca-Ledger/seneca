import { resolveStatementViewAction } from '@/app/(main)/statements/components/StatementsListView.utils';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';

/** The charts' id for spending with no category. */
const NO_CATEGORY = '__none__';

/** What a chart band stands for: a category, a merchant, or a merchant within a category. */
export type RowsTarget = { categoryId?: string; merchant?: string };

/** Documents filtered to the target's rows in the chart's period. */
export function documentsHref(target: RowsTarget, from: string, to: string): string {
  const search = new URLSearchParams();
  if (target.categoryId === NO_CATEGORY) search.set('missingCategory', 'true');
  else if (target.categoryId) search.set('categoryId', target.categoryId);
  if (target.merchant) search.set('merchant', target.merchant);
  search.set('transactionsFrom', from);
  search.set('transactionsTo', to);
  return `/statements/submit?${search.toString()}`;
}

/** Where a click on a band leads: its one document, or the filtered list. */
export async function resolveDocumentsHref(
  target: RowsTarget,
  from: string,
  to: string,
): Promise<string> {
  const listHref = documentsHref(target, from, to);
  try {
    const rows = await apiQueryDecoded({
      url: '/statements',
      params: {
        ...(target.categoryId
          ? { categoryId: target.categoryId === NO_CATEGORY ? 'uncategorized' : target.categoryId }
          : {}),
        ...(target.merchant ? { merchant: target.merchant } : {}),
        transactionsFrom: from,
        transactionsTo: to,
        page: 1,
        // Two are enough to know it is not one.
        limit: 2,
      } satisfies ContractInput<'StatementsQuery'>,
      contract: 'StatementList',
    });
    return rows.length === 1 ? resolveStatementViewAction(rows[0]).href : listHref;
  } catch {
    // The list shows its own error; the click still goes somewhere useful.
    return listHref;
  }
}
