import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as pdfParse from 'pdf-parse';
import { stripHtmlForAi } from '../../../common/utils/ai-response.util';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import {
  createReceiptAmountHelpers,
  DEFAULT_RECEIPT_SYMBOL_TO_CURRENCY,
  extractCurrency as detectCurrency,
  selectTopAmountCandidate,
} from '../../../common/utils/receipt-amount.util';
import {
  buildCurrencyTokenPattern,
  extractLineItemsFromLines,
  extractAmountFragments as extractSharedAmountFragments,
  isLikelySentence as isSharedLikelySentence,
  scoreAmountCandidate as scoreSharedAmountCandidate,
} from '../../../common/utils/receipt-extraction.util';
import { extractBrandFromSender } from '../../../common/utils/sender-brand.util';
import type { Receipt } from '../../../entities';
import { UniversalAmountParser } from '../../parsing/services/universal-amount-parser.service';
import { UniversalExtractorService } from '../../parsing/services/universal-extractor.service';
import { AiMerchantExtractor } from '../helpers/ai-merchant-extractor.helper';

type AmountExtractionResult = {
  amount: number;
  currency: string;
};

type AmountCandidate = {
  amount: number;
  currency: string;
  hasTotalKeyword: boolean;
  explicitCurrency: boolean;
  lineIndex: number;
  score: number;
};

type ReceiptParseContext = {
  sender?: string;
  subject?: string;
  dateHeader?: string;
  emailBody?: string | null;
};

type ParsedReceiptLineItem = NonNullable<NonNullable<Receipt['parsedData']>['lineItems']>[number];

interface ParsedReceiptResult extends Partial<NonNullable<Receipt['parsedData']>> {
  extracted?: boolean;
}

/** The RFC 2822 `Date:` header as `YYYY-MM-DD`; the raw header is kept when it does not parse. */
export function normalizeDateHeader(dateHeader: string | undefined): string | undefined {
  if (!dateHeader) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateHeader)) return dateHeader;
  const parsed = new Date(dateHeader);
  return Number.isNaN(parsed.getTime()) ? dateHeader : parsed.toISOString().slice(0, 10);
}

const GENERIC_VENDOR_PATTERN =
  /^(page\s+\d+(\s+of\s+\d+)?|receipt|invoice|order\s+confirmation|payment\s+receipt|tax\s+invoice|credit\s+note)$/i;

const DATE_LIKE_VENDOR_PATTERN =
  /^(date\s*)?\d{4}[-/.]\d{2}[-/.]\d{2}|^\d{2}[-/.]\d{2}[-/.]\d{4}|\d{1,2}:\d{2}\s*(am|pm)(\s*(pst|est|utc|gmt|cst|mst))?$/i;

const NUMERIC_ONLY_VENDOR_PATTERN = /^\d+$/;

const AMOUNT_LIKE_VENDOR_PATTERN = /^[$€£¥₽₸]\s*[\d,.]+$|^[\d,.]+\s*[$€£¥₸₽]$/;

const EMAIL_LIKE_VENDOR_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

const ID_LIKE_VENDOR_PATTERN = /^[A-Z0-9]{6,}-\d+$/;

const TOTAL_KEYWORD_REGEX =
  /\b(grand\s*total|total\s*amount|amount\s*(due|charged|paid|to\s*pay)|total|итого|сумма|всего|к\s*оплате|оплата|celkem)\b/i;

const NUMBER_PATTERN = '-?\\d{1,3}(?:[\\s.,]\\d{3})*(?:[.,]\\d{1,2})|-?\\d+(?:[.,]\\d{1,2})';

@Injectable()
export class GmailReceiptParserService {
  private readonly logger = new Logger(GmailReceiptParserService.name);
  private readonly amountHelpers = createReceiptAmountHelpers(this.amountParser, NUMBER_PATTERN);

  constructor(
    private readonly amountParser: UniversalAmountParser,
    @Optional()
    @Inject(AiMerchantExtractor)
    private readonly aiMerchantExtractor?: AiMerchantExtractor,
    @Optional()
    @Inject(UniversalExtractorService)
    private readonly universalExtractor?: UniversalExtractorService,
  ) {}

