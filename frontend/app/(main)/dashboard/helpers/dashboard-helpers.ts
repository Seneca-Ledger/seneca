import { resolveLocaleTag } from '@/app/lib/user-format';

export function resolveLocale(locale: string): string {
  return resolveLocaleTag(locale);
}

export const statusHeadingFallback: Record<string, string> = {
  error: 'Data unavailable',
  loading: 'Loading...',
  empty: 'No data yet',
  overdue: 'Overdue payments',
  needsReview: 'Needs review',
  pendingSubmit: 'Pending submit',
  receiptsNeedReview: 'Receipts need review',
  parsingIssues: 'Parsing issues',
  uncategorized: 'Uncategorized items',
  stale: 'Data is stale',
  negativeFlow: 'Negative cash flow',
  positiveFlow: 'Positive cash flow',
  breakEven: 'Break-even period',
  allClear: 'All good',
};

export function text(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  // An intlayer node is a proxy over a React element: `.value` is answered by
  // the proxy, not held by the element, so `'value' in node` is false for it.
  if (value && typeof value === 'object') {
    const tokenValue = (value as { value?: unknown }).value;
    if (typeof tokenValue === 'string') {
      return tokenValue;
    }
  }
  return '';
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, value]) => {
    return acc.split(`{${key}}`).join(value);
  }, template);
}

/** Local YYYY-MM-DD, matching the backend's date-only format (avoids UTC-shift bugs from toISOString). */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string as a local date. `new Date('2026-03-01')` parses
 * as UTC midnight, which rolls back to the previous day in timezones behind
 * UTC — this reads the components directly instead.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export type GreetingState = 'empty' | 'pendingReview' | 'stale' | 'upToDate';

export function resolveGreetingState(params: {
  isEmptyWorkspace: boolean;
  pendingReviewCount: number;
  isStaleImport: boolean;
}): GreetingState {
  const { isEmptyWorkspace, pendingReviewCount, isStaleImport } = params;
  if (isEmptyWorkspace) {
    return 'empty';
  }
  if (pendingReviewCount > 0) {
    return 'pendingReview';
  }
  if (isStaleImport) {
    return 'stale';
  }
  return 'upToDate';
}

export function resolveDashboardGreetingData(params: {
  lastUploadDate: string | null;
  pendingReviewCount: number;
}): { isEmptyWorkspace: boolean; pendingReviewCount: number; isStaleImport: boolean } {
  const { lastUploadDate, pendingReviewCount } = params;
  const isEmptyWorkspace = !lastUploadDate;
  const daysSinceUpload = lastUploadDate
    ? Math.floor((Date.now() - new Date(lastUploadDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStaleImport = !isEmptyWorkspace && daysSinceUpload !== null && daysSinceUpload >= 14;
  return { isEmptyWorkspace, pendingReviewCount, isStaleImport };
}
