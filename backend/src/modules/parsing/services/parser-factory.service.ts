import { Injectable, Logger } from '@nestjs/common';
import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { IParser } from '../interfaces/parser.interface';
import { BerekeNewParser } from '../parsers/bereke-new.parser';
import { BerekeOldParser } from '../parsers/bereke-old.parser';
import { Camt053Parser } from '../parsers/camt053.parser';
import { CsvParser } from '../parsers/csv.parser';
import { DocxParser } from '../parsers/docx.parser';
import { ExcelParser } from '../parsers/excel.parser';
import { GenericPdfParser } from '../parsers/generic-pdf.parser';
import { HapoalimParser } from '../parsers/hapoalim.parser';
import { KaspiParser } from '../parsers/kaspi.parser';
import { Mt940Parser } from '../parsers/mt940.parser';
import { OfxParser } from '../parsers/ofx.parser';
import { QifParser } from '../parsers/qif.parser';

@Injectable()
export class ParserFactoryService {
  private readonly logger = new Logger(ParserFactoryService.name);
  private parsers: IParser[] = [];

  constructor() {
    this.parsers = [
      new BerekeNewParser(),
      new BerekeOldParser(),
      new KaspiParser(),
      new HapoalimParser(),
      new GenericPdfParser(),
      new ExcelParser(),
      new CsvParser(),
      new DocxParser(),
      new OfxParser(),
      new QifParser(),
      new Camt053Parser(),
      new Mt940Parser(),
    ];
  }