  async parseReceipt(
    filePath: string,
    context?: ReceiptParseContext | string,
  ): Promise<ParsedReceiptResult | null> {
    const parseContext: ReceiptParseContext =
      typeof context === 'string' ? { sender: context } : context || {};

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = this.getMimeType(filePath);

      if (mimeType === 'application/pdf') {
        return await this.parsePdfReceipt(fileBuffer, parseContext);
      }

      return {
        confidence: 0.5,
        extracted: false,
      };
    } catch (error) {
      this.logger.error('Failed to parse receipt', error);
      return null;
    }
  }

  async parseFromEmailOnly(context: ReceiptParseContext): Promise<ParsedReceiptResult | null> {
    let vendor: string | undefined;

    if (this.aiMerchantExtractor?.isAvailable()) {
      try {
        const aiResult = await this.aiMerchantExtractor.extractMerchant({
          emailBody: context.emailBody,
          sender: context.sender,
          subject: context.subject,
          dateHeader: context.dateHeader,
        });

        if (aiResult && aiResult.confidence >= 0.5) {
          vendor = aiResult.merchant;
        }
      } catch (error) {
        this.logger.warn('AI extraction from email body failed', error);
      }
    }

    if (!vendor) {
      vendor = extractBrandFromSender(context.sender);
    }

    const bodyText = context.emailBody ? stripHtmlForAi(context.emailBody) : '';
    const amountWithCurrency = bodyText
      ? await this.extractAmountWithCurrency(bodyText)
      : undefined;
    const transactionType = bodyText ? this.detectTransactionType(bodyText) : 'unknown';

    // An order confirmation in the body is a receipt too: the same extractor
    // that reads a PDF reads the stripped text for its line items (and a total
    // when the amount scan above found none).
    let lineItems: NonNullable<Receipt['parsedData']>['lineItems'] = [];
    let fallbackAmount: number | undefined;
    if (bodyText && this.universalExtractor) {
      try {
        const document = await this.universalExtractor.extractFromText(bodyText);
        lineItems = (document.lineItems ?? [])
          .filter(item => item.description && Number.isFinite(item.amount) && item.amount > 0)
          .map(item => ({ description: item.description, amount: item.amount }));
        fallbackAmount = document.totalAmount;
      } catch (error) {
        this.logger.warn('Line-item extraction from email body failed', error);
      }
    }

    return {
      amount: amountWithCurrency?.amount ?? fallbackAmount,
      currency: amountWithCurrency?.currency || appDefaultCurrency(),
      date: normalizeDateHeader(context.dateHeader),
      vendor,
      confidence: vendor ? 0.6 : 0.3,
      transactionType,
      lineItems,
    };
  }

  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  private async parsePdfReceipt(
    buffer: Buffer,
    context: ReceiptParseContext,
  ): Promise<ParsedReceiptResult | null> {
    try {
      const data = await pdfParse(buffer);
      const text = data.text;

      if (this.universalExtractor) {
        try {
          const universal = await this.universalExtractor.extractFromText(text, {
            sender: context.sender,
            subject: context.subject,
            emailBody: context.emailBody || undefined,
            fileNameHint: context.subject,
          });

          if (
            universal.totalAmount !== undefined ||
            universal.vendor ||
            universal.date ||
            universal.lineItems.length > 0
          ) {
            return {
              amount: universal.totalAmount,
              currency: universal.currency || appDefaultCurrency(),
              date: universal.date ? universal.date.toISOString().split('T')[0] : undefined,
              vendor: universal.vendor,
              tax: universal.tax,
              taxRate: universal.taxRate,
              subtotal: universal.subtotal,
              lineItems: universal.lineItems,
              confidence: universal.confidence,
              transactionType: universal.transactionType,
            };
          }
        } catch (error) {
          this.logger.warn('Universal extractor failed, falling back to legacy parser', error);
        }
      }

      const amountWithCurrency = await this.extractAmountWithCurrency(text);
      const amount = amountWithCurrency?.amount;
      const currency =
        amountWithCurrency?.currency || this.extractCurrency(text) || appDefaultCurrency();
      const date = this.extractDate(text);
      const vendor = await this.extractVendorWithAi(text, context);
      const tax = this.extractTax(text);
      let lineItems = await this.extractLineItems(text);

      if (amount !== undefined && amount > 0 && lineItems.length > 0) {
        const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
        if (lineItemsTotal > amount * 2) {
          lineItems = [];
        }
      }

      let subtotal: number | undefined;
      let taxRate: number | undefined;
      if (amount && tax) {
        subtotal = amount - tax;
        taxRate = (tax / subtotal) * 100;
      }

      const confidence = this.calculateConfidence({
        amount,
        date,
        vendor,
        tax,
        lineItems,
      });

      return {
        amount,
        currency,
        date,
        vendor,
        tax,
        taxRate,
        subtotal,
        lineItems,
        confidence,
        transactionType: this.detectTransactionType(text),
      };
    } catch (error) {
      this.logger.error('Failed to parse PDF receipt', error);
      return null;
    }
  }

  private async extractAmountWithCurrency(
    text: string,
  ): Promise<AmountExtractionResult | undefined> {
    const lines = text
      .split('\n')
      .map(line => line.replace(/\u00a0/g, ' ').trim())
      .filter(Boolean);
    const documentCurrency = this.amountHelpers.extractCurrency(text);
    const candidates: AmountCandidate[] = [];

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const hasTotalKeyword = this.hasTotalKeyword(line);
      const fragments = extractSharedAmountFragments(
        line,
        hasTotalKeyword,
        this.getCurrencyTokenPattern(),
      );

      for (const fragment of fragments) {
        const parsed = await this.amountHelpers.parseAmountFragment(fragment);
        if (!parsed || parsed.amount <= 0) {
          continue;
        }

        const fragmentCurrency = this.amountHelpers.extractCurrency(fragment);
        const lineCurrency = this.amountHelpers.extractCurrency(line);
        const currency =
          parsed.currency ||
          fragmentCurrency ||
          lineCurrency ||
          documentCurrency ||
          appDefaultCurrency();
        const explicitCurrency = Boolean(parsed.currency || fragmentCurrency);

        candidates.push({
          amount: parsed.amount,
          currency,
          hasTotalKeyword,
          explicitCurrency,
          lineIndex: index,
          score: scoreSharedAmountCandidate(
            parsed.amount,
            hasTotalKeyword,
            explicitCurrency,
            index,
            lines.length,
          ),
        });
      }
    }

    if (candidates.length === 0) {
      return undefined;
    }

    const bestCandidate = selectTopAmountCandidate(candidates);
    if (!bestCandidate) {
      return undefined;
    }

    return {
      amount: bestCandidate.amount,
      currency: bestCandidate.currency,
    };
  }

  /**
   * First date-looking token that is actually a plausible receipt date. Digits
   * inside DOIs, phone numbers or page references also match the shapes, so
   * every candidate is checked: whole token, real calendar date, sane year.
   */
  private extractDate(text: string): string | undefined {
    const patterns = [
      /(?<![\d.])(\d{2})[-/.](\d{2})[-/.](\d{4})(?![\d.])/g,
      /(?<![\d.])(\d{4})[-/.](\d{2})[-/.](\d{2})(?![\d.])/g,
    ];
    const maxYear = new Date().getFullYear() + 1;

    for (const [index, pattern] of patterns.entries()) {
      for (const match of text.matchAll(pattern)) {
        const [token, a, b, c] = match;
        const year = Number(index === 0 ? c : a);
        const month = Number(b);
        const day = Number(index === 0 ? a : c);
        const calendar = new Date(Date.UTC(year, month - 1, day));
        const real =
          calendar.getUTCFullYear() === year &&
          calendar.getUTCMonth() === month - 1 &&
          calendar.getUTCDate() === day;
        if (real && year >= 1990 && year <= maxYear) {
          return token;
        }
      }
    }

    return undefined;
  }

  private async extractVendorWithAi(
    pdfText: string,
    context: ReceiptParseContext,
  ): Promise<string | undefined> {
    if (this.aiMerchantExtractor?.isAvailable()) {
      try {
        const aiResult = await this.aiMerchantExtractor.extractMerchant({
          pdfText,
          emailBody: context.emailBody,
          sender: context.sender,
          subject: context.subject,
          dateHeader: context.dateHeader,
        });

        if (aiResult && aiResult.confidence >= 0.5) {
          this.logger.debug(
            `AI merchant resolved to "${aiResult.merchant}" with confidence ${aiResult.confidence.toFixed(2)}`,
          );
          return aiResult.merchant;
        }
      } catch (error) {
        this.logger.warn('AI merchant extraction failed, falling back to heuristics', error);
      }
    }

    return this.extractVendor(pdfText, context.sender);
  }

  private extractVendor(text: string, senderName?: string): string | undefined {
    const senderBrand = extractBrandFromSender(senderName);
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    for (const line of lines) {
      if (line.length <= 2 || line.length > 40) {
        continue;
      }

      if (GENERIC_VENDOR_PATTERN.test(line)) {
        continue;
      }

      if (DATE_LIKE_VENDOR_PATTERN.test(line)) {
        continue;
      }

      if (NUMERIC_ONLY_VENDOR_PATTERN.test(line)) {
        continue;
      }

      if (AMOUNT_LIKE_VENDOR_PATTERN.test(line)) {
        continue;
      }

      if (EMAIL_LIKE_VENDOR_PATTERN.test(line)) {
        continue;
      }

      if (ID_LIKE_VENDOR_PATTERN.test(line)) {
        continue;
      }

      if (isSharedLikelySentence(line)) {
        continue;
      }

      return line.slice(0, 100);
    }

    if (senderBrand) {
      return senderBrand;
    }

    return undefined;
  }

  private extractTax(text: string): number | undefined {
    const patterns = [
      /tax[:\s]+(\d+[\s,.]?\d*)/i,
      /vat[:\s]+(\d+[\s,.]?\d*)/i,
      /НДС[:\s]+(\d+[\s,.]?\d*)/i,
      /налог[:\s]+(\d+[\s,.]?\d*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const numStr = match[1].replace(/[\s,]/g, '');
        const num = Number.parseFloat(numStr);
        if (!Number.isNaN(num)) {
          return num;
        }
      }
    }

    return undefined;
  }

  private async extractLineItems(
    text: string,
  ): Promise<Array<{ description: string; amount: number }>> {
    const lineItems = await extractLineItemsFromLines({
      lines: text.split('\n').map(line => line.replace(/\u00a0/g, ' ')),
      currencyTokenPattern: this.getCurrencyTokenPattern(),
      numberPattern: NUMBER_PATTERN,
      hasTotalKeyword: line => this.hasTotalKeyword(line),
      parseAmountFragment: fragment => this.amountHelpers.parseAmountFragment(fragment),
      extractCurrency: value => this.amountHelpers.extractCurrency(value),
    });

    return lineItems.length > 0 ? lineItems : [];
  }

  private calculateConfidence(data: {
    amount?: number;
    date?: string;
    vendor?: string;
    tax?: number;
    lineItems?: ParsedReceiptLineItem[];
  }): number {
    let confidence = 0;

    if (data.amount !== undefined) {
      confidence += 30;
    }
    if (data.date) {
      confidence += 20;
    }
    if (data.vendor) {
      confidence += 20;
    }
    if (data.tax) {
      confidence += 15;
    }
    if (data.lineItems && data.lineItems.length > 0) {
      confidence += 15;
    }

    return confidence / 100;
  }

  private hasTotalKeyword(line: string): boolean {
    return TOTAL_KEYWORD_REGEX.test(line);
  }

  private extractCurrency(text: string): string | undefined {
    return detectCurrency(text, this.amountParser, DEFAULT_RECEIPT_SYMBOL_TO_CURRENCY);
  }

  private getCurrencyTokenPattern(): string {
    return buildCurrencyTokenPattern(
      Object.keys(DEFAULT_RECEIPT_SYMBOL_TO_CURRENCY),
      this.amountParser.getSupportedCurrencies(),
    );
  }

  private detectTransactionType(text: string): 'income' | 'expense' | 'transfer' | 'unknown' {
    const lower = text.toLowerCase();

    if (
      /\b(refund|credited|deposit|incoming|возврат|зачислен|поступлен|доход|приход)\b/i.test(lower)
    ) {
      return 'income';
    }

    if (/\b(transfer|перевод между|внутренний перевод)\b/i.test(lower)) {
      return 'transfer';
    }

    if (
      /\b(payment|purchase|charge|debit|amount due|оплата|покупка|списание|расход|дебет)\b/i.test(
        lower,
      )
    ) {
      return 'expense';
    }

    return 'unknown';
  }
}
