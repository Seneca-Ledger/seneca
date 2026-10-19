import { FLOW_LABEL_PATHS } from '@/app/(main)/statements/components/analytics/flow/flow-label-paths';
import { getNestedValue, resolveLabel } from '@/app/lib/analytics-common';

type TxFn = (path: string[], fallback: string) => string;

const LABEL_PATHS: Record<string, [string[], string]> = {
  ...FLOW_LABEL_PATHS,
  title: [['topMerchants', 'title'], 'Top merchants'],
  subtitle: [['topMerchants', 'subtitle'], 'Spending analytics by merchants and counterparties.'],
  totalSpend: [['topMerchants', 'totalSpend'], 'Total spend'],
  statementsSpend: [['topMerchants', 'statementsSpend'], 'Statements'],
  receiptsSpend: [['topMerchants', 'receiptsSpend'], 'Receipts'],
  totalOperations: [['topMerchants', 'totalOperations'], 'Operations'],
  topMerchants: [['topMerchants', 'topMerchants'], 'Top merchants'],
  topIncomeSenders: [['topMerchants', 'topIncomeSenders'], 'Top income senders'],
  sourceSplit: [['topMerchants', 'sourceSplit'], 'Source split'],
  spendTrend: [['topMerchants', 'spendTrend'], 'Spending trend'],
  incomeTrend: [['topMerchants', 'incomeTrend'], 'Income trend'],
  leaderboard: [['topMerchants', 'leaderboard'], 'Top merchants list'],
  incomeLeaderboard: [['topMerchants', 'incomeLeaderboard'], 'Top income senders list'],
  totalIncome: [['topMerchants', 'totalIncome'], 'Total income'],
  tabSpenders: [['topMerchants', 'tabSpenders'], 'Top merchants'],
  tabIncomeSenders: [['topMerchants', 'tabIncomeSenders'], 'Top income senders'],
  source: [['topMerchants', 'source'], 'Source'],
  merchant: [['topMerchants', 'merchant'], 'Merchant'],
  amount: [['topMerchants', 'amount'], 'Amount'],
  operations: [['topMerchants', 'operations'], 'Operations'],
  average: [['topMerchants', 'average'], 'Average'],
  lastOperation: [['topMerchants', 'lastOperation'], 'Last operation'],
  sourceStatement: [['topMerchants', 'sourceStatement'], 'Statement'],
  sourceGmail: [['topMerchants', 'sourceGmail'], 'Receipt'],
  sourceBank: [['topMerchants', 'sourceBank'], 'Bank'],
  sourceReceipt: [['topMerchants', 'sourceReceipt'], 'Receipt'],
  sourceGmailInbox: [['topMerchants', 'sourceGmailInbox'], 'Gmail'],
  sourceCrypto: [['topMerchants', 'sourceCrypto'], 'Crypto'],
  workspace: [['topMerchants', 'workspace'], 'Workspace'],
  allWorkspaces: [['topMerchants', 'allWorkspaces'], 'All workspaces'],
  currentWorkspace: [['topMerchants', 'currentWorkspace'], 'Current workspace'],
  sortByAmount: [['topMerchants', 'sortByAmount'], 'Sort by amount'],
  sortByAverage: [['topMerchants', 'sortByAverage'], 'Sort by average'],
  sortByOperations: [['topMerchants', 'sortByOperations'], 'Sort by operations'],
  vsPreviousPeriod: [['topMerchants', 'vsPreviousPeriod'], 'vs previous period'],
  comparisonNoData: [['topMerchants', 'comparisonNoData'], 'No previous period data'],
  drillDown: [['topMerchants', 'drillDown'], 'Operations'],
  close: [['common', 'close'], 'Close'],
  noOperations: [['topMerchants', 'noOperations'], 'No operations found'],
  filters: [['filters', 'filters'], 'Filters'],
  type: [['filters', 'type'], 'Type'],
  status: [['filters', 'status'], 'Status'],
  date: [['filters', 'date'], 'Date'],
  from: [['filters', 'from'], 'From'],
  apply: [['filters', 'apply'], 'Apply'],
  reset: [['filters', 'reset'], 'Reset'],
  loadError: [[], 'Failed to load spending data'],
};

export const buildTopMerchantsLabels = (tx: TxFn): Record<string, string> =>
  Object.fromEntries(
    Object.entries(LABEL_PATHS).map(([k, [p, f]]) => [k, p.length === 0 ? f : tx(p, f)]),
  );

export const createTx =
  (t: unknown): TxFn =>
  (path, fallback) =>
    resolveLabel(getNestedValue(t, path), fallback);
