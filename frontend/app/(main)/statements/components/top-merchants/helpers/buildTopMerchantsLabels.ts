import { FLOW_LABEL_PATHS } from '@/app/(main)/statements/components/analytics/flow/flow-label-paths';
import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';

type TxFn = (path: string[]) => string;

const LABEL_PATHS: Record<string, string[]> = {
  ...FLOW_LABEL_PATHS,
  title: ['topMerchants', 'title'],
  subtitle: ['topMerchants', 'subtitle'],
  totalSpend: ['topMerchants', 'totalSpend'],
  statementsSpend: ['topMerchants', 'statementsSpend'],
  receiptsSpend: ['topMerchants', 'receiptsSpend'],
  totalOperations: ['topMerchants', 'totalOperations'],
  topMerchants: ['topMerchants', 'topMerchants'],
  topIncomeSenders: ['topMerchants', 'topIncomeSenders'],
  sourceSplit: ['topMerchants', 'sourceSplit'],
  spendTrend: ['topMerchants', 'spendTrend'],
  incomeTrend: ['topMerchants', 'incomeTrend'],
  leaderboard: ['topMerchants', 'leaderboard'],
  incomeLeaderboard: ['topMerchants', 'incomeLeaderboard'],
  totalIncome: ['topMerchants', 'totalIncome'],
  tabSpenders: ['topMerchants', 'tabSpenders'],
  tabIncomeSenders: ['topMerchants', 'tabIncomeSenders'],
  source: ['topMerchants', 'source'],
  merchant: ['topMerchants', 'merchant'],
  amount: ['topMerchants', 'amount'],
  operations: ['topMerchants', 'operations'],
  average: ['topMerchants', 'average'],
  lastOperation: ['topMerchants', 'lastOperation'],
  sourceStatement: ['topMerchants', 'sourceStatement'],
  sourceBank: ['topMerchants', 'sourceBank'],
  sourceReceipt: ['topMerchants', 'sourceReceipt'],
  sourceCrypto: ['topMerchants', 'sourceCrypto'],
  workspace: ['topMerchants', 'workspace'],
  allWorkspaces: ['topMerchants', 'allWorkspaces'],
  currentWorkspace: ['topMerchants', 'currentWorkspace'],
  sortByAmount: ['topMerchants', 'sortByAmount'],
  sortByAverage: ['topMerchants', 'sortByAverage'],
  sortByOperations: ['topMerchants', 'sortByOperations'],
  vsPreviousPeriod: ['topMerchants', 'vsPreviousPeriod'],
  comparisonNoData: ['topMerchants', 'comparisonNoData'],
  drillDown: ['topMerchants', 'drillDown'],
  close: ['viewFile', 'close'],
  noOperations: ['topMerchants', 'noOperations'],
  filters: ['filters', 'filters'],
  type: ['filters', 'type'],
  status: ['filters', 'status'],
  date: ['filters', 'date'],
  from: ['filters', 'from'],
  apply: ['filters', 'apply'],
  reset: ['filters', 'reset'],
  loadError: ['topSpenders', 'loadError'],
};

export const buildTopMerchantsLabels = (tx: TxFn): Record<string, string> =>
  Object.fromEntries(Object.entries(LABEL_PATHS).map(([k, p]) => [k, tx(p)]));

export const createTx =
  (t: unknown): TxFn =>
  path =>
    resolveLabel(getNestedValue(t, path));
