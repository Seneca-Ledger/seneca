import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';

type TxFn = (path: string[]) => string;

const LABEL_PATHS: Record<string, string[]> = {
  title: ['spendOverTimeAnalytics', 'title'],
  subtitle: ['spendOverTimeAnalytics', 'subtitle'],
  searchPlaceholder: ['spendOverTimeAnalytics', 'searchPlaceholder'],
  totalSpend: ['spendOverTimeAnalytics', 'totalSpend'],
  totalIncome: ['spendOverTimeAnalytics', 'totalIncome'],
  statementsAmount: ['spendOverTimeAnalytics', 'statementsAmount'],
  receiptsAmount: ['spendOverTimeAnalytics', 'receiptsAmount'],
  totalOperations: ['spendOverTimeAnalytics', 'totalOperations'],
  avgPerPeriod: ['spendOverTimeAnalytics', 'avgPerPeriod'],
  periodChart: ['spendOverTimeAnalytics', 'periodChart'],
  trendTitle: ['spendOverTimeAnalytics', 'trendTitle'],
  sourceSplit: ['spendOverTimeAnalytics', 'sourceSplit'],
  leaderboard: ['spendOverTimeAnalytics', 'leaderboard'],
  workspace: ['spendOverTimeAnalytics', 'workspace'],
  allWorkspaces: ['spendOverTimeAnalytics', 'allWorkspaces'],
  currentWorkspace: ['spendOverTimeAnalytics', 'currentWorkspace'],
  tabExpense: ['spendOverTimeAnalytics', 'tabExpense'],
  tabIncome: ['spendOverTimeAnalytics', 'tabIncome'],
  period: ['spendOverTimeAnalytics', 'period'],
  amount: ['spendOverTimeAnalytics', 'amount'],
  average: ['spendOverTimeAnalytics', 'average'],
  operations: ['spendOverTimeAnalytics', 'operations'],
  source: ['spendOverTimeAnalytics', 'source'],
  lastOperation: ['spendOverTimeAnalytics', 'lastOperation'],
  sortByAmount: ['spendOverTimeAnalytics', 'sortByAmount'],
  sortByAverage: ['spendOverTimeAnalytics', 'sortByAverage'],
  sortByOperations: ['spendOverTimeAnalytics', 'sortByOperations'],
  comparisonNoData: ['spendOverTimeAnalytics', 'comparisonNoData'],
  vsPreviousPeriod: ['spendOverTimeAnalytics', 'vsPreviousPeriod'],
  drillDown: ['spendOverTimeAnalytics', 'drillDown'],
  noOperations: ['spendOverTimeAnalytics', 'noOperations'],
  sourceBank: ['spendOverTimeAnalytics', 'sourceBank'],
  sourceReceipt: ['spendOverTimeAnalytics', 'sourceReceipt'],
  sourceCrypto: ['spendOverTimeAnalytics', 'sourceCrypto'],
  emptyStateTitle: ['spendOverTime', 'emptyStateTitle'],
  emptyStateDescription: ['spendOverTime', 'emptyStateDescription'],
  emptyStateUploadCta: ['spendOverTime', 'emptyStateUploadCta'],
  emptyStateResetCta: ['spendOverTime', 'emptyStateResetCta'],
  close: ['viewFile', 'close'],
  filters: ['filters', 'filters'],
  type: ['filters', 'type'],
  status: ['filters', 'status'],
  date: ['filters', 'date'],
  from: ['filters', 'from'],
  apply: ['filters', 'apply'],
  reset: ['filters', 'reset'],
  loadError: ['topSpenders', 'loadError'],
};

export const buildSpendOverTimeLabels = (tx: TxFn): Record<string, string> =>
  Object.fromEntries(Object.entries(LABEL_PATHS).map(([k, p]) => [k, tx(p)]));

export const createTx =
  (t: unknown): TxFn =>
  path =>
    resolveLabel(getNestedValue(t, path));
