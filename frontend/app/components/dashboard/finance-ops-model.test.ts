import type { DashboardData } from '@/app/hooks/useDashboard';
import { describe, expect, it } from 'vitest';

import { type FinanceOpsLabels, buildFinanceOpsModel } from './finance-ops-model';

const labels: FinanceOpsLabels = {
  checklist: {
    statementsImported: 'Statements imported and submitted',
    reviewQueueClear: 'Statement review queue is clear',
    categoriesResolved: 'Uncategorized transactions are resolved',
    receiptsMatched: 'Receipts are matched or reviewed',
    cashReconciled: 'Unapproved cash is reconciled',
  },
  savedViews: {
    uncategorized: 'Uncategorized',
    needsReceipt: 'Needs receipt',
    statementReview: 'Statement review',
    largeExpenses: 'Large expenses',
    monthClose: 'This month close',
  },
  pluralStatement: '{count} statements',
  pluralWarning: '{count} warnings',
  pluralTransaction: '{count} transactions',
  pluralReceipt: '{count} receipts',
  features: {
    importReviewInbox: {
      title: 'Import Review Inbox',
      summary: 'One queue for submitted statements, parse warnings, errors, and pending review.',
      primaryActionOpen: 'Open review queue',
      primaryActionImport: 'Import statement',
      evidence: '{statements} in review, {warnings}',
    },
    transactionTriageMode: {
      title: 'Transaction Triage Mode',
      summary:
        'Process uncategorized transactions as an approval queue instead of hunting in tables.',
      primaryAction: 'Start triage',
      evidence: '{transactions}',
    },
    smartCategorySuggestions: {
      title: 'Smart Category Suggestions',
      summary: 'Explain category work with merchant history, team rules, and high-volume patterns.',
      primaryAction: 'Review category rules',
      evidenceTopCategory: 'Top category: {name}',
      evidenceNoPressure: 'No category pressure detected',
    },
    periodCloseChecklistFeature: {
      title: 'Period Close Checklist',
      summary:
        'Make month close explicit: imports, review, categories, receipts, and cash approval.',
      primaryActionResolve: 'Resolve blockers',
      primaryActionExport: 'Export reports',
      evidence: '{done}/{total} checks complete',
    },
    anomalyDetectionFeed: {
      title: 'Anomaly Detection Feed',
      summary: 'Surface unusual spend, overdue payables, new merchants, and concentration risk.',
      primaryAction: 'Inspect anomalies',
      evidenceOverdue: '{amount} overdue',
      evidenceTopMerchant: 'Top merchant: {name}',
      evidenceNone: 'none',
    },
    reconciliationDashboard: {
      title: 'Reconciliation Dashboard',
      summary: 'Show income minus expenses, unapproved cash, and balance confidence in one place.',
      primaryAction: 'Open reconciliation',
      evidence: 'Net flow: {netFlow}; unapproved: {unapproved}',
    },
    savedViewsTeamFilters: {
      title: 'Saved Views & Team Filters',
      summary: 'Give the team stable operational views for daily review and month close.',
      primaryAction: 'Open saved views',
      evidence: '{count} team views ready',
    },
    receiptMatchingAssistant: {
      title: 'Receipt Matching Assistant',
      summary: 'Keep unmatched receipts visible until they are linked, approved, or dismissed.',
      primaryAction: 'Match receipts',
      evidence: '{receipts}',
    },
    actionableNotifications: {
      title: 'Actionable Notifications',
      summary: 'Turn dashboard action items into direct links to the work that remains.',
      primaryActionOpen: 'Open first action',
      primaryActionNone: 'No action needed',
      evidenceAllClear: 'All operational actions are clear',
    },
    explainThisNumber: {
      title: 'Explain This Number',
      summary:
        'Connect every headline number to source transactions, categories, and period changes.',
      primaryAction: 'Explain report numbers',
      evidenceTopCategoryAmount: '{name}: {amount}',
      evidenceBalance: 'Balance: {amount}',
    },
  },
};

