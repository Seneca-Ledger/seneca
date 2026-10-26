import * as fs from 'fs';
import { normalizeDate, normalizeNumber } from '../../../common/utils/number-normalizer.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type {
  ParsedStatement,
  ParsedStatementMetadata,
  ParsedTransaction,
} from '../interfaces/parsed-statement.interface';
import { OcrService } from '../services/ocr.service';
import { BaseParser } from './base.parser';

/** Markers that identify a Hapoalim / Isracard statement */
const DETECTION_MARKERS = [
  'בנק הפועלים',
  'ישראכרט',
  'isracard',
  'hapoalim',
  'isracard.co.il',
  'רכישות בחו"ל', // "Foreign purchases" — unique to Israeli card statements
  'מסטרקארד', // "Mastercard" in Hebrew
  'סה"כ חיוב לתאריך', // "Total charge for date" — Isracard-specific
];

/** Section header patterns */
const FOREIGN_SECTION_MARKER = 'רכישות בחו"ל';
const DOMESTIC_SECTION_MARKER = 'עסקות שחויבו';

/** Lines to skip */
const SUMMARY_MARKER = 'סה"כ חיוב לתאריך';
const CREDIT_TERMS_MARKER = 'מסגרת הכרטיס';
const COMMISSION_MARKERS = ['עמלה:', 'אחוזה:', 'סך הנחה', 'עמלה בחו', 'עמלה ברוטו'];

/** Minimum OCR confidence to attempt text-based parsing */
const MIN_OCR_CONFIDENCE = 0.4;

export class HapoalimParser extends BaseParser {
  private ocrService = new OcrService();
  private cachedOcrResult: { text: string; confidence: number; filePath: string } | null = null;

  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (bankName !== BankName.HAPOALIM && bankName !== BankName.OTHER) {
      return false;
    }

    if (fileType !== FileType.IMAGE && fileType !== FileType.PDF) {
      return false;
    }

    // Clear stale cache if file changed
    if (this.cachedOcrResult && this.cachedOcrResult.filePath !== filePath) {
      this.cachedOcrResult = null;
    }

