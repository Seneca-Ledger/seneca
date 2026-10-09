/**
 * Shared utilities for analytics view components.
 * Consolidates helper functions duplicated across TopMerchantsView,
 * TopCategoriesView, TopSpendersView, and SpendOverTimeView.
 */

// Re-export from side-panel-utils — these already exist there and are identical
export { getNestedValue, getRecord, resolveLabel } from '@/app/lib/side-panel-utils';

import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import type {
  GmailReceipt,
  StatementMeta,
  Transaction,
} from '@/app/(main)/statements/types/statement-types';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';

/** Normalizes a raw currency string to a 3-letter ISO code, falling back to the installation default. */
export const resolveCurrencyCode = (
  currency: string | null | undefined,
  fallback = FALLBACK_CURRENCY,
): string => {
  const normalized = String(currency || '')
    .trim()
    .toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  return fallback;
};

/** Maps an Intlayer locale code to a BCP 47 locale string for Intl APIs. */
export const resolveLocale = (locale?: string): string => {
  if (locale === 'ru') return 'ru-RU';
  if (locale === 'kk') return 'kk-KZ';
  return 'en-US';
};

/** Formats a monetary value as a localized currency string. */
export const formatMoney = (value: number, currency: string, locale = 'ru'): string =>
  new Intl.NumberFormat(resolveLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

/** Strips the time component from a date string, returning midnight local time or null. */
export const toDateOnly = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

/** Returns the midnight-local date of a record's dateValue or createdAt field. */
export const getRecordDate = (record: {
  dateValue?: string;
  createdAt?: string | null;
}): Date | null => toDateOnly(record.dateValue || record.createdAt || null);

/**
 * Resolves the effective transaction date, preferring the transaction's own date,
 * then falling back to statement-level dates.
 */
export const getTransactionDate = (transaction: Transaction, statement?: StatementMeta): string =>
  transaction.transactionDate ||
  statement?.statementDateTo ||
  statement?.statementDateFrom ||
  statement?.createdAt ||
  transaction.createdAt ||
  '';

/**
 * Resolves the effective currency for a transaction,
 * checking metadata extraction fallbacks from the parent statement.
 */
export const getTransactionCurrency = (
  transaction: Transaction,
  statement: StatementMeta | undefined,
  fallbackCurrency: string,
): string =>
  transaction.currency ||
  statement?.currency ||
  statement?.parsingDetails?.metadataExtracted?.currency ||
  statement?.parsingDetails?.metadataExtracted?.headerDisplay?.currencyDisplay ||
  fallbackCurrency;

/**
 * Maps a GmailReceipt to a StatementFilterItem shape for unified filtering.
 * Pass a custom `fileName` to override the default merchant label resolution.
 */
export const mapGmailReceiptToStatement = (
  receipt: GmailReceipt,
  fallbackCurrency: string,
  fileName?: string,
): StatementFilterItem => {
  const isLocalReceipt = !!receipt.source && receipt.source !== 'gmail';
  return {
    id: receipt.id,
    source: 'gmail',
    fileName:
      fileName ??
      resolveGmailMerchantLabel({
        vendor: receipt.parsedData?.vendor,
        sender: receipt.sender,
        subject: receipt.subject,
        fallback: 'Gmail receipt',
      }),
    subject: receipt.subject,
    sender: receipt.sender,
    status: receipt.status,
    totalDebit: receipt.parsedData?.amount ?? null,
    totalCredit: null,
    exported: null,
    paid: null,
    createdAt: receipt.receivedAt,
    statementDateFrom: receipt.parsedData?.date || receipt.receivedAt,
    statementDateTo: null,
    bankName: isLocalReceipt ? 'receipt' : 'gmail',
    fileType: isLocalReceipt ? 'receipt' : 'gmail',
    currency: resolveCurrencyCode(receipt.parsedData?.currency, fallbackCurrency),
    user: null,
    receivedAt: receipt.receivedAt,
    parsedData: {
      vendor: receipt.parsedData?.vendor,
      date: receipt.parsedData?.date,
    },
  };
};

/**
 * Resolves the display label for a source channel.
 * Accepts a plain string so it can be used with view-specific channel type aliases.
 */
export const getSourceLabel = (
  channel: string,
  labels: {
    sourceBank: string;
    sourceReceipt: string;
    sourceGmailInbox: string;
    sourceCrypto: string;
  },
): string => {
  if (channel === 'gmail') return labels.sourceGmailInbox;
  if (channel === 'receipt') return labels.sourceReceipt;
  if (channel === 'crypto') return labels.sourceCrypto;
  return labels.sourceBank;
};
