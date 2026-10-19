import { Injectable, Logger } from '@nestjs/common';

export interface DateParseResult {
  date: Date;
  format: string;
  confidence: number;
}

interface MonthNames {
  [key: string]: { [key: string]: number };
}

const CJK_MONTH_NAMES = {
  一月: 1,
  二月: 2,
  三月: 3,
  四月: 4,
  五月: 5,
  六月: 6,
  七月: 7,
  八月: 8,
  九月: 9,
  十月: 10,
  十一月: 11,
  十二月: 12,
};

@Injectable()
export class UniversalDateParser {
  private readonly logger = new Logger(UniversalDateParser.name);

  // Month names in different languages
  private readonly monthNames: MonthNames = {
    // English
    en: {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    },
    // Russian
    ru: {
      январь: 1,
      февраль: 2,
      март: 3,
      апрель: 4,
      май: 5,
      июнь: 6,
      июль: 7,
      август: 8,
      сентябрь: 9,
      октябрь: 10,
      ноябрь: 11,
      декабрь: 12,
      янв: 1,
      фев: 2,
      мар: 3,
      апр: 4,
      июн: 6,
      июл: 7,
      авг: 8,
      сен: 9,
      окт: 10,
      ноя: 11,
      дек: 12,
    },
    // Kazakh (Latin)
    kk: {
      қаңтар: 1,
      ақпан: 2,
      наурыз: 3,
      сәуір: 4,
      мамыр: 5,
      маусым: 6,
      шілде: 7,
      тамыз: 8,
      қыркүйек: 9,
      қазан: 10,
      қараша: 11,
      желтоқсан: 12,
    },
    // German
    de: {
      januar: 1,
      februar: 2,
      märz: 3,
      april: 4,
      mai: 5,
      juni: 6,
      juli: 7,
      august: 8,
      september: 9,
      oktober: 10,
      november: 11,
      dezember: 12,
    },
    // French
    fr: {
      janvier: 1,
      février: 2,
      mars: 3,
      avril: 4,
      mai: 5,
      juin: 6,
      juillet: 7,
      août: 8,
      septembre: 9,
      octobre: 10,
      novembre: 11,
      décembre: 12,
    },
    // Spanish
    es: {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
    },
    // Italian
    it: {
      gennaio: 1,
      febbraio: 2,
      marzo: 3,
      aprile: 4,
      maggio: 5,
      giugno: 6,
      luglio: 7,
      agosto: 8,
      settembre: 9,
      ottobre: 10,
      novembre: 11,
      dicembre: 12,
    },
    // Portuguese
    pt: {
      janeiro: 1,
      fevereiro: 2,
      março: 3,
      abril: 4,
      maio: 5,
      junho: 6,
      julho: 7,
      agosto: 8,
      setembro: 9,
      outubro: 10,
      novembro: 11,
      dezembro: 12,
    },
    // Dutch
    nl: {
      januari: 1,
      februari: 2,
      maart: 3,
      april: 4,
      mei: 5,
      juni: 6,
      juli: 7,
      augustus: 8,
      september: 9,
      oktober: 10,
      november: 11,
      december: 12,
    },
    // Polish
    pl: {
      styczeń: 1,
      luty: 2,
      marzec: 3,
      kwiecień: 4,
      maj: 5,
      czerwiec: 6,
      lipiec: 7,
      sierpień: 8,
      wrzesień: 9,
      październik: 10,
      listopad: 11,
      grudzień: 12,
    },
    // Turkish
    tr: {
      ocak: 1,
      şubat: 2,
      mart: 3,
      nisan: 4,
      mayıs: 5,
      haziran: 6,
      temmuz: 7,
      ağustos: 8,
      eylül: 9,
      ekim: 10,
      kasım: 11,
      aralık: 12,
    },
    // Ukrainian
    uk: {
      січень: 1,
      лютий: 2,
      березень: 3,
      квітень: 4,
      травень: 5,
      червень: 6,
      липень: 7,
      серпень: 8,
      вересень: 9,
      жовтень: 10,
      листопад: 11,
      грудень: 12,
    },
    // Belarusian
    be: {
      студзень: 1,
      люты: 2,
      сакавік: 3,
      красавік: 4,
      май: 5,
      чэрвень: 6,
      ліпень: 7,
      жнівень: 8,
      верасень: 9,
      кастрычнік: 10,
      лістапад: 11,
      снежань: 12,
    },
    // Chinese
    zh: CJK_MONTH_NAMES,
    // Japanese
    ja: CJK_MONTH_NAMES,
    // Korean
    ko: {
      일월: 1,
      이월: 2,
      삼월: 3,
      사월: 4,
      오월: 5,
      유월: 6,
      칠월: 7,
      팔월: 8,
      구월: 9,
      시월: 10,
      십일월: 11,
      십이월: 12,
    },
    // Arabic
    ar: {
      يناير: 1,
      فبراير: 2,
      مارس: 3,
      أبريل: 4,
      مايو: 5,
      يونيو: 6,
      يوليو: 7,
      أغسطس: 8,
      سبتمبر: 9,
      أكتوبر: 10,
      نوفمبر: 11,
      ديسمبر: 12,
    },
  };

