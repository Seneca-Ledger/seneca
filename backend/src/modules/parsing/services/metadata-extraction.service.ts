import { Injectable, Logger } from '@nestjs/common';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { ExtractedMetadata as EnhancedExtractedMetadata } from '../interfaces/enhanced-parsed-statement.interface';
import { ParsedStatementMetadata } from '../interfaces/parsed-statement.interface';

export interface ExtractedMetadata extends EnhancedExtractedMetadata {
  period: {
    dateFrom: Date;
    dateTo: Date;
    label: string;
  };
  account: {
    number: string;
    name?: string;
    type?: string;
  };
  currency: {
    code: string;
    symbol?: string;
  };
  institution: {
    name: string;
    branch?: string;
    bic?: string;
    country?: string;
    locale?: string;
  };
  additionalInfo: {
    [key: string]: unknown;
  };
}

type PatternExtractionResult =
  | null
  | { type: string; source: string }
  | ExtractedMetadata['period']
  | ExtractedMetadata['account']
  | ExtractedMetadata['currency']
  | ExtractedMetadata['institution'];

type StructuredDataRow = unknown[];

interface HeaderInfo {
  title?: string;
  subtitle?: string;
  documentType?: string;
  language: string;
  locale: string;
}

interface DisplayInfo {
  title: string;
  subtitle: string;
  periodDisplay?: string;
  accountDisplay?: string;
  institutionDisplay: string;
  currencyDisplay?: string;
}

export interface HeaderPattern {
  type: 'statement_type' | 'period' | 'account' | 'currency' | 'institution';
  patterns: RegExp[];
  languages: string[];
  priority: number;
  extractor: (match: RegExpMatchArray) => PatternExtractionResult;
}

export interface InstitutionProfile {
  name: string;
  patterns: string[];
  defaultCurrency: string;
  country: string;
  locale: string;
}

