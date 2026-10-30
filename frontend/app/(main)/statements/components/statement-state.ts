import { resolveBankLogo } from '@bank-logos';
import { getCachedIntlayer } from '@/app/i18n';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import { DEFAULT_LOCALE, readLocaleFromCookie } from '@/app/lib/locale';
import type { StatementCategoryNode } from '@/app/lib/statement-categories';
import { formatStatementFigure, type StatementAmountView } from './filters/amount-view';

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

export type ReceiptDerivedStatementCandidate = {
  parsingDetails?: StatementParsingDetails | null;
};

export type StatementViewCandidate = {
  id: string;
  statementId?: string | null;
  source?: string;
  status: string;
};

export type StatementViewAction = { type: 'route'; href: string };

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

export type StatementCurrencyLike = {
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
export const listUiText = () =>
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
