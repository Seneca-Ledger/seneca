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

export type TopSpenderFlowType = 'spend' | 'income';
export type TopSpenderSourceType = SourceType;
export type TopSpenderSourceChannel = SourceChannel;
export type ComparisonTrend = SharedComparisonTrend;

export type AggregateSortKey = SharedAggregateSortKey;

export type TopSpenderAggregateRow = {
  id: string;
  company: string;
  sourceType: TopSpenderSourceType;
  sourceChannel: TopSpenderSourceChannel;
  flowType: TopSpenderFlowType;
  count: number;
  total: number;
  average: number;
  lastDate: string;
  currency: string;
};

type ResolveSpenderFlowInput = {
  sourceType: TopSpenderSourceType;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
};

type ResolveSourceChannelInput = {
  sourceType: TopSpenderSourceType;
  fileType?: string | null;
};

export const resolveSpenderFlow = (
  input: ResolveSpenderFlowInput,
): { flowType: 'income' | 'spend'; amount: number } => {
  return resolveAmountFlow({
    sourceType: input.sourceType,
    debit: input.totalDebit,
    credit: input.totalCredit,
    amount: input.totalDebit,
    expenseFlowType: 'spend',
    gmailUsesTransactionType: false,
  });
};

export const resolveSourceChannel = (input: ResolveSourceChannelInput): TopSpenderSourceChannel => {
  return resolveSourceChannelBase(input);
};

export const sortAggregateRows = (
  rows: TopSpenderAggregateRow[],
  key: AggregateSortKey,
): TopSpenderAggregateRow[] => {
  return sortAggregateRowsBase(rows, key);
};

export const buildTopSpendersStatementsParams = (
  page: number,
  limit: number,
): { page: number; limit: number } => ({
  page,
  limit,
});

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
