import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import {
  createReceiptAmountHelpers,
  DEFAULT_RECEIPT_SYMBOL_TO_CURRENCY,
  extractCurrency as detectCurrency,
  extractAmountWithCurrency as extractSharedAmountWithCurrency,
} from '../../../common/utils/receipt-amount.util';
import {
  buildCurrencyTokenPattern,
  extractLineItemsFromLines,
  extractMerchantAddress,
  extractAmountFragments as extractSharedAmountFragments,
} from '../../../common/utils/receipt-extraction.util';
import {
  AiDocumentExtractor,
  type AiExtractionResult,
} from '../helpers/ai-document-extractor.helper';
import type {
  DocumentType,
  LineItem,
  ParsedDocument,
} from '../interfaces/parsed-document.interface';
import { DocumentClassifierService } from './document-classifier.service';
import { OcrService } from './ocr.service';
import { TransactionTypeDetectorService } from './transaction-type-detector.service';
import { UniversalAmountParser } from './universal-amount-parser.service';

export interface ExtractorContext {
  sender?: string;
  subject?: string;
  fileNameHint?: string;
  emailBody?: string;
  ocrLanguages?: string[];
}

type AmountCandidate = {
  amount: number;
  currency?: string;
  score: number;
};

// Letter/digit lookarounds instead of \b: JS \b is ASCII-only, so it never matched the Cyrillic keywords.
const TOTAL_KEYWORD_REGEX =
  /(?<![\p{L}\p{N}_])(grand\s*total|total\s*amount|amount\s*(due|charged|paid|to\s*pay)|total|итого|сумма|всего|к\s*оплате|оплата|celkem)(?![\p{L}\p{N}_])/iu;

const NUMBER_PATTERN = '-?\\d{1,3}(?:[\\s.,]\\d{3})*(?:[.,]\\d{1,2})?|-?\\d+(?:[.,]\\d{1,2})?';

// Anchored on non-digits so a longer run of OCR digits can't yield a date-looking substring.
const DATE_PATTERNS = [
  /(?<!\d)\d{2}[-/.]\d{2}[-/.]\d{4}(?!\d)/,
  /(?<!\d)\d{4}[-/.]\d{2}[-/.]\d{2}(?!\d)/,
];

const TAX_PATTERNS = [
  /tax[:\s]+(\d+[\s,.]?\d*)/i,
  /vat[:\s]+(\d+[\s,.]?\d*)/i,
  /НДС[:\s]+(\d+[\s,.]?\d*)/i,
  /налог[:\s]+(\d+[\s,.]?\d*)/i,
];

const SUBTOTAL_PATTERNS = [
  /subtotal[:\s]+(\d+[\s,.]?\d*)/i,
  /sub\s*-?\s*total[:\s]+(\d+[\s,.]?\d*)/i,
  /подитог[:\s]+(\d+[\s,.]?\d*)/i,
  /промежуточный\s*итог[:\s]+(\d+[\s,.]?\d*)/i,
];

/** Same window the universal date parser uses: anything outside it is noise, not a date. */
function isPlausibleDate(date: Date): boolean {
  return !Number.isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
}

@Injectable()
export class UniversalExtractorService {
  private readonly logger = new Logger(UniversalExtractorService.name);
  private readonly amountHelpers = createReceiptAmountHelpers(this.amountParser, NUMBER_PATTERN);

  constructor(
    private readonly amountParser: UniversalAmountParser,
    private readonly typeDetector: TransactionTypeDetectorService,
    private readonly classifier: DocumentClassifierService,
    private readonly ocrService: OcrService,
    @Optional()
    @Inject('AI_DOCUMENT_EXTRACTOR')
    private readonly aiExtractor?: AiDocumentExtractor,
  ) {}

