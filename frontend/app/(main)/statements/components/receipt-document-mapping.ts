import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { resolveReceiptMerchantLabel } from '@/app/lib/receipt-merchant';

export interface ReceiptDocument {
  id: string;
  source?: string;
  statementId?: string | null;
  subject: string;
  sender: string;
  receivedAt: string;
  status: string;
  parsedData?: {
    amount?: number | string | null;
    currency?: string;
    vendor?: string;
    date?: string;
    category?: string;
    categoryId?: string;
    lineItems?: Array<{ description: string; amount?: number }>;
  };
  /** Resolved by the API from `parsedData.categoryId`; absent when none is picked. */
  category?: { id: string; name: string; color: string | null; icon: string | null } | null;
  tags?: Array<{ id: string; name: string; color: string | null }>;
}

interface ReceiptMappedParsedData {
  amount?: number;
  currency?: string;
  vendor?: string;
  date?: string;
  category?: string;
  categoryId?: string;
  lineItems?: Array<{ description: string; amount?: number }>;
}

export interface ReceiptMappedStatement {
  id: string;
  statementId?: string | null;
  source: 'scan';
  receiptSource?: string;
  fileName: string;
  subject: string;
  sender: string;
  status: string;
  totalTransactions: number;
  totalDebit: number;
  totalCredit: null;
  exported: null;
  paid: null;
  createdAt: string;
  processedAt: undefined;
  statementDateFrom: string;
  statementDateTo: null;
  bankName: string;
  fileType: string;
  currency: string;
  user: null;
  errorMessage: string | null;
  receivedAt: string;
  parsedData?: ReceiptMappedParsedData;
  category?: { id: string; name: string; color: string | null; icon: string | null } | null;
  tags?: Array<{ id: string; name: string; color: string | null }>;
}

const VENDOR_BANK_PATTERNS: { pattern: RegExp; bankName: string }[] = [
  { pattern: /\bkaspi\b/i, bankName: 'kaspi' },
  { pattern: /каспи/i, bankName: 'kaspi' },
  { pattern: /\bbereke\b/i, bankName: 'bereke_new' },
  { pattern: /береке/i, bankName: 'bereke_new' },
  { pattern: /\bhalyk\b/i, bankName: 'halyk' },
  { pattern: /халык/i, bankName: 'halyk' },
  { pattern: /\bhapoalim\b/i, bankName: 'hapoalim' },
];

const detectBankFromVendor = (vendor?: string | null): string | null => {
  if (!vendor) {
    return null;
  }
  for (const { pattern, bankName } of VENDOR_BANK_PATTERNS) {
    if (pattern.test(vendor)) {
      return bankName;
    }
  }
  return null;
};

const parseAmountValue = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

export const hasReceiptAmount = (receipt: ReceiptDocument): boolean => {
  if (parseAmountValue(receipt.parsedData?.amount ?? null) !== null) {
    return true;
  }
  // Scan receipts with a linked statement (e.g. bank statement PDFs uploaded via scan)
  // should be shown even without a parsed receipt amount.
  return receipt.source === 'scan' && !!receipt.statementId;
};

export const mapReceiptToStatement = (receipt: ReceiptDocument): ReceiptMappedStatement | null => {
  const amount = parseAmountValue(receipt.parsedData?.amount ?? null);
  // Allow scan receipts with a linked statement even without a parsed amount
  if (amount === null && !(receipt.source === 'scan' && receipt.statementId)) {
    return null;
  }

  return {
    id: receipt.id,
    statementId: receipt.statementId ?? null,
    source: 'scan',
    receiptSource: receipt.source,
    fileName: resolveReceiptMerchantLabel({
      vendor: receipt.parsedData?.vendor,
      sender: receipt.sender,
      subject: receipt.subject,
      fallback: 'Receipt',
    }),
    subject: receipt.subject,
    sender: receipt.sender,
    status: receipt.status,
    totalTransactions: 0,
    totalDebit: amount ?? 0,
    totalCredit: null,
    exported: null,
    paid: null,
    createdAt: receipt.receivedAt,
    processedAt: undefined,
    statementDateFrom: receipt.parsedData?.date || receipt.receivedAt,
    statementDateTo: null,
    bankName: detectBankFromVendor(receipt.parsedData?.vendor) ?? 'receipt',
    fileType: 'receipt',
    currency: receipt.parsedData?.currency || FALLBACK_CURRENCY,
    user: null,
    errorMessage: receipt.status === 'failed' ? 'Failed to parse' : null,
    receivedAt: receipt.receivedAt,
    category: receipt.category,
    tags: receipt.tags,
    parsedData: {
      amount: amount ?? undefined,
      currency: receipt.parsedData?.currency,
      vendor: receipt.parsedData?.vendor,
      date: receipt.parsedData?.date,
      category: receipt.parsedData?.category,
      categoryId: receipt.parsedData?.categoryId,
      lineItems: receipt.parsedData?.lineItems,
    },
  };
};

export const mapReceiptsToStatements = (receipts: ReceiptDocument[]): ReceiptMappedStatement[] => {
  return receipts.flatMap(receipt => {
    const mapped = mapReceiptToStatement(receipt);
    return mapped ? [mapped] : [];
  });
};
