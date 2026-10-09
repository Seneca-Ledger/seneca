// Pure helper functions and types for the Statement Edit page

import { formatStoredDate } from '@/app/lib/user-format-store';
import type { ParsingDroppedSample } from './ParsingWarningsPanel';

export interface CategoryOption {
  id: string;
  name: string;
  type?: 'income' | 'expense';
  isEnabled?: boolean;
  source?: 'system' | 'user' | 'parsing';
  isSystem?: boolean;
  children?: CategoryOption[];
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface WalletOption {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  transactionDate: string;
  /** Confirmed by a person; only confirmed rows count in any number. */
  isVerified?: boolean;
  documentNumber?: string;
  counterpartyName: string;
  counterpartyBin?: string;
  counterpartyAccount?: string;
  counterpartyBank?: string;
  debit?: number;
  credit?: number;
  paymentPurpose: string;
  currency?: string;
  exchangeRate?: number;
  amountForeign?: number;
  categoryId?: string;
  branchId?: string;
  walletId?: string;
  article?: string;
  comments?: string;
  transactionType: 'income' | 'expense';
  category?: {
    id: string;
    name: string;
    isEnabled?: boolean;
    source?: 'system' | 'user' | 'parsing';
    isSystem?: boolean;
  };
  branch?: { id: string; name: string };
  wallet?: { id: string; name: string };
}

export interface StatementParsingDetails {
  detectedBank?: string;
  detectedFormat?: string;
  detectedBy?: string;
  detectedEvidence?: string[];
  otherBankMentions?: string[];
  parserUsed?: string;
  totalLinesProcessed?: number;
  transactionsFound?: number;
  transactionsCreated?: number;
  errors?: string[];
  warnings?: string[];
  metadataExtracted?: {
    accountNumber?: string;
    dateFrom?: string;
    dateTo?: string;
    balanceStart?: number;
    balanceEnd?: number;
    rawHeader?: string;
    normalizedHeader?: string;
    headerDisplay?: {
      title?: string;
      subtitle?: string;
      periodDisplay?: string;
      accountDisplay?: string;
      institutionDisplay?: string;
      currencyDisplay?: string;
    };
  };
  processingTime?: number;
  logEntries?: Array<{ timestamp: string; level: string; message: string }>;
  droppedSamples?: Array<string | ParsingDroppedSample>;
  /** Balance reconciliation result. `passed: false` puts the statement in `needs_review`. */
  validation?: {
    passed: boolean;
    warnings?: string[];
    balanceCheck?: {
      expectedEnd?: number;
      actualEnd?: number;
      difference?: number;
      tolerance?: number;
    };
  };
  balanceConfirmation?: {
    confirmedBy: string;
    confirmedAt: string;
  };
}

export interface Statement {
  id: string;
  fileName: string;
  status: string;
  totalTransactions: number;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    isEnabled?: boolean;
    source?: 'system' | 'user' | 'parsing';
    isSystem?: boolean;
  } | null;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  balanceStart?: number | string | null;
  balanceEnd?: number | string | null;
  parsingDetails?: StatementParsingDetails | null;
}

export const normalizeDateInput = (value?: string | Date | null): string => {
  if (!value) {
    return '';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
};

export const normalizeNumberInput = (value?: number | string | null): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : value.toString();
};

export const parseNullableNumber = (value: string): number | null => {
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveLocale = (locale: string): string => {
  if (locale === 'ru') {
    return 'ru-RU';
  }
  if (locale === 'kk') {
    return 'kk-KZ';
  }
  return 'en-US';
};

export const isIdEmpty = (id?: string | null): boolean =>
  !id || id === 'null' || id === 'undefined' || id === '0' || id === '';

export const filterEnabledCategories = (items: CategoryOption[]): CategoryOption[] => {
  return items
    .filter(item => item.isEnabled !== false)
    .map(item => ({
      ...item,
      children: item.children ? filterEnabledCategories(item.children) : undefined,
    }));
};

export const formatDate = (dateString?: string | null): string => {
  if (!dateString) {
    return '';
  }
  try {
    return formatStoredDate(dateString, 'ru-RU');
  } catch {
    return String(dateString);
  }
};

export const formatNumber = (num: number | null | undefined, locale: string): string => {
  if (num === null || num === undefined) {
    return '—';
  }
  return new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatLabel = (
  template: string | undefined,
  replacements: Record<string, string | number>,
): string => {
  if (!template) {
    return '';
  }
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
};

// ---------------------------------------------------------------------------
// Reconstructed helpers consumed across the Statement Edit page
// ---------------------------------------------------------------------------

export const labelValue = (label: { value?: string } | undefined, fallback: string): string =>
  label?.value ?? fallback;

export interface FieldChangeParams {
  id: string;
  field: keyof Transaction;
  value: string;
}

export type MetadataHints = {
  startDate: string;
  endDate: string;
  openingBalance: string;
  closingBalance: string;
};

type BuildHintsParams = {
  prefix?: string;
  locale: string;
  meta?: {
    dateFrom?: string;
    dateTo?: string;
    balanceStart?: number;
    balanceEnd?: number;
  };
  fmt: (n?: number | null) => string;
  labels: Record<string, { value?: string } | undefined>;
};

export function buildHints({ prefix, locale, meta, fmt, labels }: BuildHintsParams): MetadataHints {
  const filePrefix = prefix ?? labelValue(labels.fromFilePrefix, 'From file: ');
  const { dateFrom, dateTo, balanceStart, balanceEnd } = meta ?? {};
  const dateHint = (value?: string): string =>
    value ? `${filePrefix}${new Date(value).toLocaleDateString(resolveLocale(locale))}` : '';
  return {
    startDate: dateHint(dateFrom),
    endDate: dateHint(dateTo),
    openingBalance:
      balanceStart != null
        ? `${filePrefix}${fmt(balanceStart)}`
        : labelValue(labels.enterOpeningBalance, 'Enter opening balance'),
    closingBalance:
      balanceEnd != null
        ? `${filePrefix}${fmt(balanceEnd)}`
        : labelValue(labels.enterManuallyHint, 'Enter manually if it was not detected'),
  };
}

export function ignoreEventArg<T>(handler: (value: T) => void): (event: unknown, value: T) => void {
  return (_event, value) => handler(value);
}

export const countArray = (items?: unknown[] | null): number => items?.length ?? 0;

export const getParsingStats = (pd: {
  errors?: string[];
  warnings?: string[];
  otherBankMentions?: string[];
}): { errCount: number; warnCount: number; mentions: string[] } => ({
  errCount: countArray(pd.errors),
  warnCount: countArray(pd.warnings),
  mentions: pd.otherBankMentions ?? [],
});

export const toOptionalStr = (value?: number | string | null): string | undefined =>
  value == null ? undefined : String(value);

export const toUpperOrUndefined = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : undefined;
};

export const sumTransactionCredit = (transactions: Transaction[]): number =>
  transactions.reduce((sum, tx) => {
    const credit = Number(tx.credit);
    return sum + (Number.isNaN(credit) ? 0 : credit);
  }, 0);

export const sumTransactionDebit = (transactions: Transaction[]): number =>
  transactions.reduce((sum, tx) => {
    const debit = Number(tx.debit);
    return sum + (Number.isNaN(debit) ? 0 : debit);
  }, 0);

export const formatSummaryAmount = (
  amount: number,
  formatNumber: (n?: number | null) => string,
): string => (Number.isNaN(amount) ? '0.00' : formatNumber(amount));
