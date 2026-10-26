import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { formatStoredDate } from '@/app/lib/user-format-store';
import type { Transaction } from '../editHelpers';
import { isIdEmpty, resolveLocale } from '../editHelpers';

export function computeMissingCategory(edited: Partial<Transaction>, tx: Transaction): boolean {
  return isIdEmpty(edited.categoryId) && isIdEmpty(tx.categoryId) && isIdEmpty(tx.category?.id);
}

export function getEditedTransaction(
  editedData: Record<string, Partial<Transaction>>,
  tx: Transaction,
): Partial<Transaction> {
  return editedData[tx.id] ?? tx;
}

export function isMultilineField(field: keyof Transaction): boolean {
  return field === 'paymentPurpose' || field === 'comments';
}

export function getEditValue(
  edited: Partial<Transaction>,
  tx: Transaction,
  field: keyof Transaction,
): string {
  const v = edited[field] ?? tx[field];
  return v != null ? String(v) : '';
}

function getCategoryDisplay(tx: Transaction, locale: string): string {
  if (!tx.category?.name) {
    return '—';
  }
  return getCategoryDisplayName(
    { name: tx.category.name, source: tx.category.source, isSystem: tx.category.isSystem },
    locale,
  );
}

type FieldDisplayFn = (
  tx: Transaction,
  locale: string,
  fmt: (n?: number | null) => string,
) => string;
const fieldDisplayMap: Partial<Record<keyof Transaction, FieldDisplayFn>> = {
  transactionDate: (tx, locale) => formatStoredDate(tx.transactionDate, resolveLocale(locale)),
  debit: (tx, _, fmt) => (tx.debit ? fmt(tx.debit) : '—'),
  credit: (tx, _, fmt) => (tx.credit ? fmt(tx.credit) : '—'),
  categoryId: getCategoryDisplay,
  branchId: tx => tx.branch?.name ?? '—',
  walletId: tx => tx.wallet?.name ?? '—',
};

type DisplayParams = {
  tx: Transaction;
  field: keyof Transaction;
  locale: string;
  fmt: (n?: number | null) => string;
};
export function getFieldDisplay({ tx, field, locale, fmt }: DisplayParams): string {
  const fn = fieldDisplayMap[field];
  if (fn) {
    return fn(tx, locale, fmt);
  }
  return String(tx[field] ?? '—');
}

function colVal(
  columns: Record<string, { value?: string }>,
  key: string,
  fallback: string,
): string {
  return columns[key]?.value ?? fallback;
}

export type ColumnLabels = {
  date: string;
  counterparty: string;
  paymentPurpose: string;
  amount: string;
  category: string;
  actions: string;
};
export function getColumnLabels(columns: Record<string, { value?: string }>): ColumnLabels {
  return {
    date: colVal(columns, 'date', 'Date'),
    counterparty: colVal(columns, 'counterparty', 'Counterparty'),
    paymentPurpose: colVal(columns, 'paymentPurposeShort', 'Payment purpose'),
    amount: colVal(columns, 'amount', 'Amount'),
    category: colVal(columns, 'category', 'Category'),
    actions: colVal(columns, 'actions', 'Actions'),
  };
}

function labelVal(
  labels: Record<string, { value?: string } | undefined>,
  key: string,
  fallback: string,
): string {
  return labels[key]?.value ?? fallback;
}

export type EditTableLabels = {
  confirmDelete: string;
  deleteAction: string;
  moreActions: string;
  cancel: string;
  notSelected: string;
  noCategory: string;
  assignCategory: string;
};
export function getEditTableLabels(
  labels: Record<string, { value?: string } | undefined>,
): EditTableLabels {
  return {
    confirmDelete: labelVal(labels, 'confirmDeleteOne', 'Delete transaction?'),
    deleteAction: labelVal(labels, 'delete', 'Delete'),
    moreActions: labelVal(labels, 'moreActions', 'More actions'),
    cancel: labelVal(labels, 'cancel', 'Cancel'),
    notSelected: labelVal(labels, 'notSelected', 'Not selected'),
    noCategory: labelVal(labels, 'noCategoryOption', 'No category'),
    assignCategory: labelVal(labels, 'assignCategory', 'Assign category'),
  };
}

type RowSx = {
  transition: string;
  '&:hover': { bgcolor: string };
};
/**
 * A row with no category is marked in its category cell (an ochre dot), not
 * painted pink: it is something to do, not an error. Hover is a soft neutral.
 */
export function getRowSx(_missing: boolean): RowSx {
  return {
    transition: 'background-color 0.15s',
    '&:hover': { bgcolor: 'var(--surface-soft)' },
  };
}
