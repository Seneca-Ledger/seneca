import { resolveBankLogo } from '@bank-logos';
import { getCachedIntlayer } from '@/app/i18n';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import { DEFAULT_LOCALE, readLocaleFromCookie } from '@/app/lib/locale';
import type { StatementCategoryNode } from '@/app/lib/statement-categories';
import {
  getAllowedStatementFilterKeys,
  resetDisallowedStatementFilters,
  type StatementColumn,
  type StatementColumnId,
} from './columns/statement-columns';
import { formatStatementFigure, type StatementAmountView } from './filters/amount-view';
import {
  getVisibleFilterScreens,
  resetHiddenStatementFilters,
  type StatementFilterScreen,
  type StatementsQueryParams,
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

const UI_ONLY_BANK_FILTER_IDS = new Set(['bank:receipt']);

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
  parsingDetails?: StatementParsingDetails | null;
};

export type DuplicateGroupTone = 'sky' | 'blue' | 'indigo' | 'slate' | 'zinc' | 'stone';

export type StatementCategoryWithEnabled = StatementCategoryNode & {
  isEnabled?: boolean;
  children?: StatementCategoryWithEnabled[];
};

type ReceiptDerivedStatementCandidate = {
  parsingDetails?: StatementParsingDetails | null;
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
  if (statement.source !== 'scan') {
    return false;
  }
  const status = (statement.status || '').toLowerCase();
  return status === 'new' || status === 'processing';
};

export const isScanReceiptStatement = (statement: Pick<StatementLike, 'source'>): boolean =>
  statement.source === 'scan';

export const isStoreReceiptStatement = (
  statement: Pick<StatementLike, 'source' | 'receiptSource'>,
): boolean => statement.source === 'scan';

// ---------------------------------------------------------------------------
// Statement formatting helpers
// ---------------------------------------------------------------------------

type StatementCurrencyLike = {
  parsedData?: { currency?: string };
  currency?: string | null;
  parsingDetails?: StatementParsingDetails | null;
};

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

