import { FLOW_LABEL_PATHS } from '@/app/(main)/statements/components/analytics/flow/flow-label-paths';
import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';

type TxFn = (path: string[]) => string;

const LABEL_PATHS: Record<string, string[]> = {
  ...FLOW_LABEL_PATHS,
  title: ['topCategoriesAnalytics', 'title'],
  subtitle: ['topCategoriesAnalytics', 'subtitle'],
  totalSpend: ['topCategoriesAnalytics', 'totalSpend'],
  statementsSpend: ['topCategoriesAnalytics', 'statementsSpend'],
  receiptsSpend: ['topCategoriesAnalytics', 'receiptsSpend'],
  totalOperations: ['topCategoriesAnalytics', 'totalOperations'],
  topCategories: ['topCategoriesAnalytics', 'topCategories'],
  topIncomeCategories: ['topCategoriesAnalytics', 'topIncomeCategories'],
  sourceSplit: ['topCategoriesAnalytics', 'sourceSplit'],
  spendTrend: ['topCategoriesAnalytics', 'spendTrend'],
  incomeTrend: ['topCategoriesAnalytics', 'incomeTrend'],
  leaderboard: ['topCategoriesAnalytics', 'leaderboard'],
  incomeLeaderboard: ['topCategoriesAnalytics', 'incomeLeaderboard'],
  totalIncome: ['topCategoriesAnalytics', 'totalIncome'],
  tabSpenders: ['topCategoriesAnalytics', 'tabSpenders'],
  tabIncomeSenders: ['topCategoriesAnalytics', 'tabIncomeSenders'],
  source: ['topCategoriesAnalytics', 'source'],
  category: ['topCategoriesAnalytics', 'category'],
  amount: ['topCategoriesAnalytics', 'amount'],
  operations: ['topCategoriesAnalytics', 'operations'],
  average: ['topCategoriesAnalytics', 'average'],
  lastOperation: ['topCategoriesAnalytics', 'lastOperation'],
  sourceStatement: ['topCategoriesAnalytics', 'sourceStatement'],
  sourceBank: ['topCategoriesAnalytics', 'sourceBank'],
  sourceReceipt: ['topCategoriesAnalytics', 'sourceReceipt'],
  sourceCrypto: ['topCategoriesAnalytics', 'sourceCrypto'],
  workspace: ['topCategoriesAnalytics', 'workspace'],
  allWorkspaces: ['topCategoriesAnalytics', 'allWorkspaces'],
  currentWorkspace: ['topCategoriesAnalytics', 'currentWorkspace'],
  sortByAmount: ['topCategoriesAnalytics', 'sortByAmount'],
  sortByAverage: ['topCategoriesAnalytics', 'sortByAverage'],
  sortByOperations: ['topCategoriesAnalytics', 'sortByOperations'],
  vsPreviousPeriod: ['topCategoriesAnalytics', 'vsPreviousPeriod'],
  comparisonNoData: ['topCategoriesAnalytics', 'comparisonNoData'],
  drillDown: ['topCategoriesAnalytics', 'drillDown'],
  close: ['viewFile', 'close'],
  noOperations: ['topCategoriesAnalytics', 'noOperations'],
  filters: ['filters', 'filters'],
  type: ['filters', 'type'],
  status: ['filters', 'status'],
  date: ['filters', 'date'],
  from: ['filters', 'from'],
  apply: ['filters', 'apply'],
  reset: ['filters', 'reset'],
  loadError: ['topCategoriesAnalytics', 'loadError'],
};

export const buildTopCategoriesLabels = (tx: TxFn): Record<string, string> =>
  Object.fromEntries(Object.entries(LABEL_PATHS).map(([k, p]) => [k, tx(p)]));

export const createTx =
  (t: unknown): TxFn =>
  path =>
    resolveLabel(getNestedValue(t, path));
