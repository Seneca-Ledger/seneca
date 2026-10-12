import { BaseAiHelper } from '../../../common/helpers/base-ai.helper';
import { unwrapAiJson } from '../../../common/utils/ai-response.util';
import { normalizeMerchantAddress } from '../../../common/utils/receipt-extraction.util';
import type {
  DocumentType,
  LineItem,
  TransactionDirection,
} from '../interfaces/parsed-document.interface';
import { redactSensitive } from './ai-runtime.util';

export interface AiExtractionResult {
  documentType?: DocumentType;
  transactionType?: TransactionDirection;
  totalAmount?: number;
  currency?: string;
  date?: string;
  vendor?: string;
  tax?: number;
  taxRate?: number;
  subtotal?: number;
  lineItems?: LineItem[];
  categoryHint?: string;
  paymentMethod?: string;
  documentNumber?: string;
  merchantAddress?: string;
}

type RawAiLineItem = Partial<
  Record<'description' | 'quantity' | 'unitPrice' | 'amount' | 'tax', unknown>
>;
type RawAiExtractionResult = Partial<
  Record<
    | 'documentType'
    | 'transactionType'
    | 'totalAmount'
    | 'currency'
    | 'date'
    | 'vendor'
    | 'tax'
    | 'taxRate'
    | 'subtotal'
    | 'lineItems'
    | 'categoryHint'
    | 'paymentMethod'
    | 'documentNumber'
    | 'merchantAddress',
    unknown
  >
>;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const EXTRACTION_PROMPT = `You are a financial document parser. Extract all available data from this document and return ONLY JSON.

Output format:
{
  "documentType": "receipt" | "invoice" | "bank_statement" | "unknown",
  "transactionType": "income" | "expense" | "transfer" | "unknown",
  "totalAmount": number,
  "currency": "ISO-4217",
  "date": "YYYY-MM-DD",
  "vendor": "name",
  "tax": number,
  "taxRate": number,
  "subtotal": number,
  "lineItems": [{"description": "", "quantity": number, "unitPrice": number, "amount": number}],
  "categoryHint": "food|transport|entertainment|shopping|utilities|health|education|travel|other",
  "paymentMethod": "cash|card|bank_transfer|other",
  "documentNumber": "string",
  "merchantAddress": "street, building, city as printed"
}

Rules:
- totalAmount is the final/grand total and must be positive.
- transactionType for receipts is usually expense, but refund/return should be income.
- If a field is missing, omit it.
- Preserve vendor name exactly as in source.
- merchantAddress is the address of the store or branch where the purchase was made, as printed on the document. Never use a customer or delivery address. If only a legal/registered address is printed, use it.
`;

export class AiDocumentExtractor extends BaseAiHelper {
  async extractFromText(text: string): Promise<AiExtractionResult | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const payload = `${EXTRACTION_PROMPT}\n\nDocument text:\n${redactSensitive(text).slice(0, 15000)}`;
    return this.callModel([
      {
        role: 'user',
        parts: [{ text: payload }],
      },
    ]);
  }

  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<AiExtractionResult | null> {
    if (!this.isAvailable()) {
      return null;
    }

    return this.callModel([
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
          {
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ]);
  }

  private async callModel(
    contents: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
    }>,
  ): Promise<AiExtractionResult | null> {
    try {
      const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);
      const content = await this.generateJsonContent(contents, {
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 20000,
        retries: 1,
        baseDelayMs: 500,
        maxDelayMs: 5000,
      });
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(unwrapAiJson(content));
      const normalized = this.normalizeResult(parsed);
      return normalized;
    } catch (error) {
      this.logger.error('Failed:', error);
      return null;
    }
  }

  private normalizeResult(raw: RawAiExtractionResult): AiExtractionResult {
    return {
      documentType: this.normalizeDocumentType(optionalString(raw?.documentType)),
      transactionType: this.normalizeTransactionType(optionalString(raw?.transactionType)),
      totalAmount: typeof raw?.totalAmount === 'number' ? Math.abs(raw.totalAmount) : undefined,
      currency: typeof raw?.currency === 'string' ? raw.currency.toUpperCase() : undefined,
      date: typeof raw?.date === 'string' ? raw.date : undefined,
      vendor: typeof raw?.vendor === 'string' ? raw.vendor.trim() : undefined,
      tax: typeof raw?.tax === 'number' ? raw.tax : undefined,
      taxRate: typeof raw?.taxRate === 'number' ? raw.taxRate : undefined,
      subtotal: typeof raw?.subtotal === 'number' ? raw.subtotal : undefined,
      lineItems: Array.isArray(raw?.lineItems)
        ? raw.lineItems.filter(
            (item: unknown): item is LineItem =>
              typeof item === 'object' &&
              item !== null &&
              typeof (item as RawAiLineItem).description === 'string' &&
              typeof (item as RawAiLineItem).amount === 'number',
          )
        : undefined,
      categoryHint: typeof raw?.categoryHint === 'string' ? raw.categoryHint : undefined,
      paymentMethod: typeof raw?.paymentMethod === 'string' ? raw.paymentMethod : undefined,
      documentNumber: typeof raw?.documentNumber === 'string' ? raw.documentNumber : undefined,
      merchantAddress: normalizeMerchantAddress(raw?.merchantAddress),
    };
  }

  private normalizeDocumentType(value: string | undefined): DocumentType | undefined {
    if (
      value === 'receipt' ||
      value === 'invoice' ||
      value === 'bank_statement' ||
      value === 'unknown'
    ) {
      return value;
    }
    return undefined;
  }

  private normalizeTransactionType(value: string | undefined): TransactionDirection | undefined {
    if (value === 'income' || value === 'expense' || value === 'transfer' || value === 'unknown') {
      return value;
    }
    return undefined;
  }
}
