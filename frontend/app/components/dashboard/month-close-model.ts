import type { DashboardData } from '@/app/hooks/useDashboard';
import { reviewHref } from '@/app/lib/review-links';

/** The steps that close a month, in the order they are done. */
export type CloseStepId = 'reviewed' | 'categorized' | 'receipts';

export type CloseStep = {
  id: CloseStepId;
  done: boolean;
  /** What is left in the step: exactly the items `href` lists. */
  count: number;
  href: string;
};

/** Worth a look but not a step of the close. */
export type AttentionItem =
  | { id: 'unread'; count: number; href: string }
  | { id: 'parsing'; count: number; href: string };

export type MonthCloseModel = {
  steps: CloseStep[];
  done: number;
  /** Income less spending of the rows still in Review; null once Review is empty. */
  notCounted: number | null;
  attention: AttentionItem[];
};

/**
 * What is left before the month closes. Every task is counted once, in the one
 * step it belongs to, and each step links to Review limited to `month`: the
 * server counts the step by the query that list uses, so the number is what
 * the link opens.
 */
export function buildMonthCloseModel(data: DashboardData, month: Date): MonthCloseModel {
  const health = data.dataHealth;
  const toReview = health?.statementsPendingReview ?? 0;
  const uncategorized = health?.uncategorizedTransactions ?? 0;
  const receipts = health?.receiptsPendingReview ?? 0;

  const steps: CloseStep[] = [
    { id: 'reviewed', done: toReview === 0, count: toReview, href: reviewHref(month) },
    {
      id: 'categorized',
      done: uncategorized === 0,
      count: uncategorized,
      href: reviewHref(month, { uncategorized: true }),
    },
    {
      id: 'receipts',
      done: receipts === 0,
      count: receipts,
      href: reviewHref(month, { kind: 'receipt' }),
    },
  ];

  const attention: AttentionItem[] = [];
  // A statement that could not be read has no rows to review; Documents shows it.
  const unread = health?.statementsWithErrors ?? 0;
  if (unread > 0) {
    attention.push({ id: 'unread', count: unread, href: '/statements/submit' });
  }
  const warnings = health?.parsingWarnings ?? 0;
  if (warnings > 0) {
    attention.push({ id: 'parsing', count: warnings, href: '/statements?filter=has_errors' });
  }

  return {
    steps,
    done: steps.filter(step => step.done).length,
    // Whether anything waits is a matter of rows, not of the sum: unconfirmed
    // spending makes it negative, and rows can cancel out to zero.
    notCounted: toReview > 0 ? (health?.unapprovedCash ?? 0) : null,
    attention,
  };
}
