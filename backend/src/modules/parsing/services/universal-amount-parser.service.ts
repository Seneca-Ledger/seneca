import { Injectable, Logger } from '@nestjs/common';

export interface AmountParseResult {
  amount: number;
  currency?: string;
  isNegative: boolean;
  format: string;
  confidence: number;
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  symbolPosition: 'before' | 'after';
  decimalSeparator: string;
  thousandsSeparator: string;
}

@Injectable()
export class UniversalAmountParser {
  private readonly logger = new Logger(UniversalAmountParser.name);

  private readonly currencies: Map<string, CurrencyInfo> = new Map([
    [
      'USD',
      {
        code: 'USD',
        symbol: '$',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'EUR',
      {
        code: 'EUR',
        symbol: '€',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'GBP',
      {
        code: 'GBP',
        symbol: '£',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'JPY',
      {
        code: 'JPY',
        symbol: '¥',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'CNY',
      {
        code: 'CNY',
        symbol: '¥',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'RUB',
      {
        code: 'RUB',
        symbol: '₽',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'KZT',
      {
        code: 'KZT',
        symbol: '₸',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'BYN',
      {
        code: 'BYN',
        symbol: 'Br',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'UAH',
      {
        code: 'UAH',
        symbol: '₴',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'CHF',
      {
        code: 'CHF',
        symbol: 'CHF',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: "'",
      },
    ],
    [
      'CAD',
      {
        code: 'CAD',
        symbol: 'C$',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'AUD',
      {
        code: 'AUD',
        symbol: 'A$',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'NZD',
      {
        code: 'NZD',
        symbol: 'NZ$',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'SGD',
      {
        code: 'SGD',
        symbol: 'S$',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'HKD',
      {
        code: 'HKD',
        symbol: 'HK$',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'SEK',
      {
        code: 'SEK',
        symbol: 'kr',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'NOK',
      {
        code: 'NOK',
        symbol: 'kr',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'DKK',
      {
        code: 'DKK',
        symbol: 'kr',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'PLN',
      {
        code: 'PLN',
        symbol: 'zł',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'CZK',
      {
        code: 'CZK',
        symbol: 'Kč',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'HUF',
      {
        code: 'HUF',
        symbol: 'Ft',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'RON',
      {
        code: 'RON',
        symbol: 'lei',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'BGN',
      {
        code: 'BGN',
        symbol: 'лв',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: ' ',
      },
    ],
    [
      'HRK',
      {
        code: 'HRK',
        symbol: 'kn',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'TRY',
      {
        code: 'TRY',
        symbol: '₺',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'ILS',
      {
        code: 'ILS',
        symbol: '₪',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'INR',
      {
        code: 'INR',
        symbol: '₹',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'KRW',
      {
        code: 'KRW',
        symbol: '₩',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'THB',
      {
        code: 'THB',
        symbol: '฿',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'MYR',
      {
        code: 'MYR',
        symbol: 'RM',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'PHP',
      {
        code: 'PHP',
        symbol: '₱',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'IDR',
      {
        code: 'IDR',
        symbol: 'Rp',
        symbolPosition: 'before',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'VND',
      {
        code: 'VND',
        symbol: '₫',
        symbolPosition: 'after',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'MXN',
      {
        code: 'MXN',
        symbol: 'Mex$',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'BRL',
      {
        code: 'BRL',
        symbol: 'R$',
        symbolPosition: 'before',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'ARS',
      {
        code: 'ARS',
        symbol: '$',
        symbolPosition: 'before',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'CLP',
      {
        code: 'CLP',
        symbol: '$',
        symbolPosition: 'before',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'COP',
      {
        code: 'COP',
        symbol: '$',
        symbolPosition: 'before',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'PEN',
      {
        code: 'PEN',
        symbol: 'S/',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'UYU',
      {
        code: 'UYU',
        symbol: '$U',
        symbolPosition: 'before',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      'ZAR',
      {
        code: 'ZAR',
        symbol: 'R',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'EGP',
      {
        code: 'EGP',
        symbol: 'E£',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      'SAR',
      {
        code: 'SAR',
        symbol: 'ر.س',
        symbolPosition: 'before',
        decimalSeparator: '٫',
        thousandsSeparator: ',',
      },
    ],
    [
      'AED',
      {
        code: 'AED',
        symbol: 'د.إ',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
  ]);

  async parseAmount(amountString: string): Promise<AmountParseResult | null> {
    if (!amountString || typeof amountString !== 'string') {
      return null;
    }

    const cleanAmount = amountString.trim();

    const strategies: Array<() => AmountParseResult | null> = [
      () => this.parseWithCurrency(cleanAmount),
      () => this.parseWithSeparators(cleanAmount),
      () => this.parseSimpleNumber(cleanAmount),
      () => this.parseWithParentheses(cleanAmount),
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result && (result.amount > 0 || result.amount < 0 || result.amount === 0)) {
          return result;
        }
      } catch {
        // continue
      }
    }

    this.logger.warn(`Failed to parse amount: ${amountString}`);
    return null;
  }

  private parseWithCurrency(amountString: string): AmountParseResult | null {
    for (const [currencyCode, currencyInfo] of this.currencies.entries()) {
      const patterns = [
        new RegExp(`^${this.escapeRegex(currencyInfo.symbol)}\\s*([0-9٠-٩۰-۹\\s.,٬٫'’-]+)$`, 'i'),
        new RegExp(`^([0-9٠-٩۰-۹\\s.,٬٫'’-]+)\\s*${this.escapeRegex(currencyInfo.symbol)}$`, 'i'),
        new RegExp(`^${currencyCode}\\s*([0-9٠-٩۰-۹\\s.,٬٫'’-]+)$`, 'i'),
        new RegExp(`^([0-9٠-٩۰-۹\\s.,٬٫'’-]+)\\s*${currencyCode}$`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = amountString.match(pattern);
        if (match) {
          const numberString = match[1];
          const amount = this.parseNumberString(numberString, currencyInfo);

          if (amount !== null) {
            return {
              amount,
              currency: currencyCode,
              isNegative: amount < 0,
              format: 'WITH_CURRENCY',
              confidence: 0.95,
            };
          }
        }
      }
    }

    return null;
  }

  private parseWithSeparators(amountString: string): AmountParseResult | null {
    const patterns = [
      /^([0-9,]+(?:\.[0-9]+)?)$/,
      /^([0-9.]+(?:,[0-9]+)?)$/,
      /^([0-9\s]+(?:,[0-9]+)?)$/,
      /^([0-9\s]+(?:\.[0-9]+)?)$/,
    ];

    for (const pattern of patterns) {
      const match = amountString.match(pattern);
      if (match) {
        const numberString = match[1];
        const amount = this.parseNumberString(numberString);

        if (amount !== null) {
          return {
            amount,
            isNegative: amount < 0,
            format: 'WITH_SEPARATORS',
            confidence: 0.85,
          };
        }
      }
    }

    return null;
  }

  private parseSimpleNumber(amountString: string): AmountParseResult | null {
    const pattern = /^(-?\d+(?:\.\d+)?)$/;
    const match = amountString.match(pattern);

    if (match) {
      const amount = Number(match[1]);
      if (!Number.isFinite(amount)) {
        return null;
      }

      return {
        amount,
        isNegative: amount < 0,
        format: 'SIMPLE',
        confidence: 0.9,
      };
    }

    return null;
  }

  private parseWithParentheses(amountString: string): AmountParseResult | null {
    const pattern = /^\(([0-9.,\s]+)\)$/;
    const match = amountString.match(pattern);

    if (match) {
      const numberString = match[1];
      const amount = this.parseNumberString(numberString);

      if (amount !== null) {
        const negated = -Math.abs(amount);
        return {
          amount: negated,
          isNegative: true,
          format: 'PARENTHESES',
          confidence: 0.8,
        };
      }
    }

    return null;
  }

  private parseNumberString(numberString: string, currencyInfo?: CurrencyInfo): number | null {
    try {
      let cleanString = this.normalizeDigits(numberString).replace(/[\s\u00A0\u202F]/g, '');

      let decimalSeparator = '.';
      let thousandsSeparator = ',';

      if (currencyInfo) {
        decimalSeparator = currencyInfo.decimalSeparator;
        thousandsSeparator = currencyInfo.thousandsSeparator;
      } else {
        cleanString = cleanString.replace(/[’']/g, "'");

        const lastCommaIndex = cleanString.lastIndexOf(',');
        const lastDotIndex = cleanString.lastIndexOf('.');
        const lastArabicDecimalIndex = cleanString.lastIndexOf('٫');

        if (cleanString.includes("'")) {
          thousandsSeparator = "'";
        }

        if (lastArabicDecimalIndex !== -1) {
          decimalSeparator = '٫';
          thousandsSeparator = ',';
        } else if (lastCommaIndex > lastDotIndex && lastCommaIndex !== -1) {
          decimalSeparator = ',';
          thousandsSeparator = '.';
        } else if (lastDotIndex > lastCommaIndex && lastDotIndex !== -1) {
          decimalSeparator = '.';
          thousandsSeparator = ',';
        }
      }

      const isNegative = cleanString.startsWith('-');
      if (isNegative) {
        cleanString = cleanString.substring(1);
      }

      const thousandsRegex = new RegExp(`\\${thousandsSeparator}`, 'g');
      cleanString = cleanString.replace(thousandsRegex, '');

      if (decimalSeparator !== '.') {
        const decRegex = new RegExp(`\\${decimalSeparator}`, 'g');
        cleanString = cleanString.replace(decRegex, '.');
      }

      if (!/^\d+(\.\d+)?$/.test(cleanString)) {
        return null;
      }

      const amount = Number(cleanString);
      if (!Number.isFinite(amount)) {
        return null;
      }

      return isNegative ? -amount : amount;
    } catch {
      return null;
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private normalizeDigits(value: string): string {
    const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩';
    const easternArabicIndicDigits = '۰۱۲۳۴۵۶۷۸۹';

    return value
      .replace(/[٠-٩]/g, digit => String(arabicIndicDigits.indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String(easternArabicIndicDigits.indexOf(digit)))
      .replace(/٬/g, ',');
  }

  detectCurrencyFromContext(text: string): string | null {
    for (const [currencyCode, currencyInfo] of this.currencies.entries()) {
      const patterns = [
        new RegExp(`\\b${currencyCode}\\b`, 'i'),
        new RegExp(`\\b${this.escapeRegex(currencyInfo.symbol)}\\b`),
      ];

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return currencyCode;
        }
      }
    }

    return null;
  }

  addCurrency(code: string, info: CurrencyInfo): void {
    this.currencies.set(code, info);
    this.logger.log(`Added custom currency: ${code}`);
  }

  getSupportedCurrencies(): string[] {
    return Array.from(this.currencies.keys());
  }

  formatAmount(amount: number, currencyCode: string, locale = 'en-US'): string {
    const currencyInfo = this.currencies.get(currencyCode);
    if (!currencyInfo) {
      return amount.toString();
    }

    const formattedNumber = amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (currencyInfo.symbolPosition === 'before') {
      return `${currencyInfo.symbol}${formattedNumber}`;
    }

    return `${formattedNumber}${currencyInfo.symbol}`;
  }

  isValidAmount(amount: number): boolean {
    if (!Number.isFinite(amount)) {
      return false;
    }
    const absAmount = Math.abs(amount);
    return absAmount >= 0 && absAmount < 1e15;
  }
}
