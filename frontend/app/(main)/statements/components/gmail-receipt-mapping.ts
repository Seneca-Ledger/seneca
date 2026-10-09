import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';

export interface GmailReceipt {
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
  category?: { id: string; name: string } | null;
  gmailMessageId?: string;
}

interface GmailMappedParsedData {
  amount?: number;
  currency?: string;
  vendor?: string;
  date?: string;
  category?: string;
  categoryId?: string;
  lineItems?: Array<{ description: string; amount?: number }>;
}

export interface GmailMappedStatement {
  id: string;
  statementId?: string | null;
  source: 'gmail' | 'scan';
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
  gmailMessageId?: string;
  receivedAt: string;
  parsedData?: GmailMappedParsedData;
  category?: { id: string; name: string } | null;
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

export const hasGmailReceiptAmount = (receipt: GmailReceipt): boolean => {
  if (parseAmountValue(receipt.parsedData?.amount ?? null) !== null) {
    return true;
  }
  // Scan receipts with a linked statement (e.g. bank statement PDFs uploaded via scan)
  // should be shown even without a parsed receipt amount.
  return receipt.source === 'scan' && !!receipt.statementId;
};

export const mapGmailReceiptToStatement = (receipt: GmailReceipt): GmailMappedStatement | null => {
  const amount = parseAmountValue(receipt.parsedData?.amount ?? null);
  // Allow scan receipts with a linked statement even without a parsed amount
  if (amount === null && !(receipt.source === 'scan' && receipt.statementId)) {
    return null;
  }

  const receiptSource = receipt.source || 'gmail';
  const isLocalReceipt = receiptSource !== 'gmail';

  return {
    id: receipt.id,
    statementId: receipt.statementId ?? null,
    source: isLocalReceipt ? 'scan' : 'gmail',
    receiptSource,
    fileName: resolveGmailMerchantLabel({
      vendor: receipt.parsedData?.vendor,
      sender: receipt.sender,
      subject: receipt.subject,
      fallback: 'Gmail receipt',
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
    bankName: isLocalReceipt
      ? (detectBankFromVendor(receipt.parsedData?.vendor) ?? 'receipt')
      : 'gmail',
    fileType: isLocalReceipt ? 'receipt' : 'gmail',
    currency: receipt.parsedData?.currency || FALLBACK_CURRENCY,
    user: null,
    errorMessage: receipt.status === 'failed' ? 'Failed to parse' : null,
    gmailMessageId: receipt.gmailMessageId,
    receivedAt: receipt.receivedAt,
    category: receipt.category,
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

export const mapGmailReceiptsToStatements = (receipts: GmailReceipt[]): GmailMappedStatement[] => {
  return receipts.flatMap(receipt => {
    const mapped = mapGmailReceiptToStatement(receipt);
    return mapped ? [mapped] : [];
  });
};
