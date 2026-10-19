import type {
  AggregateSortKey as SharedAggregateSortKey,
  ComparisonTrend as SharedComparisonTrend,
  SourceChannel,
  SourceType,
} from './shared-analytics.utils';
import {
  buildPreviousPeriodRange as buildPreviousPeriodRangeBase,
  getComparisonDelta as getComparisonDeltaBase,
  resolveAmountFlow,
  resolveSourceChannel as resolveSourceChannelBase,
  sortAggregateRows as sortAggregateRowsBase,
} from './shared-analytics.utils';

export type TopMerchantFlowType = 'spend' | 'income';
export type TopMerchantSourceType = SourceType;
export type TopMerchantSourceChannel = SourceChannel;
export type ComparisonTrend = SharedComparisonTrend;

export type AggregateSortKey = SharedAggregateSortKey;

export type TopMerchantAggregateRow = {
  id: string;
  merchant: string;
  sourceType: TopMerchantSourceType;
  sourceChannel: TopMerchantSourceChannel;
  flowType: TopMerchantFlowType;
  count: number;
  total: number;
  average: number;
  lastDate: string;
  currency: string;
};

type ResolveMerchantFlowInput = {
  sourceType: TopMerchantSourceType;
  debit?: number | string | null;
  credit?: number | string | null;
  amount?: number | string | null;
  transactionType?: 'income' | 'expense' | null;
};

type ResolveSourceChannelInput = {
  sourceType: TopMerchantSourceType;
  fileType?: string | null;
  isCrypto?: boolean;
};

export const resolveMerchantFlow = (
  input: ResolveMerchantFlowInput,
): { flowType: 'income' | 'spend'; amount: number } => {
  return resolveAmountFlow({
    sourceType: input.sourceType,
    debit: input.debit,
    credit: input.credit,
    amount: input.amount,
    transactionType: input.transactionType,
    expenseFlowType: 'spend',
  });
};

export const resolveSourceChannel = (
  input: ResolveSourceChannelInput,
): TopMerchantSourceChannel => {
  return resolveSourceChannelBase(input);
};

export const sortAggregateRows = (
  rows: TopMerchantAggregateRow[],
  key: AggregateSortKey,
): TopMerchantAggregateRow[] => {
  return sortAggregateRowsBase(rows, key);
};

export const buildPreviousPeriodRange = (
  currentStart: Date,
  currentEnd: Date,
): { start: Date; end: Date } | null => {
  return buildPreviousPeriodRangeBase(currentStart, currentEnd);
};

export const getComparisonDelta = (
  current: number,
  previous: number,
): { delta: number; percentage: number; trend: SharedComparisonTrend } => {
  return getComparisonDeltaBase(current, previous);
};