const baseData: DashboardData = {
  snapshot: {
    totalBalance: 125000,
    income30d: 90000,
    expense30d: 65000,
    netFlow30d: 25000,
    totalPayable: 12000,
    totalOverdue: 3000,
    unapprovedCash: 5000,
    currency: 'KZT',
  },
  actions: [
    {
      type: 'transactions_uncategorized',
      count: 7,
      label: '7 transactions uncategorized',
      href: '/statements/submit?categoryId=uncategorized',
    },
    {
      type: 'statements_pending_review',
      count: 2,
      label: '2 statements need review',
      href: '/review',
    },
  ],
  cashFlow: [],
  topMerchants: [{ name: 'Acme Ltd', amount: 42000, count: 3 }],
  topCategories: [
    {
      id: 'cat-1',
      name: 'Operations',
      color: '#3b82f6',
      icon: null,
      amount: 33000,
      count: 4,
      percent: 40,
    },
  ],
  recentTransactions: [],
  role: 'owner',
  range: '30d',
  dataHealth: {
    uncategorizedTransactions: 7,
    statementsWithErrors: 1,
    statementsPendingReview: 2,
    statementsPendingSubmit: 3,
    receiptsPendingReview: 4,
    unapprovedCash: 5000,
    lastUploadDate: '2026-05-01T00:00:00.000Z',
    parsingWarnings: 6,
  },
};

describe('buildFinanceOpsModel', () => {
  it('builds ten workflow features with pending counters from dashboard data', () => {
    const model = buildFinanceOpsModel(baseData, value => `${value} KZT`, labels);

    expect(model.features).toHaveLength(10);
    expect(model.totalPending).toBeGreaterThan(0);
    expect(model.features.map(feature => feature.title)).toEqual([
      'Import Review Inbox',
      'Transaction Triage Mode',
      'Smart Category Suggestions',
      'Period Close Checklist',
      'Anomaly Detection Feed',
      'Reconciliation Dashboard',
      'Saved Views & Team Filters',
      'Receipt Matching Assistant',
      'Actionable Notifications',
      'Explain This Number',
    ]);
    expect(model.features[0].pendingCount).toBe(12);
    expect(model.features[1].pendingCount).toBe(7);
    expect(model.features[3].status).toBe('blocked');
  });

  it('marks period close ready when there is no pending work', () => {
    const model = buildFinanceOpsModel(
      {
        ...baseData,
        actions: [],
        snapshot: { ...baseData.snapshot, totalOverdue: 0, unapprovedCash: 0 },
        dataHealth: {
          uncategorizedTransactions: 0,
          statementsWithErrors: 0,
          statementsPendingReview: 0,
          statementsPendingSubmit: 0,
          receiptsPendingReview: 0,
          unapprovedCash: 0,
          lastUploadDate: '2026-05-01T00:00:00.000Z',
          parsingWarnings: 0,
        },
      },
      value => `${value} KZT`,
      labels,
    );

    expect(model.totalPending).toBe(0);
    expect(model.features[3].status).toBe('ready');
    expect(model.closeChecklist.every(item => item.done)).toBe(true);
  });

  it('routes every action to a destination that can resolve it', () => {
    const model = buildFinanceOpsModel(baseData, value => `${value} KZT`, labels);
    const hrefOf = (id: string): string | undefined =>
      model.features.find(feature => feature.id === id)?.href;

    // Period close sends the user to the first unresolved control, not a report.
    expect(hrefOf('period-close-checklist')).toBe('/statements/submit');
    // Anomalies open the overdue payables the evidence line is quoting.
    expect(hrefOf('anomaly-feed')).toBe('/statements/pay?status=overdue');
    expect(hrefOf('reconciliation-dashboard')).toBe('/review');
    // Nothing may link back to the page the tab already lives on.
    expect(model.features.map(feature => feature.href)).not.toContain('/dashboard');
  });

  it('falls back to top merchants for anomalies when nothing is overdue', () => {
    const model = buildFinanceOpsModel(
      { ...baseData, snapshot: { ...baseData.snapshot, totalOverdue: 0 } },
      value => `${value} KZT`,
      labels,
    );

    expect(model.features.find(feature => feature.id === 'anomaly-feed')?.href).toBe(
      '/reports?tab=cash-flow',
    );
  });
});
