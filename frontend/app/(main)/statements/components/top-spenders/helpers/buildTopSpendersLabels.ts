import { FLOW_LABEL_PATHS } from '@/app/(main)/statements/components/analytics/flow/flow-label-paths';
import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';

type TxFn = (path: string[], fallback: string) => string;

// Module-level constant — not a function, exempt from max-lines-per-function.
const LABEL_PATHS: Record<string, [string[], string]> = {
  title: [['topSpenders', 'title'], 'Top spenders'],
  subtitle: [
    ['topSpenders', 'subtitle'],
    'See where money goes by receipts, statements and dates.',
  ],
  ...FLOW_LABEL_PATHS,
  totalSpend: [['topSpenders', 'totalSpend'], 'Total spend'],
  statementsSpend: [['topSpenders', 'statementsSpend'], 'Statements'],
  receiptsSpend: [['topSpenders', 'receiptsSpend'], 'Receipts'],
  totalOperations: [['topSpenders', 'totalOperations'], 'Operations'],
  topCompanies: [['topSpenders', 'topCompanies'], 'Top companies'],
  topIncomeSenders: [['topSpenders', 'topIncomeSenders'], 'Top income senders'],
  sourceSplit: [['topSpenders', 'sourceSplit'], 'Source split'],
  spendTrend: [['topSpenders', 'spendTrend'], 'Spending trend'],
  incomeTrend: [['topSpenders', 'incomeTrend'], 'Income trend'],
  leaderboard: [['topSpenders', 'leaderboard'], 'Top spenders list'],
  incomeLeaderboard: [['topSpenders', 'incomeLeaderboard'], 'Top income senders list'],
  totalIncome: [['topSpenders', 'totalIncome'], 'Total income'],
  tabSpenders: [['topSpenders', 'tabSpenders'], 'Top spenders'],
  tabIncomeSenders: [['topSpenders', 'tabIncomeSenders'], 'Top income senders'],
  source: [['topSpenders', 'source'], 'Source'],
  company: [['topSpenders', 'company'], 'Company'],
  amount: [['topSpenders', 'amount'], 'Amount'],
  operations: [['topSpenders', 'operations'], 'Operations'],
  average: [['topSpenders', 'average'], 'Average'],
  lastOperation: [['topSpenders', 'lastOperation'], 'Last operation'],
  sourceStatement: [['topSpenders', 'sourceStatement'], 'Statement'],
  sourceGmail: [['topSpenders', 'sourceGmail'], 'Receipt'],
  sourceBank: [['topSpenders', 'sourceBank'], 'Bank'],
  sourceReceipt: [['topSpenders', 'sourceReceipt'], 'Receipt'],
  sourceGmailInbox: [['topSpenders', 'sourceGmailInbox'], 'Gmail'],
  sourceCrypto: [['topSpenders', 'sourceCrypto'], 'Crypto'],
  workspace: [['topSpenders', 'workspace'], 'Workspace'],
  allWorkspaces: [['topSpenders', 'allWorkspaces'], 'All workspaces'],
  currentWorkspace: [['topSpenders', 'currentWorkspace'], 'Current workspace'],
  sortByAmount: [['topSpenders', 'sortByAmount'], 'Sort by amount'],
  sortByAverage: [['topSpenders', 'sortByAverage'], 'Sort by average'],
  sortByOperations: [['topSpenders', 'sortByOperations'], 'Sort by operations'],
  vsPreviousPeriod: [['topSpenders', 'vsPreviousPeriod'], 'vs previous period'],
  comparisonNoData: [['topSpenders', 'comparisonNoData'], 'No previous period data'],
  drillDown: [['topSpenders', 'drillDown'], 'Operations'],
  close: [['common', 'close'], 'Close'],
  noOperations: [['topSpenders', 'noOperations'], 'No operations found'],
  filters: [['filters', 'filters'], 'Filters'],
  type: [['filters', 'type'], 'Type'],
  status: [['filters', 'status'], 'Status'],
  date: [['filters', 'date'], 'Date'],
  from: [['filters', 'from'], 'From'],
  apply: [['filters', 'apply'], 'Apply'],
  reset: [['filters', 'reset'], 'Reset'],
  loadError: [[], 'Failed to load spending data'],
};

export const buildTopSpendersLabels = (tx: TxFn): Record<string, string> =>
  Object.fromEntries(
    Object.entries(LABEL_PATHS).map(([k, [p, f]]) => [k, p.length === 0 ? f : tx(p, f)]),
  );

export const createTx =
  (t: unknown): TxFn =>
  (path, fallback) =>
    resolveLabel(getNestedValue(t, path), fallback);
