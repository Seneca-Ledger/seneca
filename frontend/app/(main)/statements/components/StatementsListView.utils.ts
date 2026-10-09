/* eslint-disable max-lines */

import { resolveBankLogo } from '@bank-logos';
import { getIntlayer } from 'react-intlayer';
import { DEFAULT_LOCALE, readLocaleFromCookie } from '@/app/lib/locale';
import { resolveLabel } from '@/app/lib/side-panel-utils';
import type { StatementCategoryNode } from '@/app/lib/statement-categories';
import { formatStoredDate } from '@/app/lib/user-format-store';
import {
  getAllowedStatementFilterKeys,
  resetDisallowedStatementFilters,
  type StatementColumn,
  type StatementColumnId,
} from './columns/statement-columns';
import {
  getVisibleFilterScreens,
  resetHiddenStatementFilters,
  type StatementFilterScreen,
  serializeStatementFiltersToQuery,
} from './filters/server-statement-filters';
import type { StatementFilters } from './filters/statement-filters';
import type { StatementUploadLabels } from './statement-upload';

/** Labels produced by buildFilterLabels (consumed by StatementsListHeader). */
export type FilterLabels = {
  type: string;
  status: string;
  date: string;
  from: string;
  filters: string;
  columns: string;
};

/** Labels produced by buildFilterOptionLabels (consumed by StatementsListHeader). */
export type FilterOptionLabels = {
  apply: string;
  reset: string;
  resetFilters: string;
  viewResults: string;
  save: string;
  saveSearch: string;
  any: string;
  yes: string;
  no: string;
  typeExpense: string;
  typeReport: string;
  typeChat: string;
  typeTrip: string;
  typeTask: string;
  typeImage: string;
  statusUploaded: string;
  statusProcessing: string;
  statusParsed: string;
  statusValidated: string;
  statusCompleted: string;
  statusError: string;
  dateThisMonth: string;
  dateLastMonth: string;
  dateYearToDate: string;
  dateOn: string;
  dateAfter: string;
  dateBefore: string;
  drawerTitle: string;
  drawerGeneral: string;
  drawerExpenses: string;
  drawerReports: string;
  drawerGroupBy: string;
  drawerHas: string;
  drawerKeywords: string;
  drawerLimit: string;
  drawerTo: string;
  drawerAmount: string;
  drawerApproved: string;
  drawerBillable: string;
  groupByDate: string;
  groupByStatus: string;
  groupByType: string;
  groupByBank: string;
  groupByUser: string;
  groupByAmount: string;
  hasErrors: string;
  hasLogs: string;
  hasTransactions: string;
  hasDateRange: string;
  hasCurrency: string;
  columnReceipt: string;
  columnDate: string;
  columnMerchant: string;
  columnFrom: string;
  columnTo: string;
  columnCategory: string;
  columnTag: string;
  columnAmount: string;
  columnAction: string;
  columnApproved: string;
  columnBillable: string;
  columnCard: string;
  columnDescription: string;
  columnExchangeRate: string;
  columnExported: string;
  columnsTitle: string;
  paid: string;
};

const UI_ONLY_BANK_FILTER_IDS = new Set(['bank:receipt', 'bank:gmail']);

// ---------------------------------------------------------------------------
// Structural types used by helper functions below.
// These mirror fields from the component's Statement interface without
// creating a circular import.
// ---------------------------------------------------------------------------

/** Minimal shape required by formatting & status helpers. */
export type StatementLike = {
  id: string;
  source?: string;
  receiptSource?: string;
  status: string;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
  currency?: string | null;
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
  };
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  receivedAt?: string;
  createdAt?: string;
  parsingDetails?: {
    metadataExtracted?: {
      currency?: string;
      headerDisplay?: { currencyDisplay?: string };
    };
    importPreview?: {
      source?: string;
      attachments?: number;
      description?: string;
      merchant?: string;
      categoryId?: string;
    };
  };
};

export type DuplicateGroupTone = 'sky' | 'blue' | 'indigo' | 'slate' | 'zinc' | 'stone';

export type StatementCategoryWithEnabled = StatementCategoryNode & {
  isEnabled?: boolean;
  children?: StatementCategoryWithEnabled[];
};

