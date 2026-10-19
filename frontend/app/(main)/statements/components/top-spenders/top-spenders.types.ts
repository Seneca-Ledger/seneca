import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import type {
  AggregateSortKey,
  SourceChannel,
  SourceType,
} from '@/app/(main)/statements/components/shared-analytics.utils';
import {
  resolveAmountFlow,
  resolveSourceChannel as resolveSourceChannelBase,
} from '@/app/(main)/statements/components/shared-analytics.utils';

export type { AggregateSortKey };
export type TopSpenderFlowType = 'spend' | 'income';
export type TopSpenderSourceType = SourceType;
export type TopSpenderSourceChannel = SourceChannel;

export type TopSpenderRecord = StatementFilterItem & {
  sourceType: 'statement' | 'gmail';
  sourceChannel: TopSpenderSourceChannel;
  flowType: TopSpenderFlowType;
  company: string;
  amount: number;
  currencyValue: string;
  dateValue: string;
  workspaceId?: string;
  workspaceName?: string;
};

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
): ReturnType<typeof resolveAmountFlow> => {
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