  private extractHeaderText(text: string): string {
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    const headerLines: string[] = [];

    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];
      if (this.looksLikeTransaction(line)) {
        break;
      }
      headerLines.push(line);
    }

    if (!headerLines.length) {
      return lines.slice(0, Math.min(lines.length, 10)).join('\n');
    }

    return headerLines.join('\n');
  }

  private looksLikeTransaction(line: string): boolean {
    const hasDate = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(line);
    const hasAmount = /\d[\d\s.,]*\d/.test(line);
    return Boolean(hasDate && hasAmount);
  }

  private detectBankByName(text: string): {
    bank: 'kaspi' | 'bereke' | 'hapoalim' | null;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let bank: 'kaspi' | 'bereke' | 'hapoalim' | null = null;

    const kaspiRegex = /\b(kaspi\s+bank|kaspi\.kz|каспи\s+банк|каспи)(?!\s+business)\b/i;
    const berekeRegex = /\b(bereke\s+bank|bereke\s+business|береке\s+банк|береке)\b/i;
    const hapoalimRegex = /(בנק\s+הפועלים|hapoalim|bank\s+hapoalim|ישראכרט|isracard)/i;

    const kaspiIndex = text.search(kaspiRegex);
    const berekeIndex = text.search(berekeRegex);
    const hapoalimIndex = text.search(hapoalimRegex);

    const kaspiFound = kaspiIndex >= 0;
    const berekeFound = berekeIndex >= 0;
    const hapoalimFound = hapoalimIndex >= 0;

    if (kaspiFound) {
      evidence.push('name:kaspi');
    }
    if (berekeFound) {
      evidence.push('name:bereke');
    }
    if (hapoalimFound) {
      evidence.push('name:hapoalim');
    }

    if (hapoalimFound && !kaspiFound && !berekeFound) {
      bank = 'hapoalim';
    } else if (kaspiFound && berekeFound) {
      bank = kaspiIndex <= berekeIndex ? 'kaspi' : 'bereke';
      evidence.push('ambiguous:header-both');
    } else if (kaspiFound) {
      bank = 'kaspi';
    } else if (berekeFound) {
      bank = 'bereke';
    }

    return { bank, evidence };
  }

  private detectBankByBic(text: string): {
    bank: 'kaspi' | 'bereke' | 'hapoalim' | null;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let bank: 'kaspi' | 'bereke' | null = null;

    const kaspiRegex = /\bcaspkzka\b/i;
    const berekeRegex = /\bbrkekzka\b/i;

    const kaspiIndex = text.search(kaspiRegex);
    const berekeIndex = text.search(berekeRegex);

    const kaspiFound = kaspiIndex >= 0;
    const berekeFound = berekeIndex >= 0;

    if (kaspiFound) {
      evidence.push('bic:caspkzka');
    }
    if (berekeFound) {
      evidence.push('bic:brkekzka');
    }

    if (kaspiFound && berekeFound) {
      bank = kaspiIndex <= berekeIndex ? 'kaspi' : 'bereke';
      evidence.push('ambiguous:header-bic-both');
    } else if (kaspiFound) {
      bank = 'kaspi';
    } else if (berekeFound) {
      bank = 'bereke';
    }

    return { bank, evidence };
  }

  private collectBankMentions(text: string): string[] {
    const mentions: string[] = [];
    if (/\b(kaspi\s+bank|kaspi\.kz|каспи\s+банк|каспи)(?!\s+business)\b/i.test(text)) {
      mentions.push('Kaspi Bank');
    }
    if (/\b(bereke\s+bank|bereke\s+business|береке\s+банк|береке)\b/i.test(text)) {
      mentions.push('Bereke Bank');
    }
    if (/(בנק\s+הפועלים|hapoalim|bank\s+hapoalim|ישראכרט|isracard)/i.test(text)) {
      mentions.push('Bank Hapoalim');
    }
    return mentions;
  }

  async getParser(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<IParser | null> {
    this.logger.debug(`Looking for parser for bank: ${bankName}, fileType: ${fileType}`);
    for (const parser of this.parsers) {
      const parserName = parser.constructor.name;
      this.logger.debug(`Trying parser: ${parserName}`);
      if (await parser.canParse(bankName, fileType, filePath, cachedText)) {
        this.logger.debug(`Parser ${parserName} can parse this file`);
        return parser;
      }

      this.logger.debug(`Parser ${parserName} cannot parse this file`);
    }

    this.logger.debug(`No suitable parser found for bank: ${bankName}, fileType: ${fileType}`);
    return null;
  }

  async detectBankAndFormat(
    filePath: string,
    fileType: FileType,
    cachedText?: string,
  ): Promise<{
    bankName: BankName;
    formatVersion?: string;
    detectedBy?: string;
    detectedEvidence?: string[];
    otherBankMentions?: string[];
  }> {
    this.logger.debug(`Detecting bank and format for file: ${filePath}, type: ${fileType}`);

    // First, try to detect by file content for PDF files
    if (fileType === FileType.PDF) {
      try {
        const text = cachedText ?? (await extractTextFromPdf(filePath));
        const textLower = text.toLowerCase();
        const headerText = this.extractHeaderText(textLower);
        // The header is statement content — log its size, not the text.
        this.logger.debug(`Extracted header sample: ${headerText.length} chars`);

        const headerNameDetection = this.detectBankByName(headerText);
        const headerBicDetection = this.detectBankByBic(headerText);
        const fullNameDetection = this.detectBankByName(textLower);

        let detectedBy: string | undefined;
        let detectedEvidence: string[] = [];
        let detectedBase: 'kaspi' | 'bereke' | 'hapoalim' | null = null;

        if (headerNameDetection.bank) {
          detectedBase = headerNameDetection.bank;
          detectedBy = 'header-name';
          detectedEvidence = headerNameDetection.evidence;
        } else if (headerBicDetection.bank) {
          detectedBase = headerBicDetection.bank;
          detectedBy = 'header-bic';
          detectedEvidence = headerBicDetection.evidence;
        } else if (fullNameDetection.bank) {
          detectedBase = fullNameDetection.bank;
          detectedBy = 'full-text-name';
          detectedEvidence = fullNameDetection.evidence;
        }

        if (detectedBase === 'kaspi' && detectedBy === 'full-text-name') {
          const berekeByBic = this.detectBankByBic(textLower);
          if (berekeByBic.bank === 'bereke') {
            detectedBase = 'bereke';
            detectedBy = 'full-text-bic';
            detectedEvidence = berekeByBic.evidence;
          }
        }

        const headerMentions = this.collectBankMentions(headerText);
        const fullMentions = this.collectBankMentions(textLower);
        const detectedBankLabel =
          detectedBase === 'kaspi'
            ? 'Kaspi Bank'
            : detectedBase === 'bereke'
              ? 'Bereke Bank'
              : detectedBase === 'hapoalim'
                ? 'Bank Hapoalim'
                : null;

        const headerSet = new Set(headerMentions);
        const bodyMentions = fullMentions.filter(mention => !headerSet.has(mention));
        const otherBankMentions = bodyMentions.filter(mention =>
          detectedBankLabel ? mention !== detectedBankLabel : true,
        );

        if (headerMentions.length > 1 && detectedBankLabel) {
          headerMentions.forEach(mention => {
            if (mention !== detectedBankLabel && !otherBankMentions.includes(mention)) {
              otherBankMentions.push(mention);
            }
          });
        }

        if (detectedBase === 'hapoalim') {
          this.logger.debug(`Detected: Bank Hapoalim (${detectedBy || 'unknown'})`);
          return {
            bankName: BankName.HAPOALIM,
            detectedBy,
            detectedEvidence,
            otherBankMentions: otherBankMentions.length ? otherBankMentions : undefined,
          };
        }

        if (detectedBase === 'kaspi') {
          this.logger.debug(`Detected: Kaspi Bank (${detectedBy || 'unknown'})`);
          return {
            bankName: BankName.KASPI,
            detectedBy,
            detectedEvidence,
            otherBankMentions: otherBankMentions.length ? otherBankMentions : undefined,
          };
        }

        if (detectedBase === 'bereke') {
          if (
            await new BerekeNewParser().canParse(BankName.BEREKE_NEW, fileType, filePath, textLower)
          ) {
            this.logger.debug('Detected: Bereke Bank (new format)');
            return {
              bankName: BankName.BEREKE_NEW,
              formatVersion: 'new',
              detectedBy,
              detectedEvidence,
              otherBankMentions: otherBankMentions.length ? otherBankMentions : undefined,
            };
          }
          if (
            await new BerekeOldParser().canParse(BankName.BEREKE_OLD, fileType, filePath, textLower)
          ) {
            this.logger.debug('Detected: Bereke Bank (old format)');
            return {
              bankName: BankName.BEREKE_OLD,
              formatVersion: 'old',
              detectedBy,
              detectedEvidence,
              otherBankMentions: otherBankMentions.length ? otherBankMentions : undefined,
            };
          }
          this.logger.debug('Detected: Bereke Bank (format unknown)');
          return {
            bankName: BankName.BEREKE_NEW,
            detectedBy,
            detectedEvidence,
            otherBankMentions: otherBankMentions.length ? otherBankMentions : undefined,
          };
        }
      } catch (error) {
        this.logger.error('Error reading file content:', error);
      }
    }

    // For IMAGE files with cached OCR text, try name-based detection
    if (fileType === FileType.IMAGE && cachedText) {
      const textLower = cachedText.toLowerCase();
      const nameDetection = this.detectBankByName(textLower);
      if (nameDetection.bank === 'hapoalim') {
        this.logger.debug('Detected: Bank Hapoalim (image-ocr-name)');
        return {
          bankName: BankName.HAPOALIM,
          detectedBy: 'image-ocr-name',
          detectedEvidence: nameDetection.evidence,
        };
      }
    }

    // Fallback: Try each parser to detect bank and format
    for (const parser of this.parsers) {
      const parserName = parser.constructor.name;
      this.logger.debug(`Checking parser: ${parserName}`);

      // Check Kaspi first
      if (
        parser instanceof KaspiParser &&
        (await parser.canParse(BankName.KASPI, fileType, filePath, cachedText))
      ) {
        this.logger.debug('Detected: Kaspi Bank');
        return { bankName: BankName.KASPI };
      }

      if (
        parser instanceof HapoalimParser &&
        (await parser.canParse(BankName.HAPOALIM, fileType, filePath, cachedText))
      ) {
        this.logger.debug('Detected: Bank Hapoalim');
        return { bankName: BankName.HAPOALIM };
      }

      // Only bank-specific parsers may claim a bank here: generic parsers
      // (Excel/CSV/DOCX/PDF) ignore bankName in canParse and would mislabel
      // every spreadsheet as Bereke.
      if (
        parser instanceof BerekeNewParser &&
        (await parser.canParse(BankName.BEREKE_NEW, fileType, filePath, cachedText))
      ) {
        this.logger.debug('Detected: Bereke Bank (new format)');
        return { bankName: BankName.BEREKE_NEW, formatVersion: 'new' };
      }
      if (
        parser instanceof BerekeOldParser &&
        (await parser.canParse(BankName.BEREKE_OLD, fileType, filePath, cachedText))
      ) {
        this.logger.debug('Detected: Bereke Bank (old format)');
        return { bankName: BankName.BEREKE_OLD, formatVersion: 'old' };
      }
    }

    // Default to other if can't detect
    this.logger.debug('Could not detect bank, defaulting to OTHER');
    return { bankName: BankName.OTHER };
  }
}
