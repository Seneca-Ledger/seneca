/**
 * Opens the Top categories leaderboard on a month with that category's row
 * ringed — the same `?month=&focus=category:<name>` contract advice links use
 * (app/components/insights/insight-href.ts, read by app/hooks/useAttentionFocus.ts).
 * The leaderboard has no category ids, so rows are keyed by the lowercased name.
 *
 * @param month `YYYY-MM`; without it the report opens on its own default month.
 */
export function categoryReportHref(categoryName: string, month?: string | null): string {
  const params = new URLSearchParams();
  if (month) {
    params.set('month', month);
  }
  params.set('focus', `category:${categoryName.trim().toLowerCase()}`);
  return `/reports?tab=cash-flow&${params.toString()}`;
}
