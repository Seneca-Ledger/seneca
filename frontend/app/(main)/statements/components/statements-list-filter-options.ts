import type { StatementParsingDetails } from '@/app/lib/contracts';
import type { StatementFilters } from './filters/statement-filters';
import { getBankDisplayName, listUiText, resolveStatementCurrency } from './statement-state';
import { StatementForFromOptions } from './statements-list-labels';

export const buildTypeOptions = (
  labels: Record<string, string>,
): Array<{ value: string; label: string }> => [
  { value: 'receipt', label: labels.columnReceipt },
  { value: 'expense', label: labels.typeExpense },
  { value: 'expense_report', label: labels.typeReport },
  { value: 'chat', label: labels.typeChat },
  { value: 'trip', label: labels.typeTrip },
  { value: 'task', label: labels.typeTask },
  { value: 'pdf', label: 'PDF' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'image', label: labels.typeImage },
];

export const buildStatusOptions = (
  labels: Record<string, string>,
): Array<{ value: string; label: string }> => [
  { value: 'uploaded', label: labels.statusUploaded },
  { value: 'processing', label: labels.statusProcessing },
  { value: 'parsed', label: labels.statusParsed },
  { value: 'validated', label: labels.statusValidated },
  { value: 'completed', label: labels.statusCompleted },
  { value: 'error', label: labels.statusError },
];

export const buildDatePresets = (
  labels: Record<string, string>,
): Array<{ value: 'thisMonth' | 'lastMonth' | 'yearToDate'; label: string }> => [
  { value: 'thisMonth', label: labels.dateThisMonth },
  { value: 'lastMonth', label: labels.dateLastMonth },
  { value: 'yearToDate', label: labels.dateYearToDate },
];

export const buildDateModes = (
  labels: Record<string, string>,
): Array<{ value: 'on' | 'after' | 'before'; label: string }> => [
  { value: 'on', label: labels.dateOn },
  { value: 'after', label: labels.dateAfter },
  { value: 'before', label: labels.dateBefore },
];

export const buildGroupByOptions = (
  labels: Record<string, string>,
): Array<{ value: string; label: string }> => [
  { value: 'date', label: labels.groupByDate },
  { value: 'status', label: labels.groupByStatus },
  { value: 'type', label: labels.groupByType },
  { value: 'bank', label: labels.groupByBank },
  { value: 'user', label: labels.groupByUser },
  { value: 'amount', label: labels.groupByAmount },
];

export const buildHasOptions = (
  labels: Record<string, string>,
): Array<{ value: string; label: string }> => [
  { value: 'errors', label: labels.hasErrors },
  { value: 'processingDetails', label: labels.hasLogs },
  { value: 'transactions', label: labels.hasTransactions },
  { value: 'dateRange', label: labels.hasDateRange },
  { value: 'currency', label: labels.hasCurrency },
];

export const buildFromOptions = (
  stagedStatements: StatementForFromOptions[],
): Array<{
  id: string;
  label: string;
  description?: string | null;
  avatarUrl?: string | null;
  iconUrl?: string | null;
  bankName?: string | null;
}> => {
  const text = listUiText();
  const seen = new Map<
    string,
    {
      id: string;
      label: string;
      description?: string | null;
      avatarUrl?: string | null;
      iconUrl?: string | null;
      bankName?: string | null;
    }
  >();

  for (const statement of stagedStatements) {
    if (statement.user?.id) {
      const key = `user:${statement.user.id}`;
      if (!seen.has(key)) {
        seen.set(key, {
          id: key,
          label: statement.user.name ?? statement.user.email ?? text.user.value,
          description: statement.user.email ? `@${statement.user.email.split('@')[0]}` : null,
          avatarUrl: statement.user.avatarUrl ?? null,
        });
      }
    }
    if (statement.bankName) {
      const key = `bank:${statement.bankName}`;
      if (!seen.has(key)) {
        const hasRealBank = statement.bankName !== 'other';
        const isStore = statement.source === 'scan' && !hasRealBank;
        seen.set(key, {
          id: key,
          label: isStore ? text.typeReceipt.value : getBankDisplayName(statement.bankName),
          description: null,
          iconUrl: null,
          bankName: statement.bankName,
        });
      }
    }
  }

  return Array.from(seen.values());
};

export interface StatementForCurrencyOptions {
  parsedData?: { currency?: string };
  currency?: string | null;
  parsingDetails?: StatementParsingDetails | null;
}

export const buildCurrencyOptions = (stagedStatements: StatementForCurrencyOptions[]): string[] => {
  const unique = new Set<string>();
  for (const statement of stagedStatements) {
    const currency = resolveStatementCurrency(statement);
    if (currency) {
      unique.add(currency);
    }
  }
  return Array.from(unique.values());
};

export const computeActiveFilterCount = (appliedFilters: StatementFilters): number => {
  let count = 0;
  if (appliedFilters.type) {
    count += 1;
  }
  if (appliedFilters.statuses.length > 0) {
    count += 1;
  }
  if (appliedFilters.date?.preset || appliedFilters.date?.mode) {
    count += 1;
  }
  if (appliedFilters.from.length > 0) {
    count += 1;
  }
  if (appliedFilters.to.length > 0) {
    count += 1;
  }
  if (appliedFilters.keywords.trim()) {
    count += 1;
  }
  if (appliedFilters.amountMin !== null || appliedFilters.amountMax !== null) {
    count += 1;
  }
  if (appliedFilters.approved !== null) {
    count += 1;
  }
  if (appliedFilters.billable !== null) {
    count += 1;
  }
  if (appliedFilters.groupBy) {
    count += 1;
  }
  if (appliedFilters.has.length > 0) {
    count += 1;
  }
  if (appliedFilters.currencies.length > 0) {
    count += 1;
  }
  if (appliedFilters.exported !== null) {
    count += 1;
  }
  if (appliedFilters.paid !== null) {
    count += 1;
  }
  if (appliedFilters.limit !== null) {
    count += 1;
  }
  return count;
};