@Injectable()
export class MetadataExtractionService {
  private readonly logger = new Logger(MetadataExtractionService.name);

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  // Language patterns for different metadata types
  private readonly headerPatterns: HeaderPattern[] = [
    // Statement type patterns
    {
      type: 'statement_type',
      patterns: [
        /\b(?:выписка|statement|распечатка|extract|отчет|report)\b/gi,
        /\b(?:по счету|for account|счет|account)\b/gi,
        /\b(?:движение средств|transaction history|операции|operations)\b/gi,
      ],
      languages: ['ru', 'en', 'kk'],
      priority: 1,
      extractor: match => ({ type: 'statement', source: match[0] }),
    },

    // Period patterns - comprehensive date range detection
    {
      type: 'period',
      patterns: [
        // Russian patterns
        /\b(?:за период|период|c|с|по|от)\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\s*(?:по|до|по)\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\b/gi,
        /\b(?:с|c)\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\s*по\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\b/gi,

        // English patterns
        /\b(?:period|from|to)\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\s*(?:to|till|-)\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\b/gi,
        /\b(?:between|and)\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\s*(?:and|-)\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\b/gi,

        // Kazakh patterns
        /\b(?:кезең|кезеңі|бері|дейін)\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\s*(?:дейін|кеңі|-\s*)(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\b/gi,

        // Standard date range format
        /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\s*[-–—]\s*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/g,

        // Month-year range
        /\b(?:январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi,
      ],
      languages: ['ru', 'en', 'kk'],
      priority: 2,
      extractor: match => {
        const dateStr1 = match[1] || match[0];
        const dateStr2 = match[2] || null;

        if (dateStr2) {
          return {
            dateFrom: this.parseDate(dateStr1),
            dateTo: this.parseDate(dateStr2),
            label: `${dateStr1} - ${dateStr2}`,
          };
        }

        return null;
      },
    },

    // Account number patterns
    {
      type: 'account',
      patterns: [
        // Russian account patterns
        /\b(?:счет|номер счета|аккаунт|account №?|р\/с|расчетный счет)\s*[:#]?\s*(\w[\w\s\d-]{10,30})\b/gi,
        /\b(?:(?:ИИК|IBAN)\s*[:#]?\s*)?([A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16})\b/gi,
        /\b(\d{16,20})\b/g, // Long numbers that could be account numbers

        // Kazakh patterns
        /\b(?:шот|нөмірі|іік)\s*[:#]?\s*(\w[\w\s\d-]{10,30})\b/gi,
        /\b(KZ\d{3}[A-Z0-9]{13})\b/g, // Kazakh IBAN
      ],
      languages: ['ru', 'en', 'kk'],
      priority: 3,
      extractor: match => {
        const accountNumber = match[1] || match[0];
        return {
          number: accountNumber.replace(/\s+/g, '').trim(),
          type: this.detectAccountType(accountNumber),
        };
      },
    },

    // Currency patterns
    {
      type: 'currency',
      patterns: [
        // ISO currency codes
        /\b(KZT|USD|EUR|RUB|GBP|CNY|JPY|CHF|CAD|AUD|NZD|SGD|HKD|SEK|NOK|DKK|PLN|CZK|HUF|RON|BGN|HRK|TRY|ILS|INR|KRW|THB|MYR|PHP|IDR|VND|MXN|BRL|ARS|CLP|COP|PEN|UYU|ZAR|EGP|SAR|AED)\b/g,

        // Currency symbols with amounts (contextual)
        /\b(?:\d[\d\s.,]*)(?:₽|\$|€|£|¥|₸|₴|₼|₺|₪|₹|₩|฿|₱|₫|RM|R\$|U\$|MEX\$|S\/|\$U|R)\b/g,

        // Currency names in different languages
        /\b(?:тенге|доллар|евро|рубль|фунт|юань|иена|франк|манат|дирхам|рупия|вона|бат|песо|реал|лари|манат|ларі|сомони|лэк|злотый|крона|крона|крона|форинт|лей|лев|динар|драм|тугрик|сум)\b/gi,
      ],
      languages: ['ru', 'en', 'kk', 'de', 'fr', 'es', 'it', 'pt', 'tr', 'ar', 'zh', 'ja', 'ko'],
      priority: 4,
      extractor: match => {
        const code = match[1] || match[0];
        const currency = this.mapCurrencyCode(code);
        return {
          code: currency.code,
          symbol: currency.symbol,
        };
      },
    },

    // Institution patterns
    {
      type: 'institution',
      patterns: [
        // Bank names with common variations
        /\b(?:АО|ТОО|АКБ|НБ|ЦБ)\s+["«]?([^"»\n]{3,50})["»]?\b/gi,
        /\b((?:БАНК|BANK|КАЗКОМЕРЦБАНК|KAZKOMERTSBANK|Halyk Bank|Народный Банк|Банк ЦентрКредит|АТФБанк|Евразийский Банк|Каспи Банк|Береке Банк|Жилстройсбербанк|Альфа-Банк|ВТБ|Райффайзенбанк|Открытие|Газпромбанк|МКБ|БИНБАНК|Промсвязьбанк|Россельхозбанк|Альфа-Банк|Тинькофф|Ситибанк|Киви|QIWI|ЮMoney|ЮМани))\b/gi,

        // International banks
        /\b((?:JPMorgan Chase|Bank of America|Wells Fargo|Citibank|HSBC|Barclays|Deutsche Bank|BNP Paribas|Crédit Agricole|Santander|ING|UBS|Credit Suisse|Goldman Sachs|Morgan Stanley|Standard Chartered|Bank of China|ICBC|China Construction Bank|Agricultural Bank of China|Bank of Communications|MUFG|SMBC|Mizuho|Sumitomo Mitsui|Norinchukin|Resona|Shinsei|Seven Bank|Japan Post Bank|KB Kookmin|Shinhan|WOORI|Hana|Nonghyup|KB Kookmin|Shinhan|Industrial Bank of Korea|KDB Development Bank|Export-Import Bank of Korea|Standard Chartered Korea|Citibank Korea|HSBC Korea|Deutsche Bank Korea|BNP Paribas Korea|ING Korea|UBS Korea|Credit Suisse Korea|Goldman Sachs Korea|Morgan Stanley Korea))\b/gi,

        // Branch/office information
        /\b(?:филиал|branch|отделение|office)\s*[:#]?\s*([^,\n]{3,50})\b/gi,
        /\b(?:БИК|BIC|SWIFT|BIC)\s*[:#]?\s*([A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?)\b/gi,
      ],
      languages: ['ru', 'en', 'kk'],
      priority: 5,
      extractor: match => {
        const name = match[1] || match[0];
        return {
          name: name.trim(),
          branch: this.extractBranchInfo(match.input, name),
        };
      },
    },
  ];

  // Institution profiles for better recognition
  private readonly institutionProfiles: InstitutionProfile[] = [
    {
      name: 'Kazkommertsbank',
      patterns: ['казкоммерцбанк', 'kazkomertsbank', 'kkb'],
      defaultCurrency: 'KZT',
      country: 'KZ',
      locale: 'ru',
    },
    {
      name: 'Halyk Bank',
      patterns: ['народный банк', 'halyk bank', 'halyk', 'народный'],
      defaultCurrency: 'KZT',
      country: 'KZ',
      locale: 'ru',
    },
    {
      name: 'Bank CenterCredit',
      patterns: ['банк центркредит', 'bank centercredit', 'центркредит', 'bcc'],
      defaultCurrency: 'KZT',
      country: 'KZ',
      locale: 'ru',
    },
    {
      name: 'ATFBank',
      patterns: ['атфбанк', 'atfbank', 'а т ф'],
      defaultCurrency: 'KZT',
      country: 'KZ',
      locale: 'ru',
    },
    {
      name: 'Eurasian Bank',
      patterns: ['евразийский банк', 'eurasian bank', 'евразийский'],
      defaultCurrency: 'KZT',
      country: 'KZ',
      locale: 'ru',
    },
    {
      name: 'Kaspi Bank',
      patterns: ['каспи банк', 'kaspi bank', 'каспи'],
      defaultCurrency: 'KZT',
      country: 'KZ',
      locale: 'ru',
    },
    {
      name: 'Bereke Bank',
      patterns: ['береке банк', 'bereke bank', 'береке'],
      defaultCurrency: 'KZT',
      country: 'KZ',
      locale: 'ru',
    },
    {
      name: 'Alfa-Bank',
      patterns: ['альфа-банк', 'alfa-bank', 'альфа'],
      defaultCurrency: 'RUB',
      country: 'RU',
      locale: 'ru',
    },
    {
      name: 'Tinkoff',
      patterns: ['тинькофф', 'tinkoff', 'тинькофф банк'],
      defaultCurrency: 'RUB',
      country: 'RU',
      locale: 'ru',
    },
  ];

  async extractMetadata(rawText: string, locale?: string): Promise<ExtractedMetadata> {
    this.logger.log('Starting metadata extraction');

    const cleanedText = this.preprocessText(rawText);
    const metadata: Partial<ExtractedMetadata> = {
      rawHeader: this.extractHeaderSection(cleanedText),
      additionalInfo: {},
      confidence: 0,
      extractionMethod: 'hybrid',
    };

    // Extract different types of metadata
    for (const pattern of this.headerPatterns) {
      if (locale && !pattern.languages.includes(locale)) {
        continue; // Skip patterns not matching the detected locale
      }

      try {
        const result = this.extractByPattern(cleanedText, pattern);
        if (result) {
          this.mergeExtractionResult(metadata, pattern.type, result);
          metadata.confidence = Math.min(1, (metadata.confidence || 0) + pattern.priority * 0.1);
        }
      } catch (error) {
        this.logger.warn(`Failed to extract ${pattern.type}: ${this.getErrorMessage(error)}`);
      }
    }

    // Post-processing and normalization
    metadata.normalizedHeader = this.normalizeHeader(metadata.rawHeader || '');

    // Extract enhanced header information
    metadata.headerInfo = this.extractHeaderInfo(metadata, locale);

    // Determine extraction method based on confidence
    if (metadata.confidence > 0.8) {
      metadata.extractionMethod = 'regex';
    } else if (metadata.confidence > 0.5) {
      metadata.extractionMethod = 'heuristic';
    } else {
      metadata.extractionMethod = 'ml'; // Would use ML in production
    }

    // Fill in missing information with defaults
    this.fillMissingMetadata(metadata, locale);

    this.logger.log(
      `Metadata extraction completed with confidence: ${(metadata.confidence || 0).toFixed(2)}`,
    );

    return metadata as ExtractedMetadata;
  }

  private preprocessText(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private extractHeaderSection(text: string): string {
    // Extract first few lines that typically contain header information
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const headerLines: string[] = [];

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i].trim();

      // Stop if we encounter transaction-like data
      if (this.looksLikeTransaction(line)) {
        break;
      }

      headerLines.push(line);
    }

    return headerLines.join('\n');
  }

  private looksLikeTransaction(line: string): boolean {
    // Check if line looks like a transaction row
    const hasDate = /\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}/.test(line);
    const hasAmount = /\d[\d\s.,]*\d/.test(line);
    const hasAccountNumber = /\d{10,}/.test(line);

    return Boolean((hasDate && hasAmount) || hasAccountNumber);
  }

  private extractByPattern(text: string, pattern: HeaderPattern): PatternExtractionResult {
    for (const regex of pattern.patterns) {
      regex.lastIndex = 0; // Reset regex state
      const match = regex.exec(text);
      if (match) {
        return pattern.extractor(match);
      }
    }
    return null;
  }

  private mergeExtractionResult(
    metadata: Partial<ExtractedMetadata>,
    type: HeaderPattern['type'],
    result: PatternExtractionResult,
  ): void {
    switch (type) {
      case 'statement_type':
        if (result && 'type' in result) {
          metadata.statementType = result.type;
        }
        break;
      case 'period':
        if (result && 'dateFrom' in result) {
          metadata.period = result;
        }
        break;
      case 'account':
        if (result && 'number' in result) {
          metadata.account = { ...metadata.account, ...result };
        }
        break;
      case 'currency':
        if (result && 'code' in result) {
          metadata.currency = { ...metadata.currency, ...result };
        }
        break;
      case 'institution':
        if (result && 'name' in result) {
          metadata.institution = { ...metadata.institution, ...result };
        }
        break;
    }
  }

  private normalizeHeader(rawHeader: string): string {
    return rawHeader
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sа-яёәғқңөұүіһӌў.,-]/gi, '')
      .trim();
  }

  private fillMissingMetadata(metadata: Partial<ExtractedMetadata>, locale?: string): void {
    // Set defaults if not extracted
    if (!metadata.currency && metadata.institution) {
      const profile = this.findInstitutionProfile(metadata.institution.name);
      if (profile) {
        metadata.currency = {
          code: profile.defaultCurrency,
        };
        metadata.institution = {
          ...metadata.institution,
          country: profile.country,
          locale: profile.locale,
        };
      }
    }

    // Default currency
    if (!metadata.currency) {
      metadata.currency = {
        code: locale === 'ru' ? 'RUB' : appDefaultCurrency(),
      };
    }

    // Default period if not found
    if (!metadata.period) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      metadata.period = {
        dateFrom: firstDay,
        dateTo: now,
        label: `${firstDay.toISOString().split('T')[0]} - ${now.toISOString().split('T')[0]}`,
      };
    }

    // Default statement type
    if (!metadata.statementType) {
      metadata.statementType = 'statement';
    }

    // Ensure minimum confidence
    metadata.confidence = Math.max(0.3, metadata.confidence || 0);
  }

  private findInstitutionProfile(name: string): InstitutionProfile | undefined {
    const normalizedName = name.toLowerCase().trim();

    return this.institutionProfiles.find(profile =>
      profile.patterns.some(pattern => normalizedName.includes(pattern.toLowerCase())),
    );
  }

  private extractBranchInfo(text: string, bankName: string): string | undefined {
    // Try to extract branch information from the context
    const branchPatterns = [
      new RegExp(`${bankName}[^,\\n]*,\\s*([^,\\n]{3,50})\\b`, 'i'),
      /\b(?:филиал|branch|отделение|office)\s*[:#]?\s*([^,\n]{3,50})\b/gi,
    ];

    for (const pattern of branchPatterns) {
      const match = pattern.exec(text);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private detectAccountType(accountNumber: string): string {
    const normalized = accountNumber.replace(/\s/g, '').toUpperCase();

    if (normalized.startsWith('KZ') || normalized.length === 20) {
      return 'IBAN';
    }
    if (normalized.match(/^\d{16,20}$/)) {
      return 'ACCOUNT';
    }
    if (normalized.match(/^\d{12}$/)) {
      return 'BIN';
    }

    return 'UNKNOWN';
  }

  private parseDate(dateStr: string): Date {
    // Try to parse date in various formats
    const formats = [
      // DD.MM.YYYY
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      // DD/MM/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // YYYY-MM-DD
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
      // MM/DD/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let year: string;
        let month: string;
        let day: string;
        if (format.source.includes('^\\d{4}')) {
          [, year, month, day] = match;
        } else {
          [, day, month, year] = match;
        }
        return new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day));
      }
    }

    // Fallback
    return new Date(dateStr);
  }

  private mapCurrencyCode(code: string): { code: string; symbol?: string } {
    const currencyMap: { [key: string]: { code: string; symbol?: string } } = {
      // ISO codes
      KZT: { code: 'KZT', symbol: '₸' },
      USD: { code: 'USD', symbol: '$' },
      EUR: { code: 'EUR', symbol: '€' },
      RUB: { code: 'RUB', symbol: '₽' },
      GBP: { code: 'GBP', symbol: '£' },
      CNY: { code: 'CNY', symbol: '¥' },

      // Symbols
      '₽': { code: 'RUB', symbol: '₽' },
      $: { code: 'USD', symbol: '$' },
      '€': { code: 'EUR', symbol: '€' },
      '£': { code: 'GBP', symbol: '£' },
      '¥': { code: 'CNY', symbol: '¥' },
      '₸': { code: 'KZT', symbol: '₸' },

      // Names (Russian)
      тенге: { code: 'KZT', symbol: '₸' },
      доллар: { code: 'USD', symbol: '$' },
      евро: { code: 'EUR', symbol: '€' },
      рубль: { code: 'RUB', symbol: '₽' },
    };

    return currencyMap[code.toUpperCase()] || { code: 'USD' };
  }

  // Method to add custom patterns
  addCustomPattern(pattern: HeaderPattern): void {
    this.headerPatterns.push(pattern);
    this.logger.log(`Added custom pattern for ${pattern.type}`);
  }

  // Method to add institution profile
  addInstitutionProfile(profile: InstitutionProfile): void {
    this.institutionProfiles.push(profile);
    this.logger.log(`Added institution profile: ${profile.name}`);
  }

  // Method to extract metadata from structured data (like parsed PDF tables)
  async extractMetadataFromStructuredData(
    data: StructuredDataRow[],
    _locale?: string,
  ): Promise<Partial<ExtractedMetadata>> {
    // Implementation for structured data extraction
    // This would analyze headers, first rows, and summary rows
    const metadata: Partial<ExtractedMetadata> = {
      additionalInfo: {},
    };

    // Look for header rows
    const headerRow = data.find(row =>
      row.some(cell => /(?:дата|date|сумма|amount|назначение|purpose)/i.test(String(cell))),
    );

    if (headerRow) {
      metadata.rawHeader = headerRow.join(' ');
    }

    return metadata;
  }

  private extractHeaderInfo(metadata: Partial<ExtractedMetadata>, locale?: string): HeaderInfo {
    const headerInfo: HeaderInfo = {
      language: locale || this.detectLanguage(metadata.rawHeader || ''),
      locale: locale || this.getDefaultLocale(metadata),
    };

    // Extract title and subtitle from raw header
    if (metadata.rawHeader) {
      const headerLines = metadata.rawHeader.split('\n').filter(line => line.trim().length > 0);

      // First non-empty line is usually the title
      if (headerLines.length > 0) {
        headerInfo.title = this.cleanTitle(headerLines[0]);
      }

      // Second line might be subtitle
      if (headerLines.length > 1) {
        const potentialSubtitle = headerLines[1].trim();
        if (!this.looksLikeTransaction(potentialSubtitle)) {
          headerInfo.subtitle = this.cleanTitle(potentialSubtitle);
        }
      }
    }

    // Determine document type
    headerInfo.documentType = metadata.statementType || this.determineDocumentType(metadata);

    return headerInfo;
  }

  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    const russianChars = (text.match(/[а-яё]/gi) || []).length;
    const kazakhChars = (text.match(/[әғқңөұүіһ]/gi) || []).length;
    const englishChars = (text.match(/[a-z]/gi) || []).length;
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars === 0) {
      return 'en';
    }

    const russianRatio = russianChars / totalChars;
    const kazakhRatio = kazakhChars / totalChars;
    const englishRatio = englishChars / totalChars;

    if (kazakhRatio > 0.1) {
      return 'kk';
    }
    if (russianRatio > 0.3) {
      return 'ru';
    }
    if (englishRatio > 0.5) {
      return 'en';
    }

    return 'en'; // fallback
  }

  private getDefaultLocale(metadata: Partial<ExtractedMetadata>): string {
    if (metadata.institution?.locale) {
      return metadata.institution.locale;
    }
    if (metadata.institution?.country === 'KZ') {
      return 'ru';
    }
    if (metadata.institution?.country === 'RU') {
      return 'ru';
    }
    return 'en';
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/^\s*[-•*]\s*/, '') // Remove bullet points
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sа-яёәғқңөұүіһ.,-]/gi, '')
      .trim();
  }

  private determineDocumentType(metadata: Partial<ExtractedMetadata>): string {
    const rawHeader = (metadata.rawHeader || '').toLowerCase();

    if (rawHeader.includes('выписка') || rawHeader.includes('statement')) {
      return 'statement';
    }
    if (rawHeader.includes('отчет') || rawHeader.includes('report')) {
      return 'report';
    }
    if (rawHeader.includes('справка') || rawHeader.includes('certificate')) {
      return 'certificate';
    }
    if (rawHeader.includes('движение') || rawHeader.includes('history')) {
      return 'history';
    }

    return 'statement'; // default
  }

  // Method to create display information for UI
  createDisplayInfo(metadata: ExtractedMetadata): DisplayInfo {
    const display: DisplayInfo = {
      title: '',
      subtitle: '',
      institutionDisplay: '',
    };

    // Title display
    display.title = metadata.headerInfo?.title || metadata.normalizedHeader || 'Выписка по счету';

    // Subtitle display
    display.subtitle = metadata.headerInfo?.subtitle || '';

    // Period display
    if (metadata.period) {
      display.periodDisplay =
        metadata.period.label ||
        `${this.formatDate(metadata.period.dateFrom)} - ${this.formatDate(metadata.period.dateTo)}`;
    }

    // Account display
    if (metadata.account) {
      display.accountDisplay = this.maskAccountNumber(metadata.account.number);
      if (metadata.account.name) {
        display.accountDisplay += ` (${metadata.account.name})`;
      }
    }

    // Institution display
    display.institutionDisplay = metadata.institution?.name || '';
    if (metadata.institution?.branch) {
      display.institutionDisplay += `, ${metadata.institution.branch}`;
    }

    // Currency display
    if (metadata.currency) {
      display.currencyDisplay = metadata.currency.symbol || metadata.currency.code;
    }

    return display;
  }

  private maskAccountNumber(accountNumber: string): string {
    const normalized = accountNumber.replace(/\s/g, '');
    if (normalized.length > 8) {
      return `****${normalized.slice(-4)}`;
    }
    return accountNumber;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Method to convert ExtractedMetadata to ParsedStatementMetadata
  convertToParsedStatementMetadata(extracted: ExtractedMetadata): ParsedStatementMetadata {
    const displayInfo = this.createDisplayInfo(extracted);

    return {
      accountNumber: extracted.account?.number || '',
      dateFrom: extracted.period?.dateFrom || new Date(),
      dateTo: extracted.period?.dateTo || new Date(),
      currency: extracted.currency?.code || appDefaultCurrency(),
      rawHeader: extracted.rawHeader,
      normalizedHeader: extracted.normalizedHeader,
      periodLabel: extracted.period?.label,
      institution: extracted.institution?.name,
      locale: extracted.headerInfo?.locale,
      headerDisplay: {
        title: displayInfo.title,
        subtitle: displayInfo.subtitle,
        periodDisplay: displayInfo.periodDisplay,
        accountDisplay: displayInfo.accountDisplay,
        institutionDisplay: displayInfo.institutionDisplay,
        currencyDisplay: displayInfo.currencyDisplay,
      },
    };
  }
}