type ReceiptDerivedStatementCandidate = {
  parsingDetails?: {
    detectedBy?: string;
    importPreview?: {
      source?: string;
    };
  };
};

type StatementViewCandidate = {
  id: string;
  statementId?: string | null;
  source?: string;
  status: string;
};

type StatementViewAction = { type: 'route'; href: string };

// ---------------------------------------------------------------------------
// Statement status helpers
// ---------------------------------------------------------------------------

export const isStatementParsingInProgress = (statement: Pick<StatementLike, 'status'>): boolean => {
  const status = (statement.status || '').toLowerCase();
  return status === 'uploaded' || status === 'processing';
};

export const isReceiptProcessing = (
  statement: Pick<StatementLike, 'source' | 'status'>,
): boolean => {
  if (statement.source !== 'gmail' && statement.source !== 'scan') {
    return false;
  }
  const status = (statement.status || '').toLowerCase();
  return status === 'new' || status === 'processing';
};

export const isGmailStatement = (statement: Pick<StatementLike, 'source'>): boolean =>
  statement.source === 'gmail';

export const isScanReceiptStatement = (statement: Pick<StatementLike, 'source'>): boolean =>
  statement.source === 'scan';

export const isStoreReceiptStatement = (
  statement: Pick<StatementLike, 'source' | 'receiptSource'>,
): boolean => statement.source === 'scan' && statement.receiptSource !== 'gmail';

// ---------------------------------------------------------------------------
// Statement formatting helpers
// ---------------------------------------------------------------------------

type StatementCurrencyLike = {
  parsedData?: { currency?: string };
  currency?: string | null;
  parsingDetails?: {
    metadataExtracted?: { currency?: string; headerDisplay?: { currencyDisplay?: string } };
  };
};

// eslint-disable-next-line complexity
export const resolveStatementCurrency = (statement: StatementCurrencyLike): string =>
  (
    statement.parsedData?.currency ||
    statement.currency ||
    statement.parsingDetails?.metadataExtracted?.currency ||
    statement.parsingDetails?.metadataExtracted?.headerDisplay?.currencyDisplay ||
    ''
  ).toString();

