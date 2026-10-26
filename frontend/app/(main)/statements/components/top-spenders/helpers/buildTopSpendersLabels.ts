import { FLOW_LABEL_PATHS } from '@/app/(main)/statements/components/analytics/flow/flow-label-paths';
import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';

type TxFn = (path: string[]) => string;

// Module-level constant — not a function, exempt from max-lines-per-function.
const LABEL_PATHS: Record<string, string[]> = {
  title: ['topSpenders', 'title'],
  subtitle: ['topSpenders', 'subtitle'],
  ...FLOW_LABEL_PATHS,
  totalSpend: ['topSpenders', 'totalSpend'],
  statementsSpend: ['topSpenders', 'statementsSpend'],
  receiptsSpend: ['topSpenders', 'receiptsSpend'],
  totalOperations: ['topSpenders', 'totalOperations'],
  topCompanies: ['topSpenders', 'topCompanies'],
  topIncomeSenders: ['topSpenders', 'topIncomeSenders'],
  sourceSplit: ['topSpenders', 'sourceSplit'],
  spendTrend: ['topSpenders', 'spendTrend'],
  incomeTrend: ['topSpenders', 'incomeTrend'],
  leaderboard: ['topSpenders', 'leaderboard'],
  incomeLeaderboard: ['topSpenders', 'incomeLeaderboard'],
  totalIncome: ['topSpenders', 'totalIncome'],
  tabSpenders: ['topSpenders', 'tabSpenders'],
  tabIncomeSenders: ['topSpenders', 'tabIncomeSenders'],
  source: ['topSpenders', 'source'],
  company: ['topSpenders', 'company'],
  amount: ['topSpenders', 'amount'],
  operations: ['topSpenders', 'operations'],
  average: ['topSpenders', 'average'],
  lastOperation: ['topSpenders', 'lastOperation'],
  sourceStatement: ['topSpenders', 'sourceStatement'],
  sourceBank: ['topSpenders', 'sourceBank'],
  sourceReceipt: ['topSpenders', 'sourceReceipt'],
  sourceCrypto: ['topSpenders', 'sourceCrypto'],
  workspace: ['topSpenders', 'workspace'],
  allWorkspaces: ['topSpenders', 'allWorkspaces'],
  currentWorkspace: ['topSpenders', 'currentWorkspace'],
  sortByAmount: ['topSpenders', 'sortByAmount'],
  sortByAverage: ['topSpenders', 'sortByAverage'],
  sortByOperations: ['topSpenders', 'sortByOperations'],
  vsPreviousPeriod: ['topSpenders', 'vsPreviousPeriod'],
  comparisonNoData: ['topSpenders', 'comparisonNoData'],
  drillDown: ['topSpenders', 'drillDown'],
  close: ['viewFile', 'close'],
  noOperations: ['topSpenders', 'noOperations'],
  filters: ['filters', 'filters'],
  type: ['filters', 'type'],
  status: ['filters', 'status'],
  date: ['filters', 'date'],
  from: ['filters', 'from'],
  apply: ['filters', 'apply'],
  reset: ['filters', 'reset'],
  loadError: ['topSpenders', 'loadError'],
};

export const buildTopSpendersLabels = (tx: TxFn): Record<string, string> =>
  Object.fromEntries(Object.entries(LABEL_PATHS).map(([k, p]) => [k, tx(p)]));

export const createTx =
  (t: unknown): TxFn =>
  path =>
    resolveLabel(getNestedValue(t, path));
