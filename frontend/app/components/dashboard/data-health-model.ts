import { fillTemplate } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import type { DashboardData } from '@/app/hooks/useDashboard';
import type { KpiTone } from './ui';

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

export interface DataHealthMetric {
  key: string;
  label: string;
  value: number;
  tone: KpiTone;
  href: string;
}

export interface DataHealthQuickLink {
  id: string;
  type: string;
  label: string;
  href: string;
}

export interface DataHealthLabels {
  uncategorized: string;
  statementErrors: string;
  pendingReview: string;
  receiptsPending: string;
  parsingWarnings: string;
  quickLinkUncategorized: string;
  quickLinkStatementErrors: string;
  quickLinkPendingStatements: string;
  quickLinkReceipts: string;
}

export const HREFS = {
  uncategorized: '/statements/submit?categoryId=uncategorized',
  statementErrors: '/statements?status=error',
  pendingReview: '/review',
  receipts: '/statements/submit?status=needs_review',
  parsingWarnings: '/statements?filter=has_errors',
} as const;

function tone(value: number, severe: KpiTone): KpiTone {
  return value > 0 ? severe : 'positive';
}

export function buildDataHealthMetrics(
  health: DashboardData['dataHealth'],
  labels: DataHealthLabels,
): DataHealthMetric[] {
  return [
    {
      key: 'uncategorizedTransactions',
      label: labels.uncategorized,
      value: health.uncategorizedTransactions,
      tone: tone(health.uncategorizedTransactions, 'warning'),
      href: HREFS.uncategorized,
    },
    {
      key: 'statementsWithErrors',
      label: labels.statementErrors,
      value: health.statementsWithErrors,
      tone: tone(health.statementsWithErrors, 'negative'),
      href: HREFS.statementErrors,
    },
    {
      key: 'statementsPendingReview',
      label: labels.pendingReview,
      value: health.statementsPendingReview,
      tone: tone(health.statementsPendingReview, 'info'),
      href: HREFS.pendingReview,
    },
    {
      key: 'receiptsPendingReview',
      label: labels.receiptsPending,
      value: health.receiptsPendingReview,
      tone: tone(health.receiptsPendingReview, 'warning'),
      href: HREFS.receipts,
    },
    {
      key: 'parsingWarnings',
      label: labels.parsingWarnings,
      value: health.parsingWarnings,
      tone: tone(health.parsingWarnings, 'warning'),
      href: HREFS.parsingWarnings,
    },
  ];
}

export function buildDataHealthQuickLinks(
  health: DashboardData['dataHealth'],
  labels: DataHealthLabels,
): DataHealthQuickLink[] {
  const links: DataHealthQuickLink[] = [];
  const push = (id: string, type: string, template: string, count: number, href: string): void => {
    if (count > 0) {
      links.push({ id, type, label: fillTemplate(template, { count: String(count) }), href });
    }
  };
  push(
    'uncategorized-transactions',
    'transactions_uncategorized',
    labels.quickLinkUncategorized,
    health.uncategorizedTransactions,
    HREFS.uncategorized,
  );
  push(
    'statement-errors',
    'parsing_warnings',
    labels.quickLinkStatementErrors,
    health.statementsWithErrors,
    HREFS.statementErrors,
  );
  push(
    'pending-statements',
    'statements_pending_review',
    labels.quickLinkPendingStatements,
    health.statementsPendingReview,
    HREFS.pendingReview,
  );
  push(
    'pending-receipts',
    'receipts_pending_review',
    labels.quickLinkReceipts,
    health.receiptsPendingReview,
    HREFS.receipts,
  );
  return links;
}
