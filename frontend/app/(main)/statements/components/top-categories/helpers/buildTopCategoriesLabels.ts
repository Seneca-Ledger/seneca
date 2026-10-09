import { FLOW_LABEL_PATHS } from '@/app/(main)/statements/components/analytics/flow/flow-label-paths';
import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';

type TxFn = (path: string[], fallback: string) => string;

const LABEL_PATHS: Record<string, [string[], string]> = {
  ...FLOW_LABEL_PATHS,
  title: [['topCategoriesAnalytics', 'title'], 'Top categories'],
  subtitle: [['topCategoriesAnalytics', 'subtitle'], 'Spending analytics by categories.'],
  totalSpend: [['topCategoriesAnalytics', 'totalSpend'], 'Total spend'],
  statementsSpend: [['topCategoriesAnalytics', 'statementsSpend'], 'Statements'],
  receiptsSpend: [['topCategoriesAnalytics', 'receiptsSpend'], 'Receipts'],
  totalOperations: [['topCategoriesAnalytics', 'totalOperations'], 'Operations'],
  topCategories: [['topCategoriesAnalytics', 'topCategories'], 'Top categories'],
  topIncomeCategories: [['topCategoriesAnalytics', 'topIncomeCategories'], 'Top income categories'],
  sourceSplit: [['topCategoriesAnalytics', 'sourceSplit'], 'Source split'],
  spendTrend: [['topCategoriesAnalytics', 'spendTrend'], 'Spending trend'],
  incomeTrend: [['topCategoriesAnalytics', 'incomeTrend'], 'Income trend'],
  leaderboard: [['topCategoriesAnalytics', 'leaderboard'], 'Top categories list'],
  incomeLeaderboard: [
    ['topCategoriesAnalytics', 'incomeLeaderboard'],
    'Top income categories list',
  ],
  totalIncome: [['topCategoriesAnalytics', 'totalIncome'], 'Total income'],
  tabSpenders: [['topCategoriesAnalytics', 'tabSpenders'], 'Expenses'],
  tabIncomeSenders: [['topCategoriesAnalytics', 'tabIncomeSenders'], 'Income'],
  source: [['topCategoriesAnalytics', 'source'], 'Source'],
  category: [['topCategoriesAnalytics', 'category'], 'Category'],
  amount: [['topCategoriesAnalytics', 'amount'], 'Amount'],
  operations: [['topCategoriesAnalytics', 'operations'], 'Operations'],
  average: [['topCategoriesAnalytics', 'average'], 'Average'],
  lastOperation: [['topCategoriesAnalytics', 'lastOperation'], 'Last operation'],
  sourceStatement: [['topCategoriesAnalytics', 'sourceStatement'], 'Statement'],
  sourceGmail: [['topCategoriesAnalytics', 'sourceGmail'], 'Receipt'],
  sourceBank: [['topCategoriesAnalytics', 'sourceBank'], 'Bank'],
  sourceReceipt: [['topCategoriesAnalytics', 'sourceReceipt'], 'Receipt'],
  sourceGmailInbox: [['topCategoriesAnalytics', 'sourceGmailInbox'], 'Gmail'],
  sourceCrypto: [['topCategoriesAnalytics', 'sourceCrypto'], 'Crypto'],
  workspace: [['topCategoriesAnalytics', 'workspace'], 'Workspace'],
  allWorkspaces: [['topCategoriesAnalytics', 'allWorkspaces'], 'All workspaces'],
  currentWorkspace: [['topCategoriesAnalytics', 'currentWorkspace'], 'Current workspace'],
  sortByAmount: [['topCategoriesAnalytics', 'sortByAmount'], 'Amount'],
  sortByAverage: [['topCategoriesAnalytics', 'sortByAverage'], 'Average'],
  sortByOperations: [['topCategoriesAnalytics', 'sortByOperations'], 'Operations'],
  vsPreviousPeriod: [['topCategoriesAnalytics', 'vsPreviousPeriod'], 'vs previous period'],
  comparisonNoData: [['topCategoriesAnalytics', 'comparisonNoData'], 'No previous period data'],
  drillDown: [['topCategoriesAnalytics', 'drillDown'], 'Operations'],
  close: [['common', 'close'], 'Close'],
  noOperations: [['topCategoriesAnalytics', 'noOperations'], 'No operations found'],
  filters: [['filters', 'filters'], 'Filters'],
  type: [['filters', 'type'], 'Type'],
  status: [['filters', 'status'], 'Status'],
  date: [['filters', 'date'], 'Date'],
  from: [['filters', 'from'], 'From'],
  apply: [['filters', 'apply'], 'Apply'],
  reset: [['filters', 'reset'], 'Reset'],
  loadError: [[], 'Failed to load category data'],
};

export const buildTopCategoriesLabels = (tx: TxFn): Record<string, string> =>
  Object.fromEntries(
    Object.entries(LABEL_PATHS).map(([k, [p, f]]) => [k, p.length === 0 ? f : tx(p, f)]),
  );

export const createTx =
  (t: unknown): TxFn =>
  (path, fallback) =>
    resolveLabel(getNestedValue(t, path), fallback);
