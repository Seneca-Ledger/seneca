import { fillTemplate } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { reviewHref } from '@/app/lib/review-links';

export interface RelativeTimeLabels {
  today: string;
  yesterday: string;
  daysAgo: string;
  oneWeekAgo: string;
  weeksAgo: string;
  oneMonthAgo: string;
  monthsAgo: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function getRelativeTime(
  isoDate: string,
  labels: RelativeTimeLabels,
  now: Date = new Date(),
): string {
  const diffDays = Math.floor((now.getTime() - new Date(isoDate).getTime()) / DAY_MS);
  if (diffDays === 0) {
    return labels.today;
  }
  if (diffDays === 1) {
    return labels.yesterday;
  }
  if (diffDays < 7) {
    return fillTemplate(labels.daysAgo, { n: String(diffDays) });
  }
  if (diffDays < 14) {
    return labels.oneWeekAgo;
  }
  if (diffDays < 30) {
    return fillTemplate(labels.weeksAgo, { n: String(Math.floor(diffDays / 7)) });
  }
  if (diffDays < 60) {
    return labels.oneMonthAgo;
  }
  return fillTemplate(labels.monthsAgo, { n: String(Math.floor(diffDays / 30)) });
}

export type DataHealthMetricKey =
  | 'uncategorizedTransactions'
  | 'statementsWithErrors'
  | 'statementsPendingReview'
  | 'receiptsPendingReview'
  | 'parsingWarnings';

export interface DataHealthMetric {
  key: DataHealthMetricKey;
  value: number;
  href: string;
}

/**
 * The month's data checks, in the order the tab lists them. What Review lists
 * links to Review for `month`, where the server counts it by the same query.
 */
export function buildDataHealthMetrics(
  health: DashboardData['dataHealth'],
  month: Date,
): DataHealthMetric[] {
  return [
    {
      key: 'uncategorizedTransactions',
      value: health.uncategorizedTransactions,
      href: reviewHref(month, { uncategorized: true }),
    },
    {
      key: 'statementsWithErrors',
      value: health.statementsWithErrors,
      href: '/statements?status=error',
    },
    {
      key: 'statementsPendingReview',
      value: health.statementsPendingReview,
      href: reviewHref(month),
    },
    {
      key: 'receiptsPendingReview',
      value: health.receiptsPendingReview,
      href: reviewHref(month, { kind: 'receipt' }),
    },
    {
      key: 'parsingWarnings',
      value: health.parsingWarnings,
      href: '/statements?filter=has_errors',
    },
  ];
}
