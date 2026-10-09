import { fillTemplate } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import type { DashboardActionItem, DashboardData } from '@/app/hooks/useDashboard';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';

export type FinanceOpsFeatureStatus = 'ready' | 'review' | 'blocked';

export type FinanceOpsFeature = {
  id: string;
  title: string;
  summary: string;
  pendingCount: number;
  status: FinanceOpsFeatureStatus;
  href: string;
  primaryAction: string;
  evidence: string;
};

export type FinanceOpsChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export type FinanceOpsModel = {
  totalPending: number;
  closeChecklist: FinanceOpsChecklistItem[];
  savedViews: Array<{ id: string; label: string; href: string; count: number }>;
  notifications: DashboardActionItem[];
  features: FinanceOpsFeature[];
};

export type FinanceOpsLabels = {
  checklist: {
    statementsImported: string;
    reviewQueueClear: string;
    categoriesResolved: string;
    receiptsMatched: string;
    cashReconciled: string;
  };
  savedViews: {
    uncategorized: string;
    needsReceipt: string;
    statementReview: string;
    largeExpenses: string;
    monthClose: string;
  };
  pluralStatement: string;
  pluralWarning: string;
  pluralTransaction: string;
  pluralReceipt: string;
  features: {
    importReviewInbox: {
      title: string;
      summary: string;
      primaryActionOpen: string;
      primaryActionImport: string;
      evidence: string;
    };
    transactionTriageMode: {
      title: string;
      summary: string;
      primaryAction: string;
      evidence: string;
    };
    smartCategorySuggestions: {
      title: string;
      summary: string;
      primaryAction: string;
      evidenceTopCategory: string;
      evidenceNoPressure: string;
    };
    periodCloseChecklistFeature: {
      title: string;
      summary: string;
      primaryActionResolve: string;
      primaryActionExport: string;
      evidence: string;
    };
    anomalyDetectionFeed: {
      title: string;
      summary: string;
      primaryAction: string;
      evidenceOverdue: string;
      evidenceTopMerchant: string;
      evidenceNone: string;
    };
    reconciliationDashboard: {
      title: string;
      summary: string;
      primaryAction: string;
      evidence: string;
    };
    savedViewsTeamFilters: {
      title: string;
      summary: string;
      primaryAction: string;
      evidence: string;
    };
    receiptMatchingAssistant: {
      title: string;
      summary: string;
      primaryAction: string;
      evidence: string;
    };
    actionableNotifications: {
      title: string;
      summary: string;
      primaryActionOpen: string;
      primaryActionNone: string;
      evidenceAllClear: string;
    };
    explainThisNumber: {
      title: string;
      summary: string;
      primaryAction: string;
      evidenceTopCategoryAmount: string;
      evidenceBalance: string;
    };
  };
};

const statusFor = (count: number, blocked = false): FinanceOpsFeatureStatus => {
  if (blocked) return 'blocked';
  return count > 0 ? 'review' : 'ready';
};

