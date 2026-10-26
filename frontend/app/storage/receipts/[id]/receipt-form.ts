import type {
  EditableReceiptLineItem,
  EditableReceiptParsedData,
} from '@/app/components/receipts/receipt-types';
import type { ReceiptRecord } from '@/app/lib/api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { normalizeReceiptLineItems } from '@/app/lib/financial-document';
import { formatStoredDate } from '@/app/lib/user-format-store';

type ReceiptExportColumn = {
  /** Row key the column's values are stored under; `title` is the localized header. */
  field: string;
  title: string;
  type: 'text' | 'number' | 'date';
};

type ReceiptExportRow = Record<string, string | number>;

type ReceiptExportColumnLabels = Record<
  'item' | 'vendor' | 'date' | 'amount' | 'currency' | 'source' | 'status',
  string
>;

export function buildLineItems(receipt: ReceiptRecord | null): EditableReceiptLineItem[] {
  return normalizeReceiptLineItems(receipt?.parsedData).map((item, index) => ({
    id: `line-${index + 1}`,
    description: item.description,
    amount: item.amount,
  }));
}

export function buildReceiptDisplayTitle(receipt: ReceiptRecord, titleTemplate: string): string {
  const vendor = receipt.parsedData?.vendor?.trim();
  if (!vendor) {
    return receipt.subject;
  }
  const date = receipt.parsedData?.date || receipt.receivedAt;
  return titleTemplate.replace('{vendor}', vendor).replace('{date}', formatStoredDate(date));
}

export function buildInitialForm(receipt: ReceiptRecord | null): EditableReceiptParsedData {
  return {
    vendor: receipt?.parsedData?.vendor ?? '',
    amount: receipt?.parsedData?.amount ?? '',
    currency: receipt?.parsedData?.currency ?? FALLBACK_CURRENCY,
    date: receipt?.parsedData?.date?.split('T')[0] ?? '',
    tax: receipt?.parsedData?.tax ?? '',
    paymentMethod: receipt?.parsedData?.paymentMethod ?? '',
    transactionType: receipt?.parsedData?.transactionType ?? 'expense',
    categoryId: receipt?.parsedData?.categoryId ?? '',
    lineItems: buildLineItems(receipt),
  };
}

export function buildParsedDataPayload(formValue: EditableReceiptParsedData) {
  const lineItems = formValue.lineItems
    .filter(item => item.description.trim().length > 0 || Number.isFinite(item.amount))
    .map(item => ({ description: item.description, amount: item.amount }));

  return {
    vendor: formValue.vendor,
    amount: formValue.amount === '' ? undefined : Number(formValue.amount),
    currency: formValue.currency,
    date: formValue.date,
    tax: formValue.tax === '' ? undefined : Number(formValue.tax),
    paymentMethod: formValue.paymentMethod,
    transactionType: formValue.transactionType,
    categoryId: formValue.categoryId || undefined,
    lineItems,
  };
}

export function buildReceiptExportData(
  receipt: ReceiptRecord,
  formValue: EditableReceiptParsedData,
  labels: ReceiptExportColumnLabels,
): {
  columns: ReceiptExportColumn[];
  rows: ReceiptExportRow[];
} {
  const parsedData = buildParsedDataPayload(formValue);
  const columns: ReceiptExportColumn[] = [];
  const baseRow: ReceiptExportRow = {};

  const hasLineItems = parsedData.lineItems.length > 0;

  if (hasLineItems) {
    columns.push({ field: 'Item', title: labels.item, type: 'text' });
  } else if (parsedData.vendor?.trim()) {
    columns.push({ field: 'Vendor', title: labels.vendor, type: 'text' });
    baseRow.Vendor = parsedData.vendor.trim();
  }
  if (parsedData.date?.trim()) {
    columns.push({ field: 'Date', title: labels.date, type: 'date' });
    baseRow.Date = parsedData.date.trim();
  }
  if (typeof parsedData.amount === 'number' && Number.isFinite(parsedData.amount)) {
    columns.push({ field: 'Amount', title: labels.amount, type: 'number' });
    baseRow.Amount = parsedData.amount;
  }
  if (parsedData.currency?.trim()) {
    columns.push({ field: 'Currency', title: labels.currency, type: 'text' });
    baseRow.Currency = parsedData.currency.trim();
  }
  if (receipt.source?.trim()) {
    columns.push({ field: 'Source', title: labels.source, type: 'text' });
    baseRow.Source = receipt.source.trim();
  }
  if (receipt.status?.trim()) {
    columns.push({ field: 'Status', title: labels.status, type: 'text' });
    baseRow.Status = receipt.status.trim();
  }

  if (hasLineItems) {
    return {
      columns,
      rows: parsedData.lineItems.map(item => ({
        Item: item.description,
        Date: baseRow.Date,
        Amount: item.amount,
        Currency: baseRow.Currency,
        Source: baseRow.Source,
        Status: baseRow.Status,
      })),
    };
  }

  return { columns, rows: [baseRow] };
}
