/**
 * Returns page state that lives in the URL (`?tab=calculator&range=5y`) so a
 * reload or a shared link lands on the same view. Pure helpers, no React.
 */

export const ROI_TABS = ['performance', 'calculator'] as const;
export type RoiTab = (typeof ROI_TABS)[number];
export const DEFAULT_ROI_TAB: RoiTab = 'performance';

/** The windows the performance tab offers, shortest first. */
export const RETURNS_RANGES = ['30d', 'ytd', '1y', '3y', '5y', 'all'] as const;
export type ReturnsRange = (typeof RETURNS_RANGES)[number];
export const DEFAULT_RETURNS_RANGE: ReturnsRange = '1y';

export function parseRoiTab(value: string | null | undefined): RoiTab {
  return (ROI_TABS as readonly string[]).includes(value ?? '')
    ? (value as RoiTab)
    : DEFAULT_ROI_TAB;
}

export function parseReturnsRange(value: string | null | undefined): ReturnsRange {
  return (RETURNS_RANGES as readonly string[]).includes(value ?? '')
    ? (value as ReturnsRange)
    : DEFAULT_RETURNS_RANGE;
}

/**
 * Applies a patch to the current query; `null` removes a key, and a default
 * value is left out so the plain address stays the plain address.
 */
export function withRoiParams(
  current: URLSearchParams | string,
  patch: { tab?: RoiTab | null; range?: ReturnsRange | null },
): string {
  const next = new URLSearchParams(current);
  const defaults: Record<string, string> = { tab: DEFAULT_ROI_TAB, range: DEFAULT_RETURNS_RANGE };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    if (value === null || value === defaults[key]) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next.toString();
}
