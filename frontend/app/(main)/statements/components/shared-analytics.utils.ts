export type ComparisonTrend = 'up' | 'down' | 'flat';
export type SourceType = 'statement' | 'gmail';
export type SourceChannel = 'bank' | 'receipt' | 'gmail' | 'crypto';
export type AggregateSortKey = 'amount' | 'average' | 'operations';
export type AnalyticsFromOption = {
  id: string;
  label: string;
  description?: string | null;
  bankName?: string | null;
};

type AggregateRow = {
  count: number;
  total: number;
  average: number;
};

type ResolveSourceChannelInput = {
  sourceType: SourceType;
  fileType?: string | null;
  /** Wallet-synced rows carry no statement and must not read as a bank export. */
  isCrypto?: boolean;
};

type ResolveAmountFlowInput<TExpenseFlowType extends string> = {
  sourceType: SourceType;
  debit?: number | string | null;
  credit?: number | string | null;
  amount?: number | string | null;
  transactionType?: 'income' | 'expense' | 'transfer' | 'unknown' | null;
  expenseFlowType: TExpenseFlowType;
  gmailUsesTransactionType?: boolean;
};

const RECEIPT_FILE_TYPES = new Set(['pdf', 'image', 'jpg', 'jpeg', 'png', 'csv', 'xlsx']);

export const parseAmount = (value?: number | string | null): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.abs(parsed);
};

export const resolveSourceChannel = (input: ResolveSourceChannelInput): SourceChannel => {
  if (input.isCrypto) {
    return 'crypto';
  }
  if (input.sourceType === 'gmail') {
    return 'gmail';
  }
  const normalizedType = String(input.fileType || '').toLowerCase();
  if (RECEIPT_FILE_TYPES.has(normalizedType)) {
    return 'receipt';
  }
  return 'bank';
};

export const sortAggregateRows = <TRow extends AggregateRow>(
  rows: TRow[],
  key: AggregateSortKey,
): TRow[] => {
  return [...rows].sort((a, b) => {
    if (key === 'average') {
      return b.average - a.average;
    }
    if (key === 'operations') {
      return b.count - a.count;
    }
    return b.total - a.total;
  });
};

export const buildPreviousPeriodRange = (
  currentStart: Date,
  currentEnd: Date,
): { start: Date; end: Date } | null => {
  if (Number.isNaN(currentStart.getTime()) || Number.isNaN(currentEnd.getTime())) {
    return null;
  }
  const startTime = currentStart.getTime();
  const endTime = currentEnd.getTime();
  if (endTime < startTime) {
    return null;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const periodDays = Math.floor((endTime - startTime) / dayMs) + 1;
  const previousEnd = new Date(startTime - dayMs);
  const previousStart = new Date(previousEnd.getTime() - dayMs * (periodDays - 1));

  return {
    start: previousStart,
    end: previousEnd,
  };
};

export const getComparisonDelta = (
  current: number,
  previous: number,
): { delta: number; percentage: number; trend: ComparisonTrend } => {
  const delta = current - previous;
  const trend: ComparisonTrend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  if (previous === 0) {
    return {
      delta,
      percentage: current === 0 ? 0 : 100,
      trend,
    };
  }

  return {
    delta,
    percentage: Number(((delta / previous) * 100).toFixed(1)),
    trend,
  };
};

/* eslint-disable complexity */
export const resolveAmountFlow = <TExpenseFlowType extends string>(
  input: ResolveAmountFlowInput<TExpenseFlowType>,
): { flowType: 'income' | TExpenseFlowType; amount: number } => {
  if (input.sourceType === 'gmail') {
    const gmailFlowType =
      input.gmailUsesTransactionType === false
        ? input.expenseFlowType
        : input.transactionType === 'income'
          ? 'income'
          : input.expenseFlowType;

    return {
      flowType: gmailFlowType,
      amount: parseAmount(input.amount),
    };
  }

  const debit = parseAmount(input.debit);
  if (debit > 0) {
    return {
      flowType: input.expenseFlowType,
      amount: debit,
    };
  }

  const credit = parseAmount(input.credit);
  if (credit > 0) {
    return {
      flowType: 'income',
      amount: credit,
    };
  }

  return {
    flowType: input.transactionType === 'income' ? 'income' : input.expenseFlowType,
    amount: parseAmount(input.amount),
  };
};
/* eslint-enable complexity */

export const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
