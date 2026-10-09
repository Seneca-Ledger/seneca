import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';

type TxFn = (path: string[], fallback: string) => string;

const LABEL_PATHS: Record<string, [string[], string]> = {
  title: [['spendOverTimeAnalytics', 'title'], 'Spend over time'],
  subtitle: [
    ['spendOverTimeAnalytics', 'subtitle'],
    'Track spend and income dynamics with the same filters and drill-down as Top merchants.',
  ],
  searchPlaceholder: [
    ['spendOverTimeAnalytics', 'searchPlaceholder'],
    'Search by merchant, sender or subject',
  ],
  totalSpend: [['spendOverTimeAnalytics', 'totalSpend'], 'Total spend'],
  totalIncome: [['spendOverTimeAnalytics', 'totalIncome'], 'Total income'],
  statementsAmount: [['spendOverTimeAnalytics', 'statementsAmount'], 'Statements'],
  receiptsAmount: [['spendOverTimeAnalytics', 'receiptsAmount'], 'Receipts'],
  totalOperations: [['spendOverTimeAnalytics', 'totalOperations'], 'Operations'],
  avgPerPeriod: [['spendOverTimeAnalytics', 'avgPerPeriod'], 'Average per period'],
  calendarEmptyMonth: [
    ['spendOverTimeAnalytics', 'calendarEmptyMonth'],
    'No operations in this month',
  ],
  calendarOperations: [['spendOverTimeAnalytics', 'calendarOperations'], 'operations'],
  periodChart: [['spendOverTimeAnalytics', 'periodChart'], 'Top periods'],
  trendTitle: [['spendOverTimeAnalytics', 'trendTitle'], 'Trend'],
  sourceSplit: [['spendOverTimeAnalytics', 'sourceSplit'], 'Source split'],
  leaderboard: [['spendOverTimeAnalytics', 'leaderboard'], 'Periods leaderboard'],
  workspace: [['spendOverTimeAnalytics', 'workspace'], 'Workspace'],
  allWorkspaces: [['spendOverTimeAnalytics', 'allWorkspaces'], 'All workspaces'],
  currentWorkspace: [['spendOverTimeAnalytics', 'currentWorkspace'], 'Current workspace'],
  tabExpense: [['spendOverTimeAnalytics', 'tabExpense'], 'Expenses'],
  tabIncome: [['spendOverTimeAnalytics', 'tabIncome'], 'Income'],
  period: [['spendOverTimeAnalytics', 'period'], 'Period'],
  amount: [['spendOverTimeAnalytics', 'amount'], 'Amount'],
  average: [['spendOverTimeAnalytics', 'average'], 'Average'],
  operations: [['spendOverTimeAnalytics', 'operations'], 'Operations'],
  source: [['spendOverTimeAnalytics', 'source'], 'Source'],
  lastOperation: [['spendOverTimeAnalytics', 'lastOperation'], 'Last operation'],
  sortByAmount: [['spendOverTimeAnalytics', 'sortByAmount'], 'Amount'],
  sortByAverage: [['spendOverTimeAnalytics', 'sortByAverage'], 'Average'],
  sortByOperations: [['spendOverTimeAnalytics', 'sortByOperations'], 'Operations'],
  comparisonNoData: [['spendOverTimeAnalytics', 'comparisonNoData'], 'No previous period data'],
  vsPreviousPeriod: [['spendOverTimeAnalytics', 'vsPreviousPeriod'], 'vs previous period'],
  drillDown: [['spendOverTimeAnalytics', 'drillDown'], 'Drill-down'],
  noOperations: [['spendOverTimeAnalytics', 'noOperations'], 'No operations found'],
  sourceBank: [['spendOverTimeAnalytics', 'sourceBank'], 'Bank'],
  sourceReceipt: [['spendOverTimeAnalytics', 'sourceReceipt'], 'Receipt'],
  sourceGmailInbox: [['spendOverTimeAnalytics', 'sourceGmailInbox'], 'Gmail'],
  sourceCrypto: [['spendOverTimeAnalytics', 'sourceCrypto'], 'Crypto'],
  emptyStateTitle: [['spendOverTime', 'emptyStateTitle'], 'No data for selected period'],
  emptyStateDescription: [
    ['spendOverTime', 'emptyStateDescription'],
    'Upload statements or apply another filter',
  ],
  emptyStateUploadCta: [['spendOverTime', 'emptyStateUploadCta'], 'Go to statement upload'],
  emptyStateResetCta: [['spendOverTime', 'emptyStateResetCta'], 'Reset filters'],
  close: [['common', 'close'], 'Close'],
  filters: [['filters', 'filters'], 'Filters'],
  type: [['filters', 'type'], 'Type'],
  status: [['filters', 'status'], 'Status'],
  date: [['filters', 'date'], 'Date'],
  from: [['filters', 'from'], 'From'],
  apply: [['filters', 'apply'], 'Apply'],
  reset: [['filters', 'reset'], 'Reset'],
  loadError: [[], 'Failed to load spending data'],
};

export const buildSpendOverTimeLabels = (tx: TxFn): Record<string, string> =>
  Object.fromEntries(
    Object.entries(LABEL_PATHS).map(([k, [p, f]]) => [k, p.length === 0 ? f : tx(p, f)]),
  );

export const createTx =
  (t: unknown): TxFn =>
  (path, fallback) =>
    resolveLabel(getNestedValue(t, path), fallback);
