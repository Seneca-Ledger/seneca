import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { CreatePayableInput } from '@/app/lib/payables-api';

type ReceiptLike = {
  subject: string;
  receivedAt: string;
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
    transactionType?: 'income' | 'expense' | 'transfer' | 'unknown';
  };
};

type EditableLineItem = {
  id: string;
  description: string;
  amount: number;
};

type EditableReceiptDataLike = {
  amount?: number;
  currency?: string;
  vendor?: string;
  date?: string;
  lineItems: EditableLineItem[];
};

const parseAmountValue = (value?: number | string | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

const toDateOnly = (value?: string | null) => {
  if (!value) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
};

export const buildPayablePrefillFromReceipt = ({
  receipt,
  editedData,
}: {
  receipt: ReceiptLike;
  editedData: EditableReceiptDataLike;
}): CreatePayableInput | null => {
  const transactionType = receipt.parsedData?.transactionType || 'expense';
  if (transactionType === 'income') {
    return null;
  }

  const lineItemsTotal = editedData.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const amount =
    editedData.lineItems.length > 0
      ? lineItemsTotal
      : (parseAmountValue(editedData.amount ?? receipt.parsedData?.amount ?? null) ?? 0);

  if (!(amount > 0)) {
    return null;
  }

  return {
    vendor: editedData.vendor || receipt.parsedData?.vendor || receipt.subject,
    amount,
    currency: editedData.currency || receipt.parsedData?.currency || FALLBACK_CURRENCY,
    dueDate: toDateOnly(editedData.date || receipt.parsedData?.date || receipt.receivedAt),
    source: 'invoice',
    comment: `Created from Gmail receipt ${receipt.subject}`,
  };
};