    try {
      const text = await this.getText(cachedText, filePath, fileType);
      return this.hasHapoalimMarkers(text);
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(
    filePath: string,
    cachedText?: string,
    ocrConfidence?: number,
  ): Promise<ParsedStatement> {
    this.logger.debug('Starting to parse file:', filePath);

    const fileType = this.detectFileType(filePath);
    const text = await this.getText(cachedText, filePath, fileType);
    // ocrConfidence covers the case where the caller already ran OCR (and
    // handed us the text via cachedText) — without it, this.cachedOcrResult
    // stays null on that path and confidence silently defaults to 1.0,
    // regardless of how unreliable the actual OCR was.
    const confidence = ocrConfidence ?? this.cachedOcrResult?.confidence ?? 1.0;

    this.logger.debug(`Text length: ${text.length}, confidence: ${confidence.toFixed(2)}`);

    // Extract metadata from text
    const metadata = this.extractMetadata(text);
    this.logger.debug(
      `Account: ${metadata.accountNumber || 'N/A'}, Period: ${metadata.dateFrom?.toISOString().split('T')[0] || 'N/A'}`,
    );

    // Try OCR-based text parsing first if confidence is decent
    let transactions: ParsedTransaction[] = [];
    if (confidence >= MIN_OCR_CONFIDENCE) {
      transactions = this.parseTransactionsFromText(text);
      this.logger.debug(`OCR text parsing: ${transactions.length} transactions`);
    }

    // Clear OCR cache
    this.cachedOcrResult = null;

    return { metadata, transactions };
  }

  getVersion(): string {
    return '1.0.0';
  }

  // ─── Text extraction ──────────────────────────────────────────────

  private async getText(
    cachedText: string | undefined,
    filePath: string,
    fileType: FileType,
  ): Promise<string> {
    if (cachedText) {
      return cachedText;
    }

    if (this.cachedOcrResult && this.cachedOcrResult.filePath === filePath) {
      return this.cachedOcrResult.text;
    }

    if (fileType === FileType.IMAGE || this.ocrService.isImageFile(filePath)) {
      const imageBuffer = await fs.promises.readFile(filePath);
      const ocrResult = await this.ocrService.extractTextFromImage(imageBuffer, {
        languages: ['heb', 'eng'],
      });
      this.cachedOcrResult = {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        filePath,
      };
      return ocrResult.text;
    }

    // PDF fallback — try importing pdf text extractor
    const { extractTextFromPdf } = await import('../../../common/utils/pdf-parser.util');
    return extractTextFromPdf(filePath);
  }

  private detectFileType(filePath: string): FileType {
    if (this.ocrService.isImageFile(filePath)) return FileType.IMAGE;
    if (filePath.toLowerCase().endsWith('.pdf')) return FileType.PDF;
    return FileType.IMAGE;
  }

  private hasHapoalimMarkers(text: string): boolean {
    const lower = text.toLowerCase();
    return DETECTION_MARKERS.some(marker => lower.includes(marker.toLowerCase()));
  }

  // ─── Metadata extraction ──────────────────────────────────────────

  private extractMetadata(text: string): ParsedStatementMetadata {
    const accountNumber = this.extractHapoalimAccountNumber(text);
    const period = this.extractStatementPeriod(text);
    const cardEnding = this.extractCardEnding(text);

    return {
      accountNumber: accountNumber || '',
      dateFrom: period.from || new Date(),
      dateTo: period.to || new Date(),
      currency: 'ILS',
      institution: 'Bank Hapoalim',
      locale: 'he-IL',
      headerDisplay: {
        title: 'בנק הפועלים - ישראכרט',
        subtitle: cardEnding ? `כרטיס •${cardEnding}` : undefined,
        currencyDisplay: 'ILS (₪)',
        institutionDisplay: 'Bank Hapoalim / Isracard',
      },
    };
  }

  private extractHapoalimAccountNumber(text: string): string | null {
    // Format: XX-XXX-XXXXXXX (e.g., 12-600-1234567)
    const match = text.match(/(\d{2}-\d{3}-\d{7})/);
    return match ? match[1] : null;
  }

  private extractCardEnding(text: string): string | null {
    // Look for card ending like •4321 or *4321
    const match = text.match(/[•*](\d{4})/);
    return match ? match[1] : null;
  }

  private extractStatementPeriod(text: string): { from: Date | null; to: Date | null } {
    // Look for billing date pattern: "פרוט פעולותיך לתאריך: DD/MM/YY"
    const billingMatch = text.match(/לתאריך[:\s]*(\d{2}\/\d{2}\/\d{2,4})/);
    if (billingMatch) {
      const to = normalizeDate(billingMatch[1]);
      if (to) {
        // Billing cycle is typically one month
        const from = new Date(to);
        from.setMonth(from.getMonth() - 1);
        return { from, to };
      }
    }

    return { from: null, to: null };
  }

  // ─── Transaction parsing from OCR text ────────────────────────────

  private parseTransactionsFromText(text: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    let currentSection: 'foreign' | 'domestic' | 'none' = 'none';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect section changes
      if (line.includes(FOREIGN_SECTION_MARKER)) {
        currentSection = 'foreign';
        continue;
      }
      if (line.includes(DOMESTIC_SECTION_MARKER)) {
        currentSection = 'domestic';
        continue;
      }
      if (line.includes(CREDIT_TERMS_MARKER)) {
        break; // Stop at credit terms section
      }

      // Skip non-transaction lines
      if (this.isSkippableLine(line)) continue;
      if (currentSection === 'none') continue;

      // Try to parse transaction based on section
      const tx =
        currentSection === 'foreign'
          ? this.parseForeignTransactionLine(line)
          : this.parseDomesticTransactionLine(line);

      if (tx) {
        transactions.push(tx);
      }
    }

    return transactions;
  }

  private isSkippableLine(line: string): boolean {
    if (line.includes(SUMMARY_MARKER)) return true;
    if (COMMISSION_MARKERS.some(m => line.includes(m))) return true;
    if (/^[*]+\s*[פע]/.test(line)) return true; // Commission detail sub-rows starting with **
    // Skip lines that are just headers or too short
    if (line.length < 8) return true;
    return false;
  }

