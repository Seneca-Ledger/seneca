import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import type {
  SourceChannel,
  SourceType,
} from '@/app/(main)/statements/components/shared-analytics.utils';
import {
  resolveAmountFlow,
  resolveSourceChannel as resolveSourceChannelBase,
  sortAggregateRows,
} from '@/app/(main)/statements/components/shared-analytics.utils';

export type TopCategoryFlowType = 'spend' | 'income';
export type TopCategorySourceType = SourceType;
export type TopCategorySourceChannel = SourceChannel;
export type CategorySortKey = 'amount' | 'average' | 'operations';

export type TopCategoryRecord = StatementFilterItem & {
  sourceType: TopCategorySourceType;
  sourceChannel: TopCategorySourceChannel;
  flowType: TopCategoryFlowType;
  category: string;
  amount: number;
  currencyValue: string;
  dateValue: string;
  transactionId?: string | null;
  color?: string | null;
  icon?: string | null;
  workspaceId?: string;
  workspaceName?: string;
  paymentPurpose?: string | null;
  counterpartyName?: string | null;
};

export type TopCategoryAggregateRow = {
  id: string;
  category: string;
  sourceType: TopCategorySourceType;
  sourceChannel: TopCategorySourceChannel;
  flowType: TopCategoryFlowType;
  count: number;
  total: number;
  average: number;
  lastDate: string;
  currency: string;
  color?: string | null;
  icon?: string | null;
};

type ResolveCategoryFlowInput = {
  sourceType: TopCategorySourceType;
  debit?: number | string | null;
  credit?: number | string | null;
  amount?: number | string | null;
  transactionType?: 'income' | 'expense' | 'transfer' | 'unknown' | null;
};

export const resolveCategoryFlow = (
  input: ResolveCategoryFlowInput,
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

export const resolveCategoryName = (name?: string | null): string => {
  const normalized = (name || '').trim();
  return normalized || 'Uncategorized';
};

export const dedupeCategoryReceiptRecords = (
  receipts: TopCategoryRecord[],
  existingTransactionIds: Set<string>,
): TopCategoryRecord[] => {
  return receipts.filter(receipt => {
    if (!receipt.transactionId) {
      return true;
    }
    return !existingTransactionIds.has(receipt.transactionId);
  });
};

// eslint-disable-next-line max-lines-per-function
export const createCategoryAggregateRows = (
  records: TopCategoryRecord[],
): TopCategoryAggregateRow[] => {
  const aggregate = new Map<string, TopCategoryAggregateRow>();

  // eslint-disable-next-line complexity
  records.forEach(record => {
    const normalizedCategory = resolveCategoryName(record.category);
    const key = `${record.flowType}:${record.sourceChannel}:${record.currencyValue}:${normalizedCategory.toLowerCase()}`;
    const existing = aggregate.get(key);
    const date = record.dateValue || record.createdAt || '';

    if (!existing) {
      aggregate.set(key, {
        id: key,
        category: normalizedCategory,
        sourceType: record.sourceType,
        sourceChannel: record.sourceChannel,
        flowType: record.flowType,
        count: 1,
        total: record.amount,
        average: record.amount,
        lastDate: date,
        currency: record.currencyValue,
        color: record.color ?? null,
        icon: record.icon ?? null,
      });
      return;
    }

    existing.count += 1;
    existing.total += record.amount;
    existing.average = existing.total / existing.count;
    existing.lastDate =
      new Date(date).getTime() > new Date(existing.lastDate || 0).getTime()
        ? date
        : existing.lastDate;

    if (!existing.color && record.color) {
      existing.color = record.color;
    }

    if (!existing.icon && record.icon) {
      existing.icon = record.icon;
    }
  });

  return Array.from(aggregate.values());
};

export const sortCategoryRows = (
  rows: TopCategoryAggregateRow[],
  key: CategorySortKey,
): TopCategoryAggregateRow[] => {
  return sortAggregateRows(rows, key);
};

export const resolveCategorySourceChannel = (input: {
  sourceType: TopCategorySourceType;
  fileType?: string | null;
  isCrypto?: boolean;
}): TopCategorySourceChannel => {
  return resolveSourceChannelBase(input);
};