export function buildFinanceOpsModel(
  data: DashboardData,
  formatAmount: (value: number) => string,
  labels: FinanceOpsLabels,
): FinanceOpsModel {
  const dataHealth = {
    uncategorizedTransactions: data.dataHealth?.uncategorizedTransactions ?? 0,
    statementsWithErrors: data.dataHealth?.statementsWithErrors ?? 0,
    statementsPendingReview: data.dataHealth?.statementsPendingReview ?? 0,
    statementsPendingSubmit: data.dataHealth?.statementsPendingSubmit ?? 0,
    receiptsPendingReview: data.dataHealth?.receiptsPendingReview ?? 0,
    unapprovedCash: data.dataHealth?.unapprovedCash ?? 0,
    lastUploadDate: data.dataHealth?.lastUploadDate ?? null,
    parsingWarnings: data.dataHealth?.parsingWarnings ?? 0,
  };
  const snapshot = {
    totalBalance: data.snapshot?.totalBalance ?? 0,
    income30d: data.snapshot?.income30d ?? 0,
    expense30d: data.snapshot?.expense30d ?? 0,
    netFlow30d: data.snapshot?.netFlow30d ?? 0,
    totalPayable: data.snapshot?.totalPayable ?? 0,
    totalOverdue: data.snapshot?.totalOverdue ?? 0,
    unapprovedCash: data.snapshot?.unapprovedCash ?? 0,
    currency: data.snapshot?.currency ?? FALLBACK_CURRENCY,
  };
  const actions = data.actions ?? [];
  const topCategories = data.topCategories ?? [];
  const topMerchants = data.topMerchants ?? [];
  const importPending =
    dataHealth.statementsPendingSubmit +
    dataHealth.statementsPendingReview +
    dataHealth.statementsWithErrors +
    dataHealth.parsingWarnings;
  const triagePending = dataHealth.uncategorizedTransactions;
  const receiptPending = dataHealth.receiptsPendingReview;
  const reconciliationPending = Math.abs(snapshot.unapprovedCash) > 0 ? 1 : 0;
  const anomalyPending =
    snapshot.totalOverdue > 0 || snapshot.expense30d > snapshot.income30d ? 1 : 0;

  const closeChecklist: FinanceOpsChecklistItem[] = [
    {
      id: 'statements-loaded',
      label: labels.checklist.statementsImported,
      done: dataHealth.statementsPendingSubmit === 0,
      href: '/statements/submit',
    },
    {
      id: 'review-clear',
      label: labels.checklist.reviewQueueClear,
      done: dataHealth.statementsPendingReview === 0 && dataHealth.statementsWithErrors === 0,
      href: '/review',
    },
    {
      id: 'categories-clear',
      label: labels.checklist.categoriesResolved,
      done: dataHealth.uncategorizedTransactions === 0,
      href: '/statements/submit?categoryId=uncategorized',
    },
    {
      id: 'receipts-clear',
      label: labels.checklist.receiptsMatched,
      done: dataHealth.receiptsPendingReview === 0,
      href: '/statements/submit?status=needs_review',
    },
    {
      id: 'cash-approved',
      label: labels.checklist.cashReconciled,
      done: Math.abs(snapshot.unapprovedCash) === 0,
      href: '/review',
    },
  ];

  const closePending = closeChecklist.filter(item => !item.done).length;
  const savedViews = [
    {
      id: 'uncategorized',
      label: labels.savedViews.uncategorized,
      href: '/statements/submit?categoryId=uncategorized',
      count: dataHealth.uncategorizedTransactions,
    },
    {
      id: 'needs-receipt',
      label: labels.savedViews.needsReceipt,
      href: '/statements/submit?status=needs_review',
      count: dataHealth.receiptsPendingReview,
    },
    {
      id: 'review-statements',
      label: labels.savedViews.statementReview,
      href: '/review',
      count: dataHealth.statementsPendingReview,
    },
    {
      id: 'large-expenses',
      label: labels.savedViews.largeExpenses,
      href: '/reports?tab=cash-flow',
      count: 0,
    },
    {
      id: 'month-close',
      label: labels.savedViews.monthClose,
      href: '/reports',
      count: closePending,
    },
  ];

  const features: FinanceOpsFeature[] = [
    {
      id: 'import-review-inbox',
      title: labels.features.importReviewInbox.title,
      summary: labels.features.importReviewInbox.summary,
      pendingCount: importPending,
      status: statusFor(importPending, dataHealth.statementsWithErrors > 0),
      href: importPending > 0 ? '/review' : '/statements/submit?openExpenseDrawer=scan',
      primaryAction:
        importPending > 0
          ? labels.features.importReviewInbox.primaryActionOpen
          : labels.features.importReviewInbox.primaryActionImport,
      evidence: fillTemplate(labels.features.importReviewInbox.evidence, {
        statements: fillTemplate(labels.pluralStatement, {
          count: String(dataHealth.statementsPendingReview),
        }),
        warnings: fillTemplate(labels.pluralWarning, { count: String(dataHealth.parsingWarnings) }),
      }),
    },
    {
      id: 'transaction-triage',
      title: labels.features.transactionTriageMode.title,
      summary: labels.features.transactionTriageMode.summary,
      pendingCount: triagePending,
      status: statusFor(triagePending),
      href: '/statements/submit?categoryId=uncategorized',
      primaryAction: labels.features.transactionTriageMode.primaryAction,
      evidence: fillTemplate(labels.features.transactionTriageMode.evidence, {
        transactions: fillTemplate(labels.pluralTransaction, { count: String(triagePending) }),
      }),
    },
    {
      id: 'smart-category-suggestions',
      title: labels.features.smartCategorySuggestions.title,
      summary: labels.features.smartCategorySuggestions.summary,
      pendingCount: triagePending,
      status: statusFor(triagePending),
      href: '/workspaces/categories',
      primaryAction: labels.features.smartCategorySuggestions.primaryAction,
      evidence: topCategories[0]
        ? fillTemplate(labels.features.smartCategorySuggestions.evidenceTopCategory, {
            name: topCategories[0].name ?? labels.savedViews.uncategorized,
          })
        : labels.features.smartCategorySuggestions.evidenceNoPressure,
    },
    {
      id: 'period-close-checklist',
      title: labels.features.periodCloseChecklistFeature.title,
      summary: labels.features.periodCloseChecklistFeature.summary,
      pendingCount: closePending,
      status: statusFor(closePending, closePending > 0),
      href: closeChecklist.find(item => !item.done)?.href ?? '/reports',
      primaryAction:
        closePending > 0
          ? labels.features.periodCloseChecklistFeature.primaryActionResolve
          : labels.features.periodCloseChecklistFeature.primaryActionExport,
      evidence: fillTemplate(labels.features.periodCloseChecklistFeature.evidence, {
        done: String(closeChecklist.length - closePending),
        total: String(closeChecklist.length),
      }),
    },
    {
      id: 'anomaly-feed',
      title: labels.features.anomalyDetectionFeed.title,
      summary: labels.features.anomalyDetectionFeed.summary,
      pendingCount: anomalyPending,
      status: statusFor(anomalyPending),
      href: snapshot.totalOverdue > 0 ? '/statements/pay?status=overdue' : '/reports?tab=cash-flow',
      primaryAction: labels.features.anomalyDetectionFeed.primaryAction,
      evidence:
        snapshot.totalOverdue > 0
          ? fillTemplate(labels.features.anomalyDetectionFeed.evidenceOverdue, {
              amount: formatAmount(snapshot.totalOverdue),
            })
          : fillTemplate(labels.features.anomalyDetectionFeed.evidenceTopMerchant, {
              name: topMerchants[0]?.name ?? labels.features.anomalyDetectionFeed.evidenceNone,
            }),
    },
    {
      id: 'reconciliation-dashboard',
      title: labels.features.reconciliationDashboard.title,
      summary: labels.features.reconciliationDashboard.summary,
      pendingCount: reconciliationPending,
      status: statusFor(reconciliationPending),
      href: '/review',
      primaryAction: labels.features.reconciliationDashboard.primaryAction,
      evidence: fillTemplate(labels.features.reconciliationDashboard.evidence, {
        netFlow: formatAmount(snapshot.netFlow30d),
        unapproved: formatAmount(snapshot.unapprovedCash),
      }),
    },
    {
      id: 'saved-views',
      title: labels.features.savedViewsTeamFilters.title,
      summary: labels.features.savedViewsTeamFilters.summary,
      pendingCount: savedViews.reduce((sum, view) => sum + view.count, 0),
      status: statusFor(savedViews.reduce((sum, view) => sum + view.count, 0)),
      href: '/statements/transactions',
      primaryAction: labels.features.savedViewsTeamFilters.primaryAction,
      evidence: fillTemplate(labels.features.savedViewsTeamFilters.evidence, {
        count: String(savedViews.length),
      }),
    },
    {
      id: 'receipt-matching',
      title: labels.features.receiptMatchingAssistant.title,
      summary: labels.features.receiptMatchingAssistant.summary,
      pendingCount: receiptPending,
      status: statusFor(receiptPending),
      href: '/statements/submit?status=needs_review',
      primaryAction: labels.features.receiptMatchingAssistant.primaryAction,
      evidence: fillTemplate(labels.features.receiptMatchingAssistant.evidence, {
        receipts: fillTemplate(labels.pluralReceipt, { count: String(receiptPending) }),
      }),
    },
    {
      id: 'actionable-notifications',
      title: labels.features.actionableNotifications.title,
      summary: labels.features.actionableNotifications.summary,
      pendingCount: actions.reduce((sum, action) => sum + action.count, 0),
      status: statusFor(actions.reduce((sum, action) => sum + action.count, 0)),
      href: actions[0]?.href ?? '/dashboard',
      primaryAction: actions[0]
        ? labels.features.actionableNotifications.primaryActionOpen
        : labels.features.actionableNotifications.primaryActionNone,
      evidence: actions[0]?.label ?? labels.features.actionableNotifications.evidenceAllClear,
    },
    {
      id: 'explain-number',
      title: labels.features.explainThisNumber.title,
      summary: labels.features.explainThisNumber.summary,
      pendingCount: 0,
      status: 'ready',
      href: '/reports',
      primaryAction: labels.features.explainThisNumber.primaryAction,
      evidence: topCategories[0]
        ? fillTemplate(labels.features.explainThisNumber.evidenceTopCategoryAmount, {
            name: topCategories[0].name ?? labels.savedViews.uncategorized,
            amount: formatAmount(topCategories[0].amount),
          })
        : fillTemplate(labels.features.explainThisNumber.evidenceBalance, {
            amount: formatAmount(snapshot.totalBalance),
          }),
    },
  ];

  return {
    totalPending: features.reduce((sum, feature) => sum + feature.pendingCount, 0),
    closeChecklist,
    savedViews,
    notifications: actions,
    features,
  };
}
