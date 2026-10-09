import { extractAmountFragments as extractSharedAmountFragments } from './receipt-extraction.util';

export interface ReceiptAmountParserLike {
  parseAmount(amountString: string): Promise<{ amount: number; currency?: string } | null>;
  isValidAmount(amount: number): boolean;
  getSupportedCurrencies(): string[];
  detectCurrencyFromContext(text: string): string | null;
}

type AmountCandidate = {
  amount: number;
  currency?: string;
  score: number;
};

export const DEFAULT_RECEIPT_SYMBOL_TO_CURRENCY: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₽': 'RUB',
  '₸': 'KZT',
  '₴': 'UAH',
  '₺': 'TRY',
  '₹': 'INR',
  '₩': 'KRW',
  '฿': 'THB',
  '₱': 'PHP',
  '₫': 'VND',
  '₪': 'ILS',
  Kč: 'CZK',
  Ft: 'HUF',
  zł: 'PLN',
  lei: 'RON',
  kn: 'HRK',
  Br: 'BYN',
  kr: 'SEK',
  лв: 'BGN',
};

export function extractCurrency(
  text: string,
  amountParser: ReceiptAmountParserLike,
  symbolToCurrency: Record<string, string>,
): string | undefined {
  if (!text) {
    return undefined;
  }

  const normalized = text.replace(/\u00a0/g, ' ');
  const supportedCurrencies = new Set(amountParser.getSupportedCurrencies());

  // Not `\b[A-Z]{3}\b`: receipts print the code glued to the number
  // ("90,000.00KZT"), and a digit on the left kills the word boundary. Letters
  // on either side still rule a match out, so TOTAL does not read as TOT.
  const codeMatches = normalized.toUpperCase().match(/(?<![A-Z])[A-Z]{3}(?![A-Z])/g) || [];
  for (const code of codeMatches) {
    if (supportedCurrencies.has(code)) {
      return code;
    }
  }

  for (const [symbol, code] of Object.entries(symbolToCurrency)) {
    if (normalized.includes(symbol)) {
      return code;
    }
  }

  const contextualCurrency = amountParser.detectCurrencyFromContext(normalized);
  if (contextualCurrency) {
    return contextualCurrency;
  }

  const lowerText = normalized.toLowerCase();
  if (/\b(тенге|тг)\b/.test(lowerText)) {
    return 'KZT';
  }
  if (/\b(dollars?|доллар)\b/.test(lowerText)) {
    return 'USD';
  }
  if (/\b(euros?|евро)\b/.test(lowerText)) {
    return 'EUR';
  }
  if (/\b(rubles?|руб(ль|лей|ля|.)?)\b/.test(lowerText)) {
    return 'RUB';
  }

  return undefined;
}

export function createCurrencyExtractor(
  amountParser: ReceiptAmountParserLike,
  symbolToCurrency: Record<string, string>,
) {
  return (text: string): string | undefined => {
    return extractCurrency(text, amountParser, symbolToCurrency);
  };
}

export function extractAmountFragments(
  line: string,
  includeNumbersWithoutCurrency: boolean,
  numberPattern: string,
  currencyTokenPattern: string,
): string[] {
  return extractSharedAmountFragments(
    line,
    includeNumbersWithoutCurrency,
    currencyTokenPattern,
    numberPattern,
  );
}

function extractBestNumberPart(text: string, numberPattern: string): string | undefined {
  const numberRegex = new RegExp(numberPattern, 'g');
  const matches = text.match(numberRegex);
  if (!matches || matches.length === 0) {
    return undefined;
  }

  return matches.sort((left, right) => right.length - left.length)[0];
}

export async function parseAmountFragment(
  fragment: string,
  options: {
    amountParser: ReceiptAmountParserLike;
    extractCurrency: (text: string) => string | undefined;
    numberPattern: string;
  },
): Promise<{ amount: number; currency?: string } | null> {
  const normalized = fragment.replace(/\u00a0/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const currency = options.extractCurrency(normalized);
  const numberPart = extractBestNumberPart(normalized, options.numberPattern);
  if (!numberPart) {
    return null;
  }

  const parsedNumber = await options.amountParser.parseAmount(numberPart);
  if (parsedNumber && options.amountParser.isValidAmount(parsedNumber.amount)) {
    return {
      amount: Math.abs(parsedNumber.amount),
      currency,
    };
  }

  const direct = await options.amountParser.parseAmount(normalized);
  if (direct && options.amountParser.isValidAmount(direct.amount)) {
    return {
      amount: Math.abs(direct.amount),
      currency: direct.currency || currency,
    };
  }

  return null;
}

export function createAmountFragmentParser(options: {
  amountParser: ReceiptAmountParserLike;
  extractCurrency: (text: string) => string | undefined;
  numberPattern: string;
}) {
  return (fragment: string) => parseAmountFragment(fragment, options);
}

export function createReceiptAmountHelpers(
  amountParser: ReceiptAmountParserLike,
  numberPattern: string,
  symbolToCurrency: Record<string, string> = DEFAULT_RECEIPT_SYMBOL_TO_CURRENCY,
) {
  const extractCurrency = createCurrencyExtractor(amountParser, symbolToCurrency);
  const parseAmountFragment = createAmountFragmentParser({
    amountParser,
    extractCurrency,
    numberPattern,
  });

  return {
    extractCurrency,
    parseAmountFragment,
    symbolToCurrency,
  };
}

export function selectTopAmountCandidate<T extends AmountCandidate>(
  candidates: T[],
): T | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.amount - left.amount;
  })[0];
}

export async function extractAmountWithCurrency(
  lines: string[],
  fullText: string,
  options: {
    amountParser: ReceiptAmountParserLike;
    numberPattern: string;
    extractCurrency: (text: string) => string | undefined;
    extractAmountFragments: (
      line: string,
      includeNumbersWithoutCurrency: boolean,
      currencyTokenPattern: string,
    ) => string[];
    parseAmountFragment: (
      fragment: string,
    ) => Promise<{ amount: number; currency?: string } | null>;
    getCurrencyTokenPattern: () => string;
    hasTotalKeyword: (line: string) => boolean;
  },
): Promise<{ amount: number; currency?: string } | undefined> {
  const documentCurrency = options.extractCurrency(fullText);
  const candidates: AmountCandidate[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const hasTotalKeyword = options.hasTotalKeyword(line);
    const fragments = options.extractAmountFragments(
      line,
      hasTotalKeyword,
      options.getCurrencyTokenPattern(),
    );

    for (const fragment of fragments) {
      const parsed = await options.parseAmountFragment(fragment);
      if (!parsed || parsed.amount <= 0) {
        continue;
      }

      const currency = parsed.currency || options.extractCurrency(line) || documentCurrency;
      const explicitCurrency = Boolean(parsed.currency || options.extractCurrency(fragment));
      const score =
        (hasTotalKeyword ? 100 : 0) +
        (explicitCurrency ? 30 : 0) +
        (lines.length > 1 ? index / (lines.length - 1) : 1) * 20 +
        Math.min(Math.log10(parsed.amount + 1) * 5, 20);

      candidates.push({
        amount: parsed.amount,
        currency,
        score,
      });
    }
  }

  if (!candidates.length) {
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
