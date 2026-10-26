export type FinancialDocumentStatus = 'draft' | 'needs_review' | 'approved' | 'submitted' | 'paid';

export interface ReceiptLineItem {
  description: string;
  amount: number;
}

export interface ReceiptParsedDataLike {
  amount?: number | string | null;
  vendor?: string | null;
  lineItems?: ReceiptLineItem[] | null;
}

export const toFinancialDocumentStatus = (rawStatus?: string | null): FinancialDocumentStatus => {
  const normalized = (rawStatus || '').trim().toLowerCase();

  if (normalized === 'paid') {
    return 'paid';
  }

  if (normalized === 'submitted' || normalized === 'reviewed') {
    return 'submitted';
  }

  if (normalized === 'approved' || normalized === 'validated' || normalized === 'completed') {
    return 'approved';
  }

  if (
    normalized === 'needs_review' ||
    normalized === 'failed' ||
    normalized === 'error' ||
    normalized === 'rejected'
  ) {
    return 'needs_review';
  }

  return 'draft';
};

export const getFinancialDocumentStatusLabel = (status: FinancialDocumentStatus): string => {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'needs_review':
      return 'Needs review';
    case 'approved':
      return 'Approved';
    case 'submitted':
      return 'Submitted';
    case 'paid':
      return 'Paid';
    default:
      return 'Draft';
  }
};

export const isLowConfidenceDocument = (confidence?: number | null, threshold = 0.8): boolean => {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return false;
  }

  return confidence < threshold;
};

/** The receipt's own line items. A total is not an item, so none means an empty list. */
export const normalizeReceiptLineItems = (
  parsedData?: ReceiptParsedDataLike | null,
): ReceiptLineItem[] => {
  const lineItems = parsedData?.lineItems;
  return Array.isArray(lineItems) ? lineItems.filter(item => Number.isFinite(item.amount)) : [];
};
