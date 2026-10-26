import { Injectable, Logger } from '@nestjs/common';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { findDocumentDate } from '../../../common/utils/document-date.util';
import { parsePdf } from '../../../common/utils/pdf-text.util';
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
  lineItemsReconcile,
} from '../../../common/utils/receipt-extraction.util';
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

// Where "07/08/2026" means July 8: a document in dollars or with a US address.
const US_DOCUMENT_PATTERN = /\b(?:united\s+states|usa)\b/i;

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

@Injectable()
export class UniversalExtractorService {
  private readonly logger = new Logger(UniversalExtractorService.name);
  private readonly amountHelpers = createReceiptAmountHelpers(this.amountParser, NUMBER_PATTERN);

  constructor(
    private readonly amountParser: UniversalAmountParser,
    private readonly typeDetector: TransactionTypeDetectorService,
    private readonly classifier: DocumentClassifierService,
    private readonly ocrService: OcrService,
  ) {}

  async extractFromText(text: string, context: ExtractorContext = {}): Promise<ParsedDocument> {
    if (!text?.trim()) {
      return this.emptyResult();
    }

    const classification = this.classifier.classify(text, {
      fileNameHint: context.fileNameHint,
    });

    const regexResult = await this.extractWithRegex(text, classification.documentType, context);
    return this.validate(regexResult);
  }

  async extractFromImage(
    imageBuffer: Buffer,
    _mimeType: string,
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
    return fromText;
  }

  async extractFromPdf(pdfBuffer: Buffer, context: ExtractorContext = {}): Promise<ParsedDocument> {
    try {
      const data = await parsePdf(pdfBuffer);
      const text = (data.text || '').replace(/\0/g, '').trim();

      if (text.length > 50) {
        return this.extractFromText(text, context);
      }
    } catch (error) {
      this.logger.warn('Failed to extract text from PDF via pdf.js', error);
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
    const statedCurrency = amount?.currency || this.extractCurrency(text);
    const currency = statedCurrency || appDefaultCurrency();
    const documentDate = findDocumentDate(text, {
      // The currency the page states, not the fallback: that says nothing about the document.
      monthFirst: statedCurrency === 'USD' || US_DOCUMENT_PATTERN.test(text),
    });
    const date = documentDate?.date;
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
      // Day and month that could be either way round are worth a second look.
      date: documentDate ? (documentDate.ambiguous ? 0.5 : 0.8) : 0,
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

  private static readonly SELLER_LABEL_PATTERN =
    /^(?:from|seller|supplier|vendor|sold\s+by|issued\s+by|bill\s+from|verk(?:ä|a)ufer|rechnungssteller|lieferant|продавец|поставщик|исполнитель)(?=$|[\s:-])\s*[:-]?\s*(.*)$/i;

  private static readonly BUYER_LABEL_PATTERN =
    /^(?:bill(?:ed)?\s+to|ship\s+to|sold\s+to|customer|buyer|rechnungsempf(?:ä|a)nger|kunde|покупатель|заказчик|плательщик)(?=$|[\s:-])/i;

  /**
   * "Invoice number2955 6044", "Receipt No. 12", "Order #A-17": a label and its
   * value, not a name. pdf-parse glues the two, so the value may start right
   * after the label ("Invoice numberWQH2831A"); a digit somewhere is what tells
   * it from a name that merely starts the same way.
   */
  private static readonly DOCUMENT_REFERENCE_PATTERN =
    /^(?:invoice|receipt|order|bill|document|reference|ref|account|customer|rechnung|beleg|счет|счёт|чек|заказ)\s*(?:no\.?|nr\.?|number|num|id|#|№)(?=.*\d)/i;

  /** The line as a vendor name, or undefined when it is anything else. */
  private vendorNameOf(raw: string): string | undefined {
    // Stripe-style headers glue the account handle on: "Anthropic, PBC@anthropic".
    const line = raw
      .trim()
      .replace(/@[\p{L}\p{N}_-]+$/u, '')
      .trim();

    if (line.length <= 2 || line.length > 50) {
      return undefined;
    }

    if (/^(page\s+\d+|receipt|invoice|чек|квитанция)$/i.test(line)) {
      return undefined;
    }

    if (UniversalExtractorService.DOCUMENT_REFERENCE_PATTERN.test(line)) {
      return undefined;
    }

    // Page counters ("1 / 4", "Page 2 of 3") and table column headers, which
    // pdf-parse may glue together ("DESCRIPTIONPRICEDURATIONQTYAMOUNT").
    if (/^(page\s+)?\d+\s*(\/|of|из)\s*\d+$/i.test(line)) {
      return undefined;
    }

    if (UniversalExtractorService.COLUMN_HEADER_PATTERN.test(line)) {
      return undefined;
    }

    if (/\b(total|итого|tax|vat|ндс|date|дата|amount)\b/i.test(line)) {
      return undefined;
    }

    if (UniversalExtractorService.BANKING_LABEL_PATTERN.test(line)) {
      return undefined;
    }

    // An email address or a phone number is contact detail, not the name.
    if (/\S+@\S+\.\S+/.test(line) || /^[+\d\s()./-]+$/.test(line)) {
      return undefined;
    }

    return line.slice(0, 100);
  }

  private extractVendor(lines: string[], sender?: string, fullText?: string): string | undefined {
    // When a known bank is detected in the document, use it directly.
    // Bank statements rarely have a meaningful "vendor" beyond the bank itself.
    const detectedBank = fullText ? this.detectBankName(fullText) : undefined;
    if (detectedBank) {
      return detectedBank;
    }

    // Who issued the document. An explicit label ("From:", "Seller") settles it;
    // otherwise the first line that is a name, read only up to where the buyer's
    // block starts: in an invoice the "Bill to" party is the user themselves.
    const firstLines = lines.slice(0, 25);
    const buyerAt = firstLines.findIndex(line =>
      UniversalExtractorService.BUYER_LABEL_PATTERN.test(line),
    );
    const head = buyerAt === -1 ? firstLines : firstLines.slice(0, buyerAt);

    for (const [index, line] of head.entries()) {
      const labelled = UniversalExtractorService.SELLER_LABEL_PATTERN.exec(line);
      if (!labelled) {
        continue;
      }
      const named = [labelled[1], head[index + 1]]
        .map(candidate => this.vendorNameOf(candidate ?? ''))
        .find(Boolean);
      if (named) {
        return named;
      }
    }

    for (const line of head) {
      const named = this.vendorNameOf(line);
      if (named) {
        return named;
      }
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

    // Items that do not add up to the document are page numbers, dates and
    // postcodes read as prices: worse than none, so they are dropped, not kept
    // with a warning.
    if (doc.lineItems.length > 0 && !lineItemsReconcile(doc.lineItems, doc)) {
      const lineItemsSum = doc.lineItems.reduce((sum, item) => sum + item.amount, 0);
      validationIssues.push(
        `Line items sum (${lineItemsSum.toFixed(2)}) does not match the total; line items dropped`,
      );
      return {
        ...doc,
        lineItems: [],
        fieldConfidence: { ...doc.fieldConfidence, lineItems: 0 },
        validationIssues,
        language: doc.language,
      };
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
