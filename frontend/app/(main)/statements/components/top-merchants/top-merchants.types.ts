import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import type {
  AggregateSortKey,
  SourceChannel,
  SourceType,
} from '@/app/(main)/statements/components/shared-analytics.utils';

export type { AggregateSortKey };
export type TopMerchantFlowType = 'spend' | 'income';
export type TopMerchantSourceType = SourceType;
export type TopMerchantSourceChannel = SourceChannel;

export type TopMerchantRecord = StatementFilterItem & {
  sourceType: 'statement' | 'receipt';
  sourceChannel: TopMerchantSourceChannel;
  flowType: TopMerchantFlowType;
  merchant: string;
  amount: number;
  currencyValue: string;
  dateValue: string;
  paymentPurpose?: string | null;
  workspaceId?: string;
  workspaceName?: string;
};

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