  /**
   * Parse a foreign transaction line.
   * OCR output for foreign transactions typically contains:
   * date, merchant name + city, original amount ($), conversion date, exchange rate, commission, NIS charge
   *
   * We look for a date (DD/MM/YY) and amounts in the same line.
   */
  private parseForeignTransactionLine(line: string): ParsedTransaction | null {
    // Must have a date
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{2})(?!\d)/);
    if (!dateMatch) return null;

    const transactionDate = normalizeDate(dateMatch[1]);
    if (!transactionDate) return null;

    // Extract merchant name — typically English text between date and amounts
    const merchantMatch = line.match(
      /\d{2}\/\d{2}\/\d{2}\s+\d?\s*([\w\s.*/'",()-]+?)(?=\s+-?[\d,.]+\s*[$€£]|\s+[\d,.]+\s*[$€£])/i,
    );
    let counterpartyName = merchantMatch ? merchantMatch[1].trim() : '';

    // If no merchant found, try extracting any English text block
    if (!counterpartyName) {
      const englishBlock = line.match(/([A-Z][A-Z\s.*/'",()-]{3,})/);
      counterpartyName = englishBlock ? englishBlock[1].trim() : 'Unknown';
    }

    // Extract original foreign amount (with $ or € sign)
    const foreignAmountMatch = line.match(/(-?[\d,.]+)\s*[$€£]/);
    const amountForeign = foreignAmountMatch
      ? Math.abs(normalizeNumber(foreignAmountMatch[1]) ?? 0) || undefined
      : undefined;

    // Detect currency from symbol
    const currencySymbol = foreignAmountMatch?.[0]?.slice(-1);
    const foreignCurrency = currencySymbol === '€' ? 'EUR' : currencySymbol === '£' ? 'GBP' : 'USD';

    // Extract exchange rate (decimal number like 3.1820). Parsed with
    // Number.parseFloat rather than normalizeNumber: the capture group
    // already guarantees a single-dot decimal shape, and normalizeNumber's
    // thousands-grouping heuristic (for currency amounts like "1.234" KZT)
    // would misread a 3-digit rate such as "3.182" as 3182.
    const rateMatch = line.match(/\b(\d\.\d{3,5})\b/);
    const exchangeRate = rateMatch ? Number.parseFloat(rateMatch[1]) : undefined;

    // Extract NIS charge — typically the last number or a negative number at end
    const allAmounts = Array.from(line.matchAll(/-?[\d,]+\.\d{2}/g)).map(m => m[0]);
    let nisCharge: number | null = null;
    if (allAmounts.length > 0) {
      // The NIS charge is usually the last large amount
      nisCharge = normalizeNumber(allAmounts[allAmounts.length - 1]);
    }

    // Determine debit vs credit
    let debit: number | undefined;
    let credit: number | undefined;
    if (nisCharge !== null) {
      if (nisCharge < 0) {
        credit = Math.abs(nisCharge);
      } else {
        debit = nisCharge;
      }
    }

    if (!(debit || credit)) return null;

    return {
      transactionDate,
      counterpartyName: counterpartyName || 'Unknown',
      debit,
      credit,
      paymentPurpose: counterpartyName || 'Foreign purchase',
      currency: 'ILS',
      amountForeign,
      exchangeRate,
    };
  }

  /**
   * Parse a domestic transaction line.
   * OCR output for domestic transactions typically contains:
   * date, card indicator, merchant name (Hebrew), category, amount, NIS charge, installment info
   */
  private parseDomesticTransactionLine(line: string): ParsedTransaction | null {
    // Must have a date
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{2})(?!\d)/);
    if (!dateMatch) return null;

    const transactionDate = normalizeDate(dateMatch[1]);
    if (!transactionDate) return null;

    // Extract amounts — look for numbers with decimals. A leading minus
    // marks a refund/credit (e.g. a returned purchase), same as the foreign
    // line parser's amount regex just above.
    const amounts = Array.from(line.matchAll(/(-?[\d,]+\.\d{2})/g)).map(m => normalizeNumber(m[1]));

    if (amounts.length === 0) return null;

    // The charge in NIS is typically the last amount for domestic transactions
    // If there are 2+ amounts, the larger one is the transaction amount,
    // the smaller one might be the installment charge
    let debit: number | undefined;
    let credit: number | undefined;
    const lastAmount = amounts[amounts.length - 1];
    if (lastAmount) {
      if (lastAmount < 0) {
        credit = Math.abs(lastAmount);
      } else {
        debit = lastAmount;
      }
    }

    if (!(debit || credit)) return null;

    // Extract merchant name — Hebrew text block
    // Remove the date and amounts, what remains is merchant + category
    let remaining = line
      .replace(/\d{2}\/\d{2}\/\d{2}/g, '')
      .replace(/-?[\d,]+\.\d{2}/g, '')
      .trim();

    // Extract installment info
    let installmentInfo = '';
    const installmentMatch = remaining.match(/תשלום\s+(\d+)\s+מתוך\s+(\d+)/);
    if (installmentMatch) {
      installmentInfo = installmentMatch[0];
      remaining = remaining.replace(installmentMatch[0], '').trim();
    }

    // Clean up remaining text for merchant name
    const counterpartyName = this.cleanMerchantName(remaining);

    const paymentPurpose = [counterpartyName, installmentInfo].filter(Boolean).join(' | ');

    return {
      transactionDate,
      counterpartyName: counterpartyName || 'Unknown',
      debit,
      credit,
      paymentPurpose: paymentPurpose || 'Domestic purchase',
      currency: 'ILS',
    };
  }

  private cleanMerchantName(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.|/-]+/, '')
      .replace(/[\s,.|/-]+$/, '')
      .trim();
  }
}