export const formatStatementAmount = (
  statement: StatementLike,
  amountView: StatementAmountView | null = null,
): string => {
  if (statement.source === 'scan') {
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

  const currency = resolveStatementCurrency(statement);
  return `${formatStatementFigure(statement, amountView)}${currency || ''}`;
};

export {
  formatStatementDate,
  resolveStatementAddedTime,
  resolveStatementSortDate,
} from './statement-dates';

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
const listUiText = () =>
  getCachedIntlayer('statementsListUi', readLocaleFromCookie() ?? DEFAULT_LOCALE);

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
  isScanReceiptStatement(statement)
    ? `/receipts/${statement.id}/file`
    : `/statements/${statement.id}/file`;

export const getDeleteEndpoint = (
  statement: Pick<StatementLike, 'id' | 'source' | 'receiptSource'>,
): string =>
  isScanReceiptStatement(statement) ? `/receipts/${statement.id}` : `/statements/${statement.id}`;

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

/** A chart's merchant and period, sent with its deep link. */
export type RowsFilter = Pick<
  StatementsQueryParams,
  'merchant' | 'transactionsFrom' | 'transactionsTo'
>;

export const buildStatementRequestParams = ({
  appliedFilters,
  categoryId,
  rowsFilter,
  search,
}: {
  appliedFilters: StatementFilters;
  categoryId?: string | null;
  /** A merchant, and the window the category's or merchant's rows must fall in. */
  rowsFilter?: RowsFilter | null;
  search?: string;
}): StatementsQueryParams => {
  const serverSafeFilters: StatementFilters = {
    ...appliedFilters,
    type: appliedFilters.type === 'receipt' ? null : appliedFilters.type,
    from: appliedFilters.from.filter(value => !UI_ONLY_BANK_FILTER_IDS.has(value.toLowerCase())),
    to: appliedFilters.to.filter(value => !UI_ONLY_BANK_FILTER_IDS.has(value.toLowerCase())),
  };

  return {
    ...serializeStatementFiltersToQuery(serverSafeFilters),
    ...(categoryId ? { categoryId } : {}),
    ...(rowsFilter ?? {}),
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

const PARSED_STATEMENT_STATUSES = new Set(['completed', 'parsed', 'validated']);

/**
 * The Approved column: a person has confirmed the document. A receipt once it
 * is approved; a statement once its file is parsed and none of its rows still
 * waits in Review. A receipt's status is the receipt's own, never a parse status.
 */
export const isDocumentApproved = (
  status: string,
  isReceipt: boolean,
  pendingReview: number,
): boolean => {
  const normalized = status.toLowerCase();
  if (isReceipt) {
    return normalized === 'approved';
  }
  return PARSED_STATEMENT_STATUSES.has(normalized) && pendingReview === 0;
};

/** The Approved filter, by the same rule as the Approved column. */
export const filterByApproved = <T extends { id: string; status: string; source?: string }>(
  documents: T[],
  approved: boolean | null,
  statementReviewCounts: Record<string, number>,
): T[] => {
  if (approved === null) {
    return documents;
  }
  return documents.filter(document => {
    const isReceipt = document.source === 'scan';
    const pending = resolvePendingReview(document, isReceipt, statementReviewCounts);
    return isDocumentApproved(document.status, isReceipt, pending) === approved;
  });
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

type IntlayerDict = any;
type TxFn = (path: string[]) => string;

export const buildFilterLabels = (t: IntlayerDict): FilterLabels => ({
  type: t.filters.type.value,
  status: t.filters.status.value,
  date: t.filters.date.value,
  from: t.filters.from.value,
  filters: t.filters.filters.value,
  columns: t.filters.columns.value,
});

export const buildListHeaderLabels = (t: IntlayerDict): Record<string, string> => ({
  receipt: t.listHeader.receipt.value,
  type: t.listHeader.type.value,
  date: t.listHeader.date.value,
  merchant: t.listHeader.merchant.value,
  amount: t.listHeader.amount.value,
  action: t.listHeader.action.value,
  scanning: t.listHeader.scanning.value,
});

export const buildPaginationLabels = (tx: TxFn): Record<string, string> => ({
  shown: tx(['pagination', 'shown']),
  previous: tx(['pagination', 'previous']),
  next: tx(['pagination', 'next']),
  pageOf: tx(['pagination', 'pageOf']),
});

export const buildUploadLabels = (t: IntlayerDict): StatementUploadLabels => ({
  pickAtLeastOne: t.uploadModal.pickAtLeastOne.value,
  uploadedProcessing: t.uploadModal.uploadedProcessing.value,
  uploadFailed: t.uploadModal.uploadFailed.value,
});

export const buildFilterOptionLabels = (_t: IntlayerDict, tx: TxFn): FilterOptionLabels => ({
  apply: tx(['filters', 'apply']),
  reset: tx(['filters', 'reset']),
  resetFilters: tx(['filters', 'resetFilters']),
  viewResults: tx(['filters', 'viewResults']),
  save: tx(['filters', 'save']),
  saveSearch: tx(['filters', 'saveSearch']),
  any: tx(['filters', 'any']),
  yes: tx(['filters', 'yes']),
  no: tx(['filters', 'no']),
  typeExpense: tx(['filters', 'typeExpense']),
  typeReport: tx(['filters', 'typeReport']),
  typeChat: tx(['filters', 'typeChat']),
  typeTrip: tx(['filters', 'typeTrip']),
  typeTask: tx(['filters', 'typeTask']),
  typeImage: tx(['filters', 'typeImage']),
  statusUploaded: tx(['filters', 'statusUploaded']),
  statusProcessing: tx(['filters', 'statusProcessing']),
  statusParsed: tx(['filters', 'statusParsed']),
  statusValidated: tx(['filters', 'statusValidated']),
  statusCompleted: tx(['filters', 'statusCompleted']),
  statusError: tx(['filters', 'statusError']),
  dateThisMonth: tx(['filters', 'dateThisMonth']),
  dateLastMonth: tx(['filters', 'dateLastMonth']),
  dateYearToDate: tx(['filters', 'dateYearToDate']),
  dateOn: tx(['filters', 'dateOn']),
  dateAfter: tx(['filters', 'dateAfter']),
  dateBefore: tx(['filters', 'dateBefore']),
  drawerTitle: tx(['filters', 'drawerTitle']),
  drawerGeneral: tx(['filters', 'drawerGeneral']),
  drawerExpenses: tx(['filters', 'drawerExpenses']),
  drawerReports: tx(['filters', 'drawerReports']),
  drawerGroupBy: tx(['filters', 'drawerGroupBy']),
  drawerHas: tx(['filters', 'drawerHas']),
  drawerKeywords: tx(['filters', 'drawerKeywords']),
  drawerLimit: tx(['filters', 'drawerLimit']),
  drawerTo: tx(['filters', 'drawerTo']),
  drawerAmount: tx(['filters', 'drawerAmount']),
  drawerApproved: tx(['filters', 'drawerApproved']),
  drawerBillable: tx(['filters', 'drawerBillable']),
  groupByDate: tx(['filters', 'groupByDate']),
  groupByStatus: tx(['filters', 'groupByStatus']),
  groupByType: tx(['filters', 'groupByType']),
  groupByBank: tx(['filters', 'groupByBank']),
  groupByUser: tx(['filters', 'groupByUser']),
  groupByAmount: tx(['filters', 'groupByAmount']),
  hasErrors: tx(['filters', 'hasErrors']),
  hasLogs: tx(['filters', 'hasLogs']),
  hasTransactions: tx(['filters', 'hasTransactions']),
  hasDateRange: tx(['filters', 'hasDateRange']),
  hasCurrency: tx(['filters', 'hasCurrency']),
  columnReceipt: tx(['filters', 'columnReceipt']),
  columnDate: tx(['filters', 'columnDate']),
  columnMerchant: tx(['filters', 'columnMerchant']),
  columnFrom: tx(['filters', 'columnFrom']),
  columnTo: tx(['filters', 'columnTo']),
  columnCategory: tx(['filters', 'columnCategory']),
  columnTag: tx(['filters', 'columnTag']),
  columnAmount: tx(['filters', 'columnAmount']),
  columnAction: tx(['filters', 'columnAction']),
  columnApproved: tx(['filters', 'columnApproved']),
  columnBillable: tx(['filters', 'columnBillable']),
  columnCard: tx(['filters', 'columnCard']),
  columnDescription: tx(['filters', 'columnDescription']),
  columnExchangeRate: tx(['filters', 'columnExchangeRate']),
  columnExported: tx(['filters', 'columnExported']),
  columnsTitle: tx(['filters', 'columnsTitle']),
  paid: tx(['filters', 'paid']),
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

interface StatementForCurrencyOptions {
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