  async parseDate(dateString: string, locale?: string): Promise<DateParseResult | null> {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }

    const cleanDate = dateString.trim();

    // Try different parsing strategies in order of confidence
    const strategies = [
      () => this.parseISO8601(cleanDate),
      () => this.parseNumericFormats(cleanDate),
      () => this.parseTextualMonth(cleanDate, locale),
      () => this.parseSlashedFormats(cleanDate),
      () => this.parseDottedFormats(cleanDate),
      () => this.parseSpacedFormats(cleanDate),
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result && this.isValidDate(result.date)) {
          return result;
        }
      } catch (_error) {
        // Continue to next strategy
      }
    }

    this.logger.warn(`Failed to parse date: ${dateString}`);
    return null;
  }

  private buildParsedDateResult(date: Date, format: string, confidence: number): DateParseResult {
    return {
      date,
      format,
      confidence,
    };
  }

  private createDate(year: string | number, month: string | number, day: string | number): Date {
    return new Date(
      Number.parseInt(String(year), 10),
      Number.parseInt(String(month), 10) - 1,
      Number.parseInt(String(day), 10),
    );
  }

  private parseISO8601(dateString: string): DateParseResult | null {
    // ISO 8601 formats: YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, etc.
    const isoRegex = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
    const match = dateString.match(isoRegex);

    if (match) {
      const [, year, month, day] = match;
      return this.buildParsedDateResult(this.createDate(year, month, day), 'ISO8601', 0.95);
    }

    return null;
  }

  private parseNumericFormats(dateString: string): DateParseResult | null {
    // YYYYMMDD, YYYYMMDDHHMMSS
    const numericRegex = /^(\d{4})(\d{2})(\d{2})(?:\d{6})?$/;
    const match = dateString.match(numericRegex);

    if (match) {
      const [, year, month, day] = match;
      return this.buildParsedDateResult(this.createDate(year, month, day), 'NUMERIC', 0.9);
    }

    return null;
  }

  private parseTextualMonth(dateString: string, locale?: string): DateParseResult | null {
    // Try to parse dates with textual months in different languages
    const locales = locale ? [locale, 'en'] : ['en'];
    // \b is an ASCII word boundary and never matches around Cyrillic/CJK/Arabic
    // month names, so non-Latin locales need a Unicode-aware boundary instead.
    const wordStart = '(?<![\\p{L}\\p{N}_])';
    const wordEnd = '(?![\\p{L}\\p{N}_])';

    for (const loc of locales) {
      const monthData = this.monthNames[loc];
      if (!monthData) {
        continue;
      }

      for (const [monthName, monthNumber] of Object.entries(monthData)) {
        const escapedMonth = monthName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Create regex for this month name
        const monthRegex = new RegExp(`${wordStart}${escapedMonth}${wordEnd}`, 'iu');
        if (!monthRegex.test(dateString)) {
          continue;
        }

        // Try different patterns with this month
        const patterns = [
          // Month DD, YYYY
          new RegExp(`${wordStart}${escapedMonth}\\s+(\\d{1,2})[,\\s]+(\\d{4})\\b`, 'iu'),
          // DD Month YYYY
          new RegExp(`(\\d{1,2})\\s+${escapedMonth}\\s+(\\d{4})\\b`, 'iu'),
          // YYYY Month DD
          new RegExp(`(\\d{4})\\s+${escapedMonth}\\s+(\\d{1,2})\\b`, 'iu'),
        ];

        for (const pattern of patterns) {
          const match = dateString.match(pattern);
          if (match) {
            const [, first, second] = match;
            let dayStr = first;
            let yearStr = second;

            if (pattern === patterns[2]) {
              yearStr = first;
              dayStr = second;
            }

            const date = this.createDate(yearStr, monthNumber, dayStr);

            if (this.isValidDate(date)) {
              return this.buildParsedDateResult(date, 'TEXTUAL_MONTH', 0.85);
            }
          }
        }
      }
    }

    return null;
  }

  private parseSlashedFormats(dateString: string): DateParseResult | null {
    // MM/DD/YYYY, DD/MM/YYYY, YYYY/MM/DD
    const slashRegex = /^(?:(\d{1,2})[/](\d{1,2})[/](\d{4})|(\d{4})[/](\d{1,2})[/](\d{1,2}))$/;
    const match = dateString.match(slashRegex);

    if (match) {
      const [, first, second, third, fourth, fifth, sixth] = match;
      let dayStr: string;
      let monthStr: string;
      let yearStr: string;

      if (fourth) {
        // YYYY/MM/DD
        yearStr = fourth;
        monthStr = fifth;
        dayStr = sixth;
      } else {
        // MM/DD/YYYY or DD/MM/YYYY - assume MM/DD/YYYY
        monthStr = first;
        dayStr = second;
        yearStr = third;
      }

      const date = this.createDate(yearStr, monthStr, dayStr);

      if (this.isValidDate(date)) {
        return this.buildParsedDateResult(date, 'SLASHED', 0.8);
      }
    }

    return null;
  }

  private parseDottedFormats(dateString: string): DateParseResult | null {
    // DD.MM.YYYY, DD.MM.YY, YYYY.MM.DD
    const dotRegex = /^(?:(\d{1,2})[.](\d{1,2})[.](\d{2,4})|(\d{4})[.](\d{1,2})[.](\d{1,2}))$/;
    const match = dateString.match(dotRegex);

    if (match) {
      let dayStr: string;
      let monthStr: string;
      let yearStr: string;

      if (match[4]) {
        // YYYY.MM.DD
        yearStr = match[4];
        monthStr = match[5];
        dayStr = match[6];
      } else {
        // DD.MM.YYYY or DD.MM.YY
        [, dayStr, monthStr, yearStr] = match;

        // Handle 2-digit year
        if (yearStr.length === 2) {
          const currentYear = new Date().getFullYear();
          const century = Math.floor(currentYear / 100) * 100;
          yearStr = (Number.parseInt(yearStr, 10) + century).toString();
        }
      }

      const date = this.createDate(yearStr, monthStr, dayStr);

      if (this.isValidDate(date)) {
        return this.buildParsedDateResult(date, 'DOTTED', 0.8);
      }
    }

    return null;
  }

  private parseSpacedFormats(dateString: string): DateParseResult | null {
    // DD MM YYYY, MM DD YYYY
    const spaceRegex = /^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/;
    const match = dateString.match(spaceRegex);

    if (match) {
      const [, first, second, year] = match;

      // Assume first is day, second is month (common in many locales)
      const day = Number.parseInt(first);
      const month = Number.parseInt(second);

      // Validate ranges
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const date = this.createDate(year, month, day);

        if (this.isValidDate(date)) {
          return this.buildParsedDateResult(date, 'SPACED', 0.7);
        }
      }
    }

    return null;
  }

  private isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
  }

  // Method to add support for new languages
  addMonthNames(locale: string, names: { [key: string]: number }): void {
    this.monthNames[locale] = { ...this.monthNames[locale], ...names };
    this.logger.log(`Added month names for locale: ${locale}`);
  }

  // Method to get supported locales
  getSupportedLocales(): string[] {
    return Object.keys(this.monthNames);
  }
}
