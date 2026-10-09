'use client';

import type React from 'react';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { Transaction } from '../TransactionsView';
import { getNamedObjectLabel, getTransactionValue, resolveLocale } from './column-helpers';

export interface RendererConfig {
  locale: string;
  formatDate: (d: string) => string;
  formatAmount: (params: { amount: number; currency?: string }) => string;
  t: Record<string, unknown>;
  renderChip: (params: { label: string; color: string; variant?: string }) => React.ReactNode;
}

const getDashValue = (cfg: RendererConfig): React.ReactNode => {
  const t = cfg.t as { dash: { value?: unknown } | unknown };
  const dash = t.dash;
  if (dash && typeof dash === 'object' && 'value' in dash) return String(dash.value ?? '—');
  return String(dash ?? '—');
};

export const buildDateRenderer =
  (cfg: RendererConfig) =>
  (tx: Transaction): React.ReactNode =>
    cfg.formatDate(tx.transactionDate);

export const buildDebitRenderer =
  (cfg: RendererConfig) =>
  (tx: Transaction): React.ReactNode =>
    tx.debit > 0
      ? cfg.formatAmount({ amount: tx.debit, currency: tx.currency })
      : getDashValue(cfg);

export const buildCreditRenderer =
  (cfg: RendererConfig) =>
  (tx: Transaction): React.ReactNode =>
    tx.credit > 0
      ? cfg.formatAmount({ amount: tx.credit, currency: tx.currency })
      : getDashValue(cfg);

export const buildCurrencyRenderer =
  () =>
  (tx: Transaction): React.ReactNode =>
    tx.currency ?? FALLBACK_CURRENCY;

export const buildExchangeRateRenderer =
  (cfg: RendererConfig) =>
  (tx: Transaction): React.ReactNode => {
    if (!tx.exchangeRate) return getDashValue(cfg);
    return tx.exchangeRate.toLocaleString(resolveLocale(cfg.locale), { minimumFractionDigits: 2 });
  };

export const buildBranchRenderer =
  (cfg: RendererConfig) =>
  (tx: Transaction): React.ReactNode =>
    tx.branch?.name ?? getDashValue(cfg);

export const buildWalletRenderer =
  (cfg: RendererConfig) =>
  (tx: Transaction): React.ReactNode =>
    tx.wallet?.name ?? getDashValue(cfg);

export const buildAmountForeignRenderer =
  (cfg: RendererConfig) =>
  (tx: Transaction): React.ReactNode => {
    if (!tx.amountForeign) return getDashValue(cfg);
    return tx.amountForeign.toLocaleString(resolveLocale(cfg.locale), { minimumFractionDigits: 2 });
  };

export const buildFallbackRenderer =
  (cfg: RendererConfig) =>
  (key: string) =>
  (tx: Transaction): React.ReactNode => {
    const value = getTransactionValue({ transaction: tx, key });
    if (value === null || value === undefined || value === '') return getDashValue(cfg);
    if (typeof value === 'number') return value.toLocaleString(resolveLocale(cfg.locale));
    if (typeof value === 'object') return getNamedObjectLabel(value) ?? JSON.stringify(value);
    return String(value);
  };
