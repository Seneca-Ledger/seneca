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
  | { id: 'overdue'; count: number; amount: number; href: string }
  | { id: 'overspent'; amount: number; href: string }
  | { id: 'unread'; count: number; href: string }
  | { id: 'parsing'; count: number; href: string };

export type FinanceOpsModel = {
  steps: CloseStep[];
  done: number;
  attention: AttentionItem[];
};

/**
 * The Finance ops tab as one question: what is left before the month closes.
 * Every task is counted once, in the one step it belongs to, and each step
 * links to Review limited to `month`: the server counts the step by the query
 * that list uses, so the number is what the link opens.
 */
export function buildFinanceOpsModel(data: DashboardData, month: Date): FinanceOpsModel {
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
  const overdue = data.actions?.find(action => action.type === 'payments_overdue');
  const overdueAmount = data.snapshot?.totalOverdue ?? 0;
  if (overdue && overdue.count > 0) {
    attention.push({
      id: 'overdue',
      count: overdue.count,
      amount: overdueAmount,
      href: '/statements/pay?status=overdue',
    });
  }
  const overspent = (data.snapshot?.expense30d ?? 0) - (data.snapshot?.income30d ?? 0);
  if (overspent > 0) {
    attention.push({ id: 'overspent', amount: overspent, href: '/reports?tab=cash-flow' });
  }
  // A statement that could not be read has no rows to review; Documents shows it.
  const unread = health?.statementsWithErrors ?? 0;
  if (unread > 0) {
    attention.push({ id: 'unread', count: unread, href: '/statements/submit' });
  }
  const warnings = health?.parsingWarnings ?? 0;
  if (warnings > 0) {
    attention.push({ id: 'parsing', count: warnings, href: '/statements?filter=has_errors' });
  }

  return { steps, done: steps.filter(step => step.done).length, attention };
}