  async extractFromText(text: string, context: ExtractorContext = {}): Promise<ParsedDocument> {
    if (!text?.trim()) {
      return this.emptyResult();
    }

    const classification = this.classifier.classify(text, {
      fileNameHint: context.fileNameHint,
    });

    const regexResult = await this.extractWithRegex(text, classification.documentType, context);

    const aiResult =
      this.aiExtractor?.isAvailable() && regexResult.confidence < 0.6
        ? await this.aiExtractor.extractFromText(text)
        : null;

    const merged = this.mergeResults(regexResult, aiResult);
    return this.validate(merged);
  }

  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    context: ExtractorContext = {},
  ): Promise<ParsedDocument> {
    const ocrResult = await this.ocrService.extractTextFromImage(imageBuffer, {
      languages: context.ocrLanguages,
      preprocess: true,
    });

    const fromText = await this.extractFromText(ocrResult.text, context);
    fromText.extractionMethod = 'ocr_regex';
    fromText.confidence = Math.round(fromText.confidence * ocrResult.confidence * 100) / 100;
    fromText.language = ocrResult.language;

    if (!this.aiExtractor?.isAvailable()) {
      return fromText;
    }

    const aiFromImage = await this.aiExtractor.extractFromImage(imageBuffer, mimeType);
    const merged = this.mergeResults(fromText, aiFromImage);
    merged.extractionMethod = 'ocr_hybrid';
    merged.language = ocrResult.language;
    return this.validate(merged);
  }

  async extractFromPdf(pdfBuffer: Buffer, context: ExtractorContext = {}): Promise<ParsedDocument> {
    try {
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = pdfParseModule.default ?? pdfParseModule;
      const data = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(pdfBuffer);
      const text = (data.text || '').replace(/\0/g, '').trim();

      if (text.length > 50) {
        return this.extractFromText(text, context);
      }
    } catch (error) {
      this.logger.warn('Failed to extract text from PDF via pdf-parse', error);
    }

    const ocrResult = await this.ocrService.extractTextFromScannedPdf(pdfBuffer, {
      languages: context.ocrLanguages,
      preprocess: true,
    });

    if (ocrResult.text.trim().length) {
      const parsed = await this.extractFromText(ocrResult.text, context);
      parsed.extractionMethod = 'ocr_regex';
      parsed.confidence = Math.round(parsed.confidence * ocrResult.confidence * 100) / 100;
      parsed.language = ocrResult.language;
      return parsed;
    }

    return this.emptyResult();
  }

  private async extractWithRegex(
    text: string,
    documentType: DocumentType,
    context: ExtractorContext,
  ): Promise<ParsedDocument> {
    const lines = text
      .split('\n')
      .map(line => line.replace(/\u00a0/g, ' ').trim())
      .filter(Boolean);

    const amount = await this.extractAmountWithCurrency(lines, text);
    const currency = amount?.currency || this.extractCurrency(text) || appDefaultCurrency();
    const date = this.extractDate(text);
    const vendor = this.extractVendor(lines, context.sender, text);
    const merchantAddress = extractMerchantAddress(lines);
    const tax = this.extractNumberByPatterns(text, TAX_PATTERNS);
    const subtotal = this.extractNumberByPatterns(text, SUBTOTAL_PATTERNS);
    const lineItems = await this.extractLineItems(lines);

    const transactionType = this.typeDetector.detect({
      text,
      documentType,
      amount: amount?.amount,
      sender: context.sender,
      subject: context.subject,
    });

    let taxRate: number | undefined;
    if (subtotal && tax && subtotal > 0) {
      taxRate = Math.round((tax / subtotal) * 10000) / 100;
    }

    const fieldConfidence = {
      totalAmount: amount ? 0.85 : 0,
      transactionType: transactionType.confidence,
      date: date ? 0.8 : 0,
      vendor: vendor ? 0.75 : 0,
      currency: currency ? 0.85 : 0,
      tax: tax ? 0.75 : 0,
      lineItems: lineItems.length ? 0.7 : 0,
    };

    return {
      documentType,
      transactionType: transactionType.direction,
      totalAmount: amount?.amount,
      currency,
      date,
      vendor,
      merchantAddress,
      tax,
      taxRate,
      subtotal,
      lineItems,
      confidence: this.calculateOverallConfidence(fieldConfidence),
      extractionMethod: 'regex',
      rawText: text,
      fieldConfidence,
      validationIssues: [],
      language: undefined,
    };
  }

  private async extractAmountWithCurrency(
    lines: string[],
    fullText: string,
  ): Promise<{ amount: number; currency?: string } | undefined> {
    return extractSharedAmountWithCurrency(lines, fullText, {
      amountParser: this.amountParser,
      numberPattern: NUMBER_PATTERN,
      extractCurrency: text => this.amountHelpers.extractCurrency(text),
      extractAmountFragments: (line, includeNumbersWithoutCurrency, currencyTokenPattern) =>
        extractSharedAmountFragments(line, includeNumbersWithoutCurrency, currencyTokenPattern),
      parseAmountFragment: fragment => this.amountHelpers.parseAmountFragment(fragment),
      getCurrencyTokenPattern: () => this.getCurrencyTokenPattern(),
      hasTotalKeyword: line => TOTAL_KEYWORD_REGEX.test(line),
    });
  }

  private extractCurrency(text: string): string | undefined {
    return detectCurrency(text, this.amountParser, DEFAULT_RECEIPT_SYMBOL_TO_CURRENCY);
  }

  private extractDate(text: string): Date | undefined {
    for (const pattern of DATE_PATTERNS) {
      const match = text.match(pattern);
      if (!match?.[0]) {
        continue;
      }

      const candidate = match[0];
      if (/^\d{4}/.test(candidate)) {
        const date = new Date(candidate.replace(/[/.]/g, '-'));
        if (isPlausibleDate(date)) {
          return date;
        }
        continue;
      }

      const [left, middle, right] = candidate.split(/[./-]/).map(part => Number(part));
      if (left > 0 && left <= 31 && middle > 0 && middle <= 12) {
        const date = new Date(right, middle - 1, left);
        if (isPlausibleDate(date)) {
          return date;
        }
      }
    }

    return undefined;
  }

  private static readonly BANK_PATTERNS: { regex: RegExp; name: string }[] = [
    { regex: /\b(kaspi\s+bank|kaspi\.kz|каспи\s+банк|каспи)\b/i, name: 'Kaspi Bank' },
    { regex: /\b(bereke\s+bank|bereke\s+business|береке\s+банк|береке)\b/i, name: 'Bereke Bank' },
    { regex: /\b(halyk\s+bank|халык\s+банк|халык)\b/i, name: 'Halyk Bank' },
    { regex: /\b(forte\s+bank|форте\s+банк|форте)\b/i, name: 'Forte Bank' },
    { regex: /\b(jusan\s+bank|жусан\s+банк|жусан)\b/i, name: 'Jusan Bank' },
    { regex: /\bcaspkzka\b/i, name: 'Kaspi Bank' },
    { regex: /\bbrkekzka\b/i, name: 'Bereke Bank' },
  ];

  private static readonly BANKING_LABEL_PATTERN =
    /\b(лицевой\s+счет|номер\s+счета|расчетный\s+счет|текущий\s+счет|банковский\s+счет|выписка|statement\s+of\s+account|account\s+number|account\s+statement)\b/i;

  private static readonly COLUMN_HEADER_PATTERN =
    /^(?:(?:description|item|unit\s*price|price|duration|qty|quantity|amount|total|rate|tax|vat|date)\s*){2,}$/i;

  private detectBankName(text: string): string | undefined {
    for (const { regex, name } of UniversalExtractorService.BANK_PATTERNS) {
      if (regex.test(text)) {
        return name;
      }
    }
    return undefined;
  }

  private extractVendor(lines: string[], sender?: string, fullText?: string): string | undefined {
    // When a known bank is detected in the document, use it directly.
    // Bank statements rarely have a meaningful "vendor" beyond the bank itself.
    const detectedBank = fullText ? this.detectBankName(fullText) : undefined;
    if (detectedBank) {
      return detectedBank;
    }

    for (const line of lines.slice(0, 8)) {
      if (line.length <= 2 || line.length > 50) {
        continue;
      }

      if (/^(page\s+\d+|receipt|invoice|чек|квитанция)$/i.test(line)) {
        continue;
      }

      // Page counters ("1 / 4", "Page 2 of 3") and table column headers, which
      // pdf-parse may glue together ("DESCRIPTIONPRICEDURATIONQTYAMOUNT").
      if (/^(page\s+)?\d+\s*(\/|of|из)\s*\d+$/i.test(line)) {
        continue;
      }

      if (UniversalExtractorService.COLUMN_HEADER_PATTERN.test(line)) {
        continue;
      }

      if (/\b(total|итого|tax|vat|ндс|date|дата|amount)\b/i.test(line)) {
        continue;
      }

      if (UniversalExtractorService.BANKING_LABEL_PATTERN.test(line)) {
        continue;
      }

      if (/^\d+$/.test(line)) {
        continue;
      }

      if (/^[\d.,\s]+$/.test(line)) {
        continue;
      }

      return line.slice(0, 100);
    }

    if (!sender) {
      return undefined;
    }

    const displayName = sender.split('<')[0]?.trim().replace(/^"|"$/g, '');
    if (displayName && !displayName.includes('@')) {
      return displayName.slice(0, 100);
    }

    return undefined;
  }

  private extractNumberByPatterns(text: string, patterns: RegExp[]): number | undefined {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match?.[1]) {
        continue;
      }

      const cleaned = match[1].replace(/[\s,]/g, '');
      const parsed = Number.parseFloat(cleaned);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private async extractLineItems(lines: string[]): Promise<LineItem[]> {
    return extractLineItemsFromLines({
      lines,
      currencyTokenPattern: this.getCurrencyTokenPattern(),
      numberPattern: NUMBER_PATTERN,
      hasTotalKeyword: line => TOTAL_KEYWORD_REGEX.test(line),
      isTaxLine: line => TAX_PATTERNS.some(pattern => pattern.test(line)),
      parseAmountFragment: fragment => this.amountHelpers.parseAmountFragment(fragment),
      extractCurrency: text => this.amountHelpers.extractCurrency(text),
      skipTaxLines: true,
    });
  }

  private mergeResults(
    primary: ParsedDocument,
    aiResult: AiExtractionResult | null,
  ): ParsedDocument {
    if (!aiResult) {
      return primary;
    }

    const merged: ParsedDocument = {
      ...primary,
      totalAmount: primary.totalAmount ?? aiResult.totalAmount,
      transactionType:
        primary.transactionType !== 'unknown'
          ? primary.transactionType
          : aiResult.transactionType || 'unknown',
      currency: primary.currency || aiResult.currency,
      date: primary.date || (aiResult.date ? new Date(aiResult.date) : undefined),
      vendor: primary.vendor || aiResult.vendor,
      // Unlike the other fields the model wins here: it reads a multi-line store
      // header far better than the single-line heuristic does.
      merchantAddress: aiResult.merchantAddress || primary.merchantAddress,
      tax: primary.tax ?? aiResult.tax,
      taxRate: primary.taxRate ?? aiResult.taxRate,
      subtotal: primary.subtotal ?? aiResult.subtotal,
      lineItems: primary.lineItems.length ? primary.lineItems : aiResult.lineItems || [],
      categoryHint: primary.categoryHint || aiResult.categoryHint,
      paymentMethod: primary.paymentMethod || aiResult.paymentMethod,
      documentNumber: primary.documentNumber || aiResult.documentNumber,
      extractionMethod: 'hybrid',
      fieldConfidence: {
        ...primary.fieldConfidence,
        totalAmount: primary.fieldConfidence.totalAmount || (aiResult.totalAmount ? 0.75 : 0),
        transactionType:
          primary.fieldConfidence.transactionType || (aiResult.transactionType ? 0.7 : 0),
        date: primary.fieldConfidence.date || (aiResult.date ? 0.7 : 0),
        vendor: primary.fieldConfidence.vendor || (aiResult.vendor ? 0.7 : 0),
        currency: primary.fieldConfidence.currency || (aiResult.currency ? 0.7 : 0),
        tax: primary.fieldConfidence.tax || (aiResult.tax ? 0.65 : 0),
        lineItems: primary.fieldConfidence.lineItems || (aiResult.lineItems?.length ? 0.65 : 0),
      },
    };

    merged.confidence = this.calculateOverallConfidence(merged.fieldConfidence);
    return merged;
  }

  private validate(doc: ParsedDocument): ParsedDocument {
    const validationIssues: string[] = [...doc.validationIssues];

    if (doc.subtotal && doc.tax && doc.totalAmount) {
      const expectedTotal = doc.subtotal + doc.tax;
      if (Math.abs(expectedTotal - doc.totalAmount) > 0.01) {
        validationIssues.push(
          `Subtotal (${doc.subtotal}) + tax (${doc.tax}) does not match total (${doc.totalAmount})`,
        );
      }
    }

    if (doc.lineItems.length > 0 && doc.totalAmount) {
      const lineItemsSum = doc.lineItems.reduce((sum, item) => sum + item.amount, 0);
      const compareTo = doc.subtotal || doc.totalAmount;
      if (Math.abs(lineItemsSum - compareTo) > compareTo * 0.05) {
        validationIssues.push(
          `Line items sum (${lineItemsSum.toFixed(2)}) does not match total (${compareTo.toFixed(2)})`,
        );
      }
    }

    return {
      ...doc,
      validationIssues,
      language: doc.language,
    };
  }

  private calculateOverallConfidence(fieldConfidence: ParsedDocument['fieldConfidence']): number {
    const weights = {
      totalAmount: 0.35,
      transactionType: 0.2,
      date: 0.15,
      vendor: 0.15,
      currency: 0.05,
      tax: 0.05,
      lineItems: 0.05,
    } as const;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [field, weight] of Object.entries(weights) as Array<
      [keyof typeof weights, number]
    >) {
      const confidence = fieldConfidence[field];
      if (confidence === undefined || confidence <= 0) {
        continue;
      }

      weightedSum += confidence * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 0;
    }

    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }

  private getCurrencyTokenPattern(): string {
    return buildCurrencyTokenPattern(
      Object.keys(DEFAULT_RECEIPT_SYMBOL_TO_CURRENCY),
      this.amountParser.getSupportedCurrencies(),
    );
  }

  private emptyResult(): ParsedDocument {
    return {
      documentType: 'unknown',
      transactionType: 'unknown',
      lineItems: [],
      confidence: 0,
      extractionMethod: 'regex',
      fieldConfidence: {},
      validationIssues: [],
      language: undefined,
    };
  }
}
