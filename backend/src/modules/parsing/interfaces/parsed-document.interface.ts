export type DocumentType = 'receipt' | 'invoice' | 'bank_statement' | 'unknown';

export type TransactionDirection = 'income' | 'expense' | 'transfer' | 'unknown';

export type ExtractionMethod =
  | 'regex'
  | 'ai'
  | 'hybrid'
  | 'ocr_regex'
  | 'ocr_ai'
  | 'ocr_hybrid'
  /** Read from the XML of a structured e-invoice; no OCR or guessing. */
  | 'einvoice_xml';

export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  tax?: number;
}

export interface ParsedDocument {
  documentType: DocumentType;
  transactionType: TransactionDirection;
  totalAmount?: number;
  currency?: string;
  date?: Date;
  vendor?: string;
  merchantAddress?: string;
  tax?: number;
  taxRate?: number;
  subtotal?: number;
  lineItems: LineItem[];
  categoryHint?: string;
  paymentMethod?: string;
  documentNumber?: string;
  confidence: number;
  extractionMethod: ExtractionMethod;
  rawText?: string;
  fieldConfidence: {
    totalAmount?: number;
    transactionType?: number;
    date?: number;
    vendor?: number;
    currency?: number;
    tax?: number;
    lineItems?: number;
  };
  validationIssues: string[];
  language?: string;
}