export const parseAmountValue = (value?: number | string | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

// eslint-disable-next-line complexity
export const formatStatementAmount = (statement: StatementLike): string => {
  if (statement.source === 'gmail' || statement.source === 'scan') {
    const amount = parseAmountValue(statement.parsedData?.amount ?? null);
    if (amount === null) {
      return '-';
    }
    const currency = resolveStatementCurrency(statement);
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted}${currency || ''}`;
  }

  if (isStatementParsingInProgress(statement)) {
    const debit = parseAmountValue(statement.totalDebit);
    const credit = parseAmountValue(statement.totalCredit);
    const hasResolvedAmount = (debit !== null && debit > 0) || (credit !== null && credit > 0);
    if (!hasResolvedAmount) {
      return '-';
    }
  }

  const debit = parseAmountValue(statement.totalDebit);
  const credit = parseAmountValue(statement.totalCredit);
  const rawAmount = (debit && debit > 0 ? debit : credit && credit > 0 ? credit : 0) || 0;
  const currency = resolveStatementCurrency(statement);
  const formatted =
    rawAmount === 0
      ? '0'
      : new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(rawAmount);
  return `${formatted}${currency || ''}`;
};

const resolveReceiptDateValue = (statement: StatementLike): string => {
  // Scan receipts: use upload time so newly uploaded items appear at the top.
  // Gmail receipts: use parsed transaction date (close to received date).
  if (statement.source === 'scan') {
    return statement.receivedAt || statement.createdAt || statement.parsedData?.date || '';
  }
  return statement.parsedData?.date || statement.receivedAt || statement.createdAt || '';
};

// eslint-disable-next-line complexity
export const formatStatementDate = (statement: StatementLike): string => {
  const dateValue =
    statement.source === 'gmail' || statement.source === 'scan'
      ? resolveReceiptDateValue(statement)
      : statement.statementDateTo || statement.statementDateFrom || statement.createdAt || '';
  if (!dateValue) {
    return '—';
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return formatStoredDate(date);
};

// eslint-disable-next-line complexity
export const resolveStatementSortDate = (statement: StatementLike): number => {
  const dateValue =
    statement.source === 'gmail' || statement.source === 'scan'
      ? resolveReceiptDateValue(statement)
      : statement.statementDateTo || statement.statementDateFrom || statement.createdAt || '';
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 0;
  }
  return date.getTime();
};

export const getBankDisplayName = (bankName: string): string => {
  const resolved = resolveBankLogo(bankName);
  if (!resolved) {
    return bankName;
  }
  return resolved.key !== 'other' ? resolved.displayName : bankName;
};

// ---------------------------------------------------------------------------
// Duplicate detection helpers
// ---------------------------------------------------------------------------

/** Module-level helpers cannot use hooks; read the dictionary for the cookie locale. */
const listUiText = () => getIntlayer('statementsListUi', readLocaleFromCookie() ?? DEFAULT_LOCALE);

export const toDuplicateGroupLabel = (index: number): string => {
  let current = index + 1;
  let label = '';
  while (current > 0) {
    const code = (current - 1) % 26;
    label = String.fromCharCode(65 + code) + label;
    current = Math.floor((current - 1) / 26);
  }
  return listUiText().groupLabel.value.replace('{label}', label);
};

export const DUPLICATE_GROUP_TONES: DuplicateGroupTone[] = [
  'sky',
  'blue',
  'indigo',
  'slate',
  'zinc',
  'stone',
];

// ---------------------------------------------------------------------------
// API endpoint helpers
// ---------------------------------------------------------------------------

export const getBulkActionErrorOptions = (id: string): { id: string } => ({ id });

export const getExportEndpoint = (
  statement: Pick<StatementLike, 'id' | 'source' | 'receiptSource'>,
): string =>
  statement.source === 'gmail' || isScanReceiptStatement(statement)
    ? `/receipts/${statement.id}/file`
    : `/statements/${statement.id}/file`;

export const getDeleteEndpoint = (
  statement: Pick<StatementLike, 'id' | 'source' | 'receiptSource'>,
): string =>
  statement.source === 'gmail' || isScanReceiptStatement(statement)
    ? `/receipts/${statement.id}`
    : `/statements/${statement.id}`;

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

export const filterEnabledCategories = (
  categories: StatementCategoryWithEnabled[],
): StatementCategoryNode[] =>
  categories
    .filter(category => category.isEnabled !== false)
    .map(category => ({
      id: category.id,
      name: category.name,
      children: category.children ? filterEnabledCategories(category.children) : undefined,
    }));

// ---------------------------------------------------------------------------
// Existing helpers (unchanged)
// ---------------------------------------------------------------------------

export const buildStatementRequestParams = ({
  appliedFilters,
  categoryId,
  search,
}: {
  appliedFilters: StatementFilters;
  categoryId?: string | null;
  search?: string;
}): Record<string, unknown> => {
  const serverSafeFilters: StatementFilters = {
    ...appliedFilters,
    type:
      appliedFilters.type === 'receipt' || appliedFilters.type === 'gmail'
        ? null
        : appliedFilters.type,
    from: appliedFilters.from.filter(value => !UI_ONLY_BANK_FILTER_IDS.has(value.toLowerCase())),
    to: appliedFilters.to.filter(value => !UI_ONLY_BANK_FILTER_IDS.has(value.toLowerCase())),
  };

  return {
    ...serializeStatementFiltersToQuery(serverSafeFilters),
    ...(categoryId ? { categoryId } : {}),
    ...(search ? { search } : {}),
  };
};

export const isReceiptDerivedStatement = (statement: ReceiptDerivedStatementCandidate): boolean => {
  return (
    statement.parsingDetails?.detectedBy === 'receipt-scan' ||
    statement.parsingDetails?.importPreview?.source === 'receipt-scan'
  );
};

export const resolveStatementViewAction = (
  statement: StatementViewCandidate,
): StatementViewAction => {
  if (statement.source === 'gmail') {
    return { type: 'route', href: `/storage/gmail-receipts/${statement.id}` };
  }

  if (statement.source === 'scan') {
    return { type: 'route', href: `/storage/receipts/${statement.id}` };
  }

  // `needs_review` belongs here too: the statement is parsed and has transactions
  // to inspect, and the edit page is where the balance discrepancy is confirmed.
  // Routing it to storage instead would hide the only way to release it.
  if (
    statement.status === 'completed' ||
    statement.status === 'parsed' ||
    statement.status === 'validated' ||
    statement.status === 'needs_review'
  ) {
    return { type: 'route', href: `/statements/${statement.id}/edit` };
  }

  return { type: 'route', href: `/storage/${statement.id}` };
};

const SETTLED_RECEIPT_STATUSES = new Set(['approved', 'rejected', 'failed']);

/**
 * How much of a document still waits in Review: a statement's undecided rows,
 * or one for a receipt that has not been approved (or dropped) yet.
 */
export const resolvePendingReview = (
  document: { id: string; status: string },
  isReceipt: boolean,
  statementReviewCounts: Record<string, number>,
): number => {
  if (isReceipt) {
    return SETTLED_RECEIPT_STATUSES.has(document.status) ? 0 : 1;
  }
  return statementReviewCounts[document.id] ?? 0;
};

export const paginateStatements = <T>(statements: T[], page: number, pageSize: number): T[] => {
  if (pageSize <= 0) {
    return [];
  }
  const currentPage = Math.max(1, page);
  const start = (currentPage - 1) * pageSize;
  return statements.slice(start, start + pageSize);
};

export const deriveVisibleFilterScreens = (
  columns: Array<Pick<StatementColumn, 'id' | 'visible'>>,
): StatementFilterScreen[] => {
  const visibleColumnIds = columns.filter(column => column.visible).map(column => column.id);
  return getVisibleFilterScreens(visibleColumnIds);
};

export const formatPaginationLabel = (
  template: string,
  values: Record<string, string | number>,
): string =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );

export const reconcileFiltersWithColumns = ({
  columns,
  appliedFilters,
  draftFilters,
}: {
  columns: StatementColumn[];
  appliedFilters: StatementFilters;
  draftFilters: StatementFilters;
}): {
  allowedFilterKeys: Array<keyof StatementFilters>;
  nextAppliedFilters: StatementFilters;
  nextDraftFilters: StatementFilters;
} => {
  const visibleColumnIds = columns.filter(column => column.visible).map(column => column.id);
  const allowedFilterKeys = getAllowedStatementFilterKeys(visibleColumnIds as StatementColumnId[]);

  return {
    allowedFilterKeys,
    nextAppliedFilters: resetDisallowedStatementFilters(appliedFilters, allowedFilterKeys),
    nextDraftFilters: resetHiddenStatementFilters(draftFilters, allowedFilterKeys),
  };
};

// ---------------------------------------------------------------------------
// Label builder helpers (extracted from StatementsListView for reuse)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IntlayerDict = any;
type TxFn = (path: string[], fallback: string) => string;

// eslint-disable-next-line complexity
export const buildFilterLabels = (t: IntlayerDict): FilterLabels => ({
  type: resolveLabel(t.filters?.type, 'Type'),
  status: resolveLabel(t.filters?.status, 'Status'),
  date: resolveLabel(t.filters?.date, 'Date'),
  from: resolveLabel(t.filters?.from, 'From'),
  filters: resolveLabel(t.filters?.filters, 'Filters'),
  columns: resolveLabel(t.filters?.columns, 'Columns'),
});

// eslint-disable-next-line complexity
export const buildListHeaderLabels = (t: IntlayerDict): Record<string, string> => ({
  receipt: resolveLabel(t.listHeader?.receipt, 'Receipt'),
  type: resolveLabel(t.listHeader?.type, 'Type'),
  date: resolveLabel(t.listHeader?.date, 'Date'),
  merchant: resolveLabel(t.listHeader?.merchant, 'Merchant'),
  amount: resolveLabel(t.listHeader?.amount, 'Amount'),
  action: resolveLabel(t.listHeader?.action, 'Action'),
  scanning: resolveLabel(t.listHeader?.scanning, 'Scanning...'),
});

export const buildPaginationLabels = (tx: TxFn): Record<string, string> => ({
  shown: tx(['pagination', 'shown'], 'Showing {from}–{to} of {count}'),
  previous: tx(['pagination', 'previous'], 'Previous'),
  next: tx(['pagination', 'next'], 'Next'),
  pageOf: tx(['pagination', 'pageOf'], 'Page {page} of {count}'),
});

export const buildUploadLabels = (t: IntlayerDict): StatementUploadLabels => ({
  pickAtLeastOne: resolveLabel(t.uploadModal?.pickAtLeastOne, 'Select at least one file'),
  uploadedProcessing: resolveLabel(t.uploadModal?.uploadedProcessing, 'Files uploaded'),
  uploadFailed: resolveLabel(t.uploadModal?.uploadFailed, 'Failed to upload files'),
});

// eslint-disable-next-line max-lines-per-function
export const buildFilterOptionLabels = (_t: IntlayerDict, tx: TxFn): FilterOptionLabels => ({
  apply: tx(['filters', 'apply'], 'Apply'),
  reset: tx(['filters', 'reset'], 'Reset'),
  resetFilters: tx(['filters', 'resetFilters'], 'Reset filters'),
  viewResults: tx(['filters', 'viewResults'], 'View results'),
  save: tx(['filters', 'save'], 'Save'),
  saveSearch: tx(['filters', 'saveSearch'], 'Save search'),
  any: tx(['filters', 'any'], 'Any'),
  yes: tx(['filters', 'yes'], 'Yes'),
  no: tx(['filters', 'no'], 'No'),
  typeExpense: tx(['filters', 'typeExpense'], 'Expense'),
  typeReport: tx(['filters', 'typeReport'], 'Expense Report'),
  typeChat: tx(['filters', 'typeChat'], 'Chat'),
  typeTrip: tx(['filters', 'typeTrip'], 'Trip'),
  typeTask: tx(['filters', 'typeTask'], 'Task'),
  typeImage: tx(['filters', 'typeImage'], 'Image'),
  statusUploaded: tx(['filters', 'statusUploaded'], 'Uploaded'),
  statusProcessing: tx(['filters', 'statusProcessing'], 'Processing'),
  statusParsed: tx(['filters', 'statusParsed'], 'Parsed'),
  statusValidated: tx(['filters', 'statusValidated'], 'Validated'),
  statusCompleted: tx(['filters', 'statusCompleted'], 'Completed'),
  statusError: tx(['filters', 'statusError'], 'Error'),
  dateThisMonth: tx(['filters', 'dateThisMonth'], 'This month'),
  dateLastMonth: tx(['filters', 'dateLastMonth'], 'Last month'),
  dateYearToDate: tx(['filters', 'dateYearToDate'], 'Year to date'),
  dateOn: tx(['filters', 'dateOn'], 'On'),
  dateAfter: tx(['filters', 'dateAfter'], 'After'),
  dateBefore: tx(['filters', 'dateBefore'], 'Before'),
  drawerTitle: tx(['filters', 'drawerTitle'], 'Filters'),
  drawerGeneral: tx(['filters', 'drawerGeneral'], 'General'),
  drawerExpenses: tx(['filters', 'drawerExpenses'], 'Expenses'),
  drawerReports: tx(['filters', 'drawerReports'], 'Reports'),
  drawerGroupBy: tx(['filters', 'drawerGroupBy'], 'Group by'),
  drawerHas: tx(['filters', 'drawerHas'], 'Has'),
  drawerKeywords: tx(['filters', 'drawerKeywords'], 'Keywords'),
  drawerLimit: tx(['filters', 'drawerLimit'], 'Limit'),
  drawerTo: tx(['filters', 'drawerTo'], 'To'),
  drawerAmount: tx(['filters', 'drawerAmount'], 'Amount'),
  drawerApproved: tx(['filters', 'drawerApproved'], 'Approved'),
  drawerBillable: tx(['filters', 'drawerBillable'], 'Billable'),
  groupByDate: tx(['filters', 'groupByDate'], 'Date'),
  groupByStatus: tx(['filters', 'groupByStatus'], 'Status'),
  groupByType: tx(['filters', 'groupByType'], 'Type'),
  groupByBank: tx(['filters', 'groupByBank'], 'Bank'),
  groupByUser: tx(['filters', 'groupByUser'], 'User'),
  groupByAmount: tx(['filters', 'groupByAmount'], 'Amount'),
  hasErrors: tx(['filters', 'hasErrors'], 'Errors'),
  hasLogs: tx(['filters', 'hasLogs'], 'Logs'),
  hasTransactions: tx(['filters', 'hasTransactions'], 'Transactions'),
  hasDateRange: tx(['filters', 'hasDateRange'], 'Date range'),
  hasCurrency: tx(['filters', 'hasCurrency'], 'Currency'),
  columnReceipt: tx(['filters', 'columnReceipt'], 'Receipt'),
  columnDate: tx(['filters', 'columnDate'], 'Date'),
  columnMerchant: tx(['filters', 'columnMerchant'], 'Merchant'),
  columnFrom: tx(['filters', 'columnFrom'], 'From'),
  columnTo: tx(['filters', 'columnTo'], 'To'),
  columnCategory: tx(['filters', 'columnCategory'], 'Category'),
  columnTag: tx(['filters', 'columnTag'], 'Tag'),
  columnAmount: tx(['filters', 'columnAmount'], 'Amount'),
  columnAction: tx(['filters', 'columnAction'], 'Action'),
  columnApproved: tx(['filters', 'columnApproved'], 'Approved'),
  columnBillable: tx(['filters', 'columnBillable'], 'Billable'),
  columnCard: tx(['filters', 'columnCard'], 'Card'),
  columnDescription: tx(['filters', 'columnDescription'], 'Description'),
  columnExchangeRate: tx(['filters', 'columnExchangeRate'], 'Exchange rate'),
  columnExported: tx(['filters', 'columnExported'], 'Exported'),
  columnsTitle: tx(['filters', 'columnsTitle'], 'Columns'),
  paid: tx(['filters', 'paid'], 'Paid'),
});

export const buildTypeOptions = (
  labels: Record<string, string>,
): Array<{ value: string; label: string }> => [
  { value: 'receipt', label: labels.columnReceipt },
  { value: 'expense', label: labels.typeExpense },
  { value: 'expense_report', label: labels.typeReport },
  { value: 'chat', label: labels.typeChat },
  { value: 'trip', label: labels.typeTrip },
  { value: 'task', label: labels.typeTask },
  { value: 'gmail', label: 'Gmail' },
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

export const buildColumnLabels = (labels: Record<string, string>): Record<string, string> => ({
  receipt: labels.columnReceipt,
  merchant: labels.columnMerchant,
  from: labels.columnFrom,
  to: labels.columnTo,
  category: labels.columnCategory,
  tag: labels.columnTag,
  amount: labels.columnAmount,
  action: labels.columnAction,
  approved: labels.columnApproved,
  billable: labels.columnBillable,
  card: labels.columnCard,
  description: labels.columnDescription,
  exchangeRate: labels.columnExchangeRate,
  exported: labels.columnExported,
});

interface StatementForFromOptions {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  bankName: string;
  source?: string;
  receiptSource?: string;
}

/* eslint-disable complexity, max-lines-per-function */
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
        const isGmail = statement.source === 'gmail';
        const hasRealBank = statement.bankName !== 'other';
        const isStore =
          statement.source === 'scan' && statement.receiptSource !== 'gmail' && !hasRealBank;
        seen.set(key, {
          id: key,
          label: isGmail
            ? 'Gmail'
            : isStore
              ? text.typeReceipt.value
              : getBankDisplayName(statement.bankName),
          description: null,
          iconUrl: isGmail ? '/icons/gmail.png' : null,
          bankName: statement.bankName,
        });
      }
    }
  }

  return Array.from(seen.values());
};
/* eslint-enable complexity, max-lines-per-function */

interface StatementForCurrencyOptions {
  parsedData?: { currency?: string };
  currency?: string | null;
  parsingDetails?: {
    metadataExtracted?: { currency?: string; headerDisplay?: { currencyDisplay?: string } };
  };
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

// eslint-disable-next-line complexity
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
