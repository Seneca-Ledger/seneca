import { Injectable, Logger } from '@nestjs/common';

export interface TextCleaningResult {
  cleanedText: string;
  originalText: string;
  changes: string[];
  confidence: number;
}

export interface CleaningRule {
  pattern: RegExp;
  replacement: string;
  description: string;
  priority: number;
}

@Injectable()
export class TextCleaningService {
  private readonly logger = new Logger(TextCleaningService.name);

  // Common junk patterns in multiple languages
  private readonly cleaningRules: CleaningRule[] = [
    // Empty/null indicators
    {
      pattern: /^(n\/a|na|none|null|---|\.\.\.|—|–)$/gi,
      replacement: '',
      description: 'Remove null indicators',
      priority: 1,
    },
    {
      pattern: /^(не указано|неизвестно|пусто|—)$/gi,
      replacement: '',
      description: 'Remove Russian null indicators',
      priority: 1,
    },
    {
      pattern: /^(көрсетілмеген|белгісіз|бос)$/gi,
      replacement: '',
      description: 'Remove Kazakh null indicators',
      priority: 1,
    },

    // Service information patterns
    {
      pattern: /\b\d{2,4}-\d{2}-\d{2}\b/g,
      replacement: '',
      description: 'Remove date patterns from text',
      priority: 2,
    },
    {
      pattern: /\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
      replacement: '',
      description: 'Remove time patterns',
      priority: 2,
    },
    {
      pattern: /\b[A-Z]{2,4}\d{6,10}\b/g,
      replacement: '',
      description: 'Remove document numbers',
      priority: 2,
    },
    {
      pattern: /\b\d{10,16}\b/g,
      replacement: '',
      description: 'Remove long numbers (possibly account numbers)',
      priority: 2,
    },

    // Multiple spaces and special characters
    { pattern: /\s+/g, replacement: ' ', description: 'Normalize multiple spaces', priority: 3 },
    {
      pattern: /[^\w\sа-яёәғқңөұүіһӌўғқӊҳҷ]/gi,
      replacement: ' ',
      description: 'Replace special chars with space',
      priority: 3,
    },
    { pattern: /^\s+|\s+$/g, replacement: '', description: 'Trim whitespace', priority: 4 },
    {
      pattern: /\s+[,.!?;:]+\s*/g,
      replacement: '. ',
      description: 'Normalize punctuation',
      priority: 4,
    },

    // Common bank service text
    {
      pattern:
        /\b(банк|bank|банкінің|bank's)\s+\w+\s+(операция|operation|транзакция|transaction)\b/gi,
      replacement: '',
      description: 'Remove bank operation labels',
      priority: 5,
    },
    {
      pattern: /\b(перевод|transfer|платеж|payment|пополнение|deposit|снятие|withdrawal)\b/gi,
      replacement: '',
      description: 'Remove transaction type labels',
      priority: 5,
    },

    // Repetitive characters
    {
      pattern: /(.)\1{3,}/g,
      replacement: '$1',
      description: 'Remove repeated characters',
      priority: 6,
    },

    // Service codes
    {
      pattern: /\b[A-Z]{1,3}\d{1,6}\b/g,
      replacement: '',
      description: 'Remove service codes',
      priority: 7,
    },

    // URL/Email patterns (shouldn't be in transaction details)
    { pattern: /https?:\/\/[^\s]+/g, replacement: '', description: 'Remove URLs', priority: 8 },
    {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '',
      description: 'Remove emails',
      priority: 8,
    },

    // Phone numbers
    {
      pattern: /\+?\d{1,3}?[-.\s]?\(?[0-9]{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
      replacement: '',
      description: 'Remove phone numbers',
      priority: 9,
    },
  ];

  // Language-specific stop words
  private readonly stopWords: Record<string, string[]> = {
    en: [
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'payment',
      'transaction',
      'transfer',
      'deposit',
      'withdrawal',
      'fee',
      'charge',
      'purchase',
      'refund',
      'credit',
      'debit',
    ],
    ru: [
      'и',
      'в',
      'на',
      'с',
      'по',
      'для',
      'от',
      'до',
      'к',
      'у',
      'за',
      'через',
      'или',
      'но',
      'а',
      'же',
      'бы',
      'ли',
      'что',
      'кто',
      'платеж',
      'транзакция',
      'перевод',
      'пополнение',
      'снятие',
      'комиссия',
      'покупка',
      'возврат',
      'кредит',
      'дебет',
    ],
    kk: [
      'және',
      'мен',
      'үшін',
      'нен',
      'дейін',
      'арқылы',
      'немесе',
      'бірақ',
      'ал',
      'де',
      'тіпті',
      'болмаса',
      'себебі',
      'сондықтан',
      'төлем',
      'операция',
      'аударым',
      'толықтыру',
      'алу',
      'комиссия',
      'сатып алу',
      'қайтару',
      'несие',
      'дебет',
    ],
  };

  async cleanText(text: string, locale?: string): Promise<TextCleaningResult> {
    if (!text || typeof text !== 'string') {
      return {
        cleanedText: '',
        originalText: text || '',
        changes: ['Input was empty or not a string'],
        confidence: 0,
      };
    }

    let cleanedText = text;
    const changes: string[] = [];
    let totalConfidence = 1.0;

    // Apply cleaning rules in priority order
    const sortedRules = [...this.cleaningRules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      const originalText = cleanedText;
      cleanedText = cleanedText.replace(rule.pattern, rule.replacement);

      if (originalText !== cleanedText) {
        changes.push(rule.description);
        // Reduce confidence based on rule priority
        totalConfidence *= 1 - rule.priority * 0.05;
      }
    }

    // Remove language-specific stop words
    if (locale && this.stopWords[locale]) {
      const stopWords = this.stopWords[locale];
      const words = cleanedText.split(/\s+/);
      const filteredWords = words.filter(
        word => !stopWords.includes(word.toLowerCase()) && word.length > 1,
      );

      if (filteredWords.length !== words.length) {
        cleanedText = filteredWords.join(' ');
        changes.push(`Removed ${words.length - filteredWords.length} stop words (${locale})`);
        totalConfidence *= 0.9;
      }
    }

    // Final cleanup
    cleanedText = cleanedText.trim();
    if (cleanedText.length === 0) {
      changes.push('Text became empty after cleaning');
      return {
        cleanedText: '',
        originalText: text,
        changes,
        confidence: 0.1,
      };
    }

    // Ensure the cleaned text is meaningful
    if (!this.isMeaningfulText(cleanedText, locale)) {
      changes.push('Text appears to be meaningless after cleaning');
      // Keep original if cleaning makes it meaningless
      return {
        cleanedText: text.trim(),
        originalText: text,
        changes,
        confidence: 0.3,
      };
    }

    return {
      cleanedText,
      originalText: text,
      changes,
      confidence: Math.max(0.1, Math.min(1.0, totalConfidence)),
    };
  }

  async cleanCounterpartyName(
    counterpartyName: string,
    locale?: string,
  ): Promise<TextCleaningResult> {
    const result = await this.cleanText(counterpartyName, locale);

    // Additional counterparty-specific cleaning
    let cleaned = result.cleanedText;
    const additionalChanges = [...result.changes];

    // Remove common suffixes/prefixes for counterparty names
    const patterns = [
      {
        pattern: /^(ИП|ТОО|АО|AО|ЖШ|МКК|ЧП|ФИО)\s+/i,
        replacement: '',
        description: 'Remove legal form prefixes',
      },
      {
        pattern: /\s+(ИП|ТОО|АО|AО|ЖШ|МКК|ЧП)\s*$/i,
        replacement: '',
        description: 'Remove legal form suffixes',
      },
      { pattern: /\s+(bank|банк|banki)\b/gi, replacement: '', description: 'Remove bank suffixes' },
      {
        pattern: /^(mr|mrs|ms|dr|prof)\s+/i,
        replacement: '',
        description: 'Remove title prefixes',
      },
    ];

    for (const pattern of patterns) {
      const before = cleaned;
      cleaned = cleaned.replace(pattern.pattern, pattern.replacement);
      if (before !== cleaned) {
        additionalChanges.push(pattern.description);
      }
    }

    // Capitalize first letter of each word for counterparty names
    cleaned = cleaned.replace(
      /\b\w+/g,
      word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    );

    return {
      cleanedText: cleaned.trim(),
      originalText: counterpartyName,
      changes: additionalChanges,
      confidence: result.confidence * 0.95,
    };
  }

  async cleanPaymentPurpose(paymentPurpose: string, locale?: string): Promise<TextCleaningResult> {
    const result = await this.cleanText(paymentPurpose, locale);

    // Additional payment purpose-specific cleaning
    let cleaned = result.cleanedText;
    const additionalChanges = [...result.changes];

    // Remove transaction type indicators
    const transactionPatterns = [
      {
        pattern: /\b(d|k|дебет|кредит|debit|credit)\s*:?\s*/gi,
        replacement: '',
        description: 'Remove debit/credit indicators',
      },
      {
        pattern: /\b(doc|документ|document)\s*[:#]?\s*\w*\b/gi,
        replacement: '',
        description: 'Remove document references',
      },
      {
        pattern: /\b(op|операция|operation)\s*[:#]?\s*\w*\b/gi,
        replacement: '',
        description: 'Remove operation references',
      },
    ];

    for (const pattern of transactionPatterns) {
      const before = cleaned;
      cleaned = cleaned.replace(pattern.pattern, pattern.replacement);
      if (before !== cleaned) {
        additionalChanges.push(pattern.description);
      }
    }

    // Ensure we have meaningful content
    if (cleaned.split(/\s+/).length < 2) {
      additionalChanges.push('Payment purpose too short, keeping original');
      cleaned = paymentPurpose.trim();
    }

    return {
      cleanedText: cleaned.trim(),
      originalText: paymentPurpose,
      changes: additionalChanges,
      confidence: result.confidence * 0.9,
    };
  }

  private isMeaningfulText(text: string, _locale?: string): boolean {
    // Check minimum length
    if (text.length < 2) {
      return false;
    }

    // Check if it contains at least one letter
    if (!/[a-zA-Zа-яёәғқңөұүіһӌў]/i.test(text)) {
      return false;
    }

    // Check word count
    const words = text.split(/\s+/).filter(word => word.length > 1);
    if (words.length === 0) {
      return false;
    }

    // Check for too many repeated characters
    if (/(.)\1{5,}/.test(text)) {
      return false;
    }

    // Check for alphanumeric balance
    const letterCount = (text.match(/[a-zA-Zа-яёәғқңөұүіһӌў]/gi) || []).length;
    const digitCount = (text.match(/\d/g) || []).length;

    // Should have more letters than digits for meaningful text
    if (digitCount > letterCount) {
      return false;
    }

    return true;
  }

  // Method to add custom cleaning rules
  addCleaningRule(rule: CleaningRule): void {
    this.cleaningRules.push(rule);
    this.logger.log(`Added cleaning rule: ${rule.description}`);
  }

  // Method to add stop words for a language
  addStopWords(locale: string, words: string[]): void {
    if (!this.stopWords[locale]) {
      this.stopWords[locale] = [];
    }
    this.stopWords[locale].push(...words);
    this.logger.log(`Added ${words.length} stop words for locale: ${locale}`);
  }

  // Method to get supported locales
  getSupportedLocales(): string[] {
    return Object.keys(this.stopWords);
  }

  // Method to preview cleaning changes without applying them
  previewCleaning(text: string, locale?: string): Promise<TextCleaningResult> {
    // This method returns what would happen without actually modifying anything
    return this.cleanText(text, locale);
  }
}
