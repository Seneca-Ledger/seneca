import { describe, expect, it } from 'vitest';
import type { DashboardData } from '@/app/hooks/useDashboard';

import { buildMonthCloseModel } from './month-close-model';

const dashboard = (dataHealth: Partial<DashboardData['dataHealth']> = {}): DashboardData =>
  (({
    dataHealth: {
      uncategorizedTransactions: 0,
      statementsWithErrors: 0,
      statementsPendingReview: 0,
      statementsPendingSubmit: 0,
      receiptsPendingReview: 0,
      unapprovedCash: 0,
      lastUploadDate: null,
      parsingWarnings: 0,
      ...dataHealth,
    }
  }) as DashboardData);

const OCTOBER = new Date(2026, 9, 1);

describe('buildMonthCloseModel', () => {
  it('is one list of the steps to close the month, each with what is left', () => {
    const model = buildMonthCloseModel(
      dashboard({
        statementsPendingSubmit: 1,
        statementsPendingReview: 2,
        uncategorizedTransactions: 6,
      }),
      OCTOBER,
    );

    expect(model.steps.map(step => [step.id, step.count, step.done])).toEqual([
      ['reviewed', 2, false],
      ['categorized', 6, false],
      ['receipts', 0, true],
    ]);
    expect(model.done).toBe(1);
  });

  // The server counts each step by the query the linked Review list runs (see
  // backend @tests/integration/month-close-review.spec.ts); this side has to
  // show that number unchanged and link to that list for the same month.
  it('shows each count as the server sent it and links to the Review list it counts', () => {
    const model = buildMonthCloseModel(
      dashboard({
        statementsPendingReview: 3,
        uncategorizedTransactions: 4,
        receiptsPendingReview: 1,
        statementsWithErrors: 2,
        statementsPendingSubmit: 5,
      }),
      OCTOBER,
    );

    expect(model.steps.map(step => [step.id, step.count, step.href])).toEqual([
      ['reviewed', 3, '/review?month=2026-10'],
      ['categorized', 4, '/review?uncategorized=true&month=2026-10'],
      ['receipts', 1, '/review?kind=receipt&month=2026-10'],
    ]);
  });

  it('lists statements that could not be read as attention, not as rows to review', () => {
    const model = buildMonthCloseModel(dashboard({ statementsWithErrors: 1 }), OCTOBER);

    expect(model.steps.every(step => step.done)).toBe(true);
    expect(model.attention).toEqual([{ id: 'unread', count: 1, href: '/statements/submit' }]);
  });

  it('lists what else needs attention only when there is something', () => {
    expect(buildMonthCloseModel(dashboard(), OCTOBER).attention).toEqual([]);

    const model = buildMonthCloseModel(dashboard({ parsingWarnings: 3 }), OCTOBER);

    expect(model.attention).toEqual([
      { id: 'parsing', count: 3, href: '/statements?filter=has_errors' },
    ]);
  });

  it('tells the money not counted yet while Review has rows, even when it is spending', () => {
    const waiting = dashboard({ statementsPendingReview: 2, unapprovedCash: -40 });
    const confirmed = dashboard({ statementsPendingReview: 0, unapprovedCash: 0 });

    expect(buildMonthCloseModel(waiting, OCTOBER).notCounted).toBe(-40);
    expect(buildMonthCloseModel(confirmed, OCTOBER).notCounted).toBeNull();
  });
});
