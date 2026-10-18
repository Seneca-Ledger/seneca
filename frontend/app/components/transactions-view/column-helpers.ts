'use client';

import { resolveLocaleTag } from '@/app/lib/user-format';
import type { Transaction } from '../TransactionsView';

export const getTransactionValue = ({
  transaction,
  key,
}: {
  transaction: Transaction;
  key: string;
}): unknown => {
  const record = transaction as unknown as Record<string, unknown>;
  return record[key];
};

export const getNamedObjectLabel = (value: object): string | null => {
  const record = value as Record<string, unknown>;
  return typeof record.name === 'string' ? record.name : null;
};

export const resolveLocale = (locale: string): string => {
  return resolveLocaleTag(locale);
};

const TX_SEARCH_FIELDS: ReadonlyArray<keyof Transaction> = [
  'counterpartyName',
  'paymentPurpose',
  'documentNumber',
  'counterpartyBin',
  'article',
];

const txMatchesField = (tx: Transaction, field: keyof Transaction, q: string): boolean => {
  const value = tx[field];
  return typeof value === 'string' && value.toLowerCase().includes(q);
};

export const txMatchesSearch = (tx: Transaction, searchQuery: string): boolean => {
  const q = searchQuery.toLowerCase();
  if (TX_SEARCH_FIELDS.some(f => txMatchesField(tx, f, q))) return true;
  return Boolean(tx.category?.name?.toLowerCase().includes(q));
};
