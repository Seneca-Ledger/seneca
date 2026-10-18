// Pure helper functions and types for the Statement Edit page

import type {
  StatementParsingDetails as ContractStatementParsingDetails,
  TransactionListItem,
} from '@/app/lib/contracts';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDate } from '@/app/lib/user-format-store';

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

/**
 * A row of `GET /transactions` as the edit page holds it: amounts as numbers
 * (the API sends decimal strings), absent values as undefined.
 */
export function toEditableTransaction(row: TransactionListItem): Transaction {
  const amount = (value: string | null) => (value === null ? undefined : Number(value));
  const text = (value: string | null) => value ?? undefined;
  return {
    id: row.id,
    transactionDate: row.transactionDate,
    isVerified: row.isVerified,
    documentNumber: text(row.documentNumber),
    counterpartyName: row.counterpartyName,
    counterpartyBin: text(row.counterpartyBin),
    counterpartyAccount: text(row.counterpartyAccount),
    counterpartyBank: text(row.counterpartyBank),
    debit: amount(row.debit),
    credit: amount(row.credit),
    paymentPurpose: row.paymentPurpose,
    currency: row.currency,
    exchangeRate: amount(row.exchangeRate),
    amountForeign: amount(row.amountForeign),
    categoryId: text(row.categoryId),
    branchId: text(row.branchId),
    walletId: text(row.walletId),
    article: text(row.article),
    comments: text(row.comments),
    transactionType: row.transactionType,
    category: row.category ?? undefined,
    branch: row.branch ?? undefined,
    wallet: row.wallet ?? undefined,
  };
}

/** The parser's notes, as `GET /statements/:id` sends them. */
export type StatementParsingDetails = ContractStatementParsingDetails;

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
  return resolveLocaleTag(locale);
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
    return formatStoredDate(dateString);
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
    dateFrom?: string | null;
    dateTo?: string | null;
    balanceStart?: number | null;
    balanceEnd?: number | null;
  };
  fmt: (n?: number | null) => string;
  labels: Record<string, { value?: string } | undefined>;
};

export function buildHints({ prefix, locale, meta, fmt, labels }: BuildHintsParams): MetadataHints {
  const filePrefix = prefix ?? labelValue(labels.fromFilePrefix, 'From file: ');
  const { dateFrom, dateTo, balanceStart, balanceEnd } = meta ?? {};
  const dateHint = (value?: string | null): string =>
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

export const countArray = (items?: readonly unknown[] | null): number => items?.length ?? 0;

export const getParsingStats = (pd: {
  errors?: readonly string[] | null;
  warnings?: readonly string[] | null;
  otherBankMentions?: readonly string[] | null;
}): { errCount: number; warnCount: number; mentions: readonly string[] } => ({
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
