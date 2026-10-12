import type { ParsedDocument } from '../parsing/interfaces/parsed-document.interface';
import type { EInvoice, EInvoiceVatBreakdown } from './einvoice-reader';

/** What a receipt keeps of an e-invoice's XML, beyond the usual parsed fields. */
export interface EInvoiceSummary {
  syntax: EInvoice['syntax'];
  profile: string | null;
  /** False for ZUGFeRD MINIMUM / BASIC-WL: then it is not an e-invoice under § 14 UStG. */
  meetsEn16931: boolean;
  typeCode: string | null;
  number: string | null;
  dueDate: string | null;
  deliveryDate: string | null;
  iban: string | null;
  seller: {
    name: string | null;
    vatId: string | null;
    taxNumber: string | null;
    countryCode: string | null;
  };
  /** The invoice says the buyer owes the VAT (UNCL 5305 AE) or it is an intra-Community supply (K). */
  reverseCharge: boolean;
  vat: EInvoiceVatBreakdown[];
}

/** Validation issue codes an e-invoice can raise, shown like any other. */
export const EINVOICE_ISSUES = {
  notEn16931: 'einvoice_not_en16931',
  totalsDisagree: 'einvoice_totals_disagree',
} as const;

const cents = (value: number) => Math.round(value * 100);

export function summarizeEInvoice(invoice: EInvoice): EInvoiceSummary {
  return {
    syntax: invoice.syntax,
    profile: invoice.profile,
    meetsEn16931: invoice.meetsEn16931,
    typeCode: invoice.typeCode,
    number: invoice.number,
    dueDate: invoice.dueDate,
    deliveryDate: invoice.deliveryDate,
    iban: invoice.iban,
    seller: {
      name: invoice.seller.name,
      vatId: invoice.seller.vatId,
      taxNumber: invoice.seller.taxNumber,
      countryCode: invoice.seller.countryCode,
    },
    reverseCharge: invoice.vat.some(item => item.category === 'AE' || item.category === 'K'),
    vat: invoice.vat,
  };
}

/**
 * The invoice as the rest of the receipt pipeline reads documents. Every
 * figure is the XML's own: certain, so confidence is 1. A received invoice
 * is a purchase; a credit note from the supplier is money coming back.
 */
export function parsedDocumentOf(invoice: EInvoice): ParsedDocument {
  const issues: string[] = [];
  if (!invoice.meetsEn16931) {
    issues.push(EINVOICE_ISSUES.notEn16931);
  }
  const vatSum = invoice.vat.reduce((sum, item) => sum + cents(item.tax), 0);
  if (invoice.taxTotal !== null && invoice.vat.length > 0 && vatSum !== cents(invoice.taxTotal)) {
    issues.push(EINVOICE_ISSUES.totalsDisagree);
  }
  const rates = [...new Set(invoice.vat.map(item => item.rate).filter(rate => rate !== null))];
  const certain = 1;
  return {
    documentType: 'invoice',
    transactionType: invoice.isCreditNote ? 'income' : 'expense',
    totalAmount: invoice.payable ?? invoice.grossTotal ?? undefined,
    currency: invoice.currency ?? undefined,
    date: invoice.issueDate ? new Date(`${invoice.issueDate}T00:00:00Z`) : undefined,
    vendor: invoice.seller.name ?? undefined,
    merchantAddress: invoice.seller.address ?? undefined,
    tax: invoice.taxTotal ?? undefined,
    taxRate: rates.length === 1 ? (rates[0] as number) : undefined,
    subtotal: invoice.netTotal ?? undefined,
    lineItems: invoice.lines.map(line => ({
      description: line.name,
      quantity: line.quantity ?? undefined,
      amount: line.net,
    })),
    documentNumber: invoice.number ?? undefined,
    confidence: certain,
    extractionMethod: 'einvoice_xml',
    fieldConfidence: {
      totalAmount: certain,
      transactionType: certain,
      date: certain,
      vendor: certain,
      currency: certain,
      tax: certain,
      lineItems: certain,
    },
    validationIssues: issues,
  };
}
