import { formatMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';

/** The query parameters Review opens with; the dashboard writes them, Review reads them. */
export const REVIEW_LINK_PARAMS = {
  month: 'month',
  kind: 'kind',
  uncategorized: 'uncategorized',
} as const;

export interface ReviewLink {
  /** The list to open on; the rows when absent. */
  kind?: 'receipt';
  /** Rows with no category, confirmed or not, instead of the unconfirmed ones. */
  uncategorized?: boolean;
}

/**
 * Review limited to the dashboard's month, so the count on the dashboard is the
 * number of items the link opens: both sides count that month by the same dates.
 */
export function reviewHref(month: Date, link: ReviewLink = {}): string {
  const params = new URLSearchParams();
  if (link.kind) {
    params.set(REVIEW_LINK_PARAMS.kind, link.kind);
  }
  if (link.uncategorized) {
    params.set(REVIEW_LINK_PARAMS.uncategorized, 'true');
  }
  params.set(REVIEW_LINK_PARAMS.month, formatMonthParam(month));
  return `/review?${params.toString()}`;
}
