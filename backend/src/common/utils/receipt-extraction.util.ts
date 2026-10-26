const NUMBER_PATTERN = '-?\\d{1,3}(?:[\\s.,]\\d{3})*(?:[.,]\\d{1,2})?|-?\\d+(?:[.,]\\d{1,2})?';

const MONTH_DATE_RANGE_REGEX =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{4}\s*[-–]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s*\d{4})?\b/i;

const DATE_RANGE_REGEX =
  /\d{4}[-/.]\d{2}[-/.]\d{2}\s*[-–]\s*\d{4}[-/.]\d{2}[-/.]\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s*[-–]\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/;

const ADDRESS_LIKE_REGEX = /\b[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/;

export const isLikelySentence = (value: string): boolean => {
  const lower = value.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  if (words.length >= 6) {
    return true;
  }

  if (/^(we|your|thanks?|dear|hello|hi)\b/.test(lower)) {
    return true;
  }

  if (/[.!?]/.test(value) && words.length >= 4) {
    return true;
  }

  return false;
};

export const isDateRangeLike = (value: string): boolean => {
  return DATE_RANGE_REGEX.test(value) || MONTH_DATE_RANGE_REGEX.test(value);
};

export const isAddressLike = (value: string): boolean => {
  if (ADDRESS_LIKE_REGEX.test(value)) {
    return true;
  }

  return /,\s*[A-Z]{2}\b/.test(value) && /\b\d{5}(?:-\d{4})?\b/.test(value);
};

const MAX_MERCHANT_ADDRESS_LENGTH = 300;
const MERCHANT_ADDRESS_SCAN_LINES = 12;

// isAddressLike only knows US "ST 12345" lines, which CIS receipts never carry,
// so street and city markers are matched explicitly. \b is ASCII-only in JS, hence
// the \p{L} guards around Cyrillic words.
const ADDRESS_KEYWORD_REGEX =
  /(?:^|[^\p{L}])(?:адрес|address|г\.|город|ул\.|улица|пр\.|пр-т|просп\.|проспект|мкр\.?|микрорайон|д\.|дом|street|st\.|ave\.?|avenue|road|rd\.|blvd\.?)(?![\p{L}])/iu;
const ADDRESS_LABEL_REGEX = /^(?:адрес|address)\s*:?\s*/iu;
const NON_ADDRESS_LINE_REGEX =
  /(?:^|[^\p{L}])(?:total|итого|tax|vat|ндс|date|дата|amount|сумма|тел|phone)(?![\p{L}])/iu;

export const normalizeMerchantAddress = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed ? collapsed.slice(0, MAX_MERCHANT_ADDRESS_LENGTH) : undefined;
};

/** Store addresses are printed in the receipt header, so only the top lines are scanned. */
export const extractMerchantAddress = (lines: string[]): string | undefined => {
  for (const rawLine of lines.slice(0, MERCHANT_ADDRESS_SCAN_LINES)) {
    const line = rawLine.trim();
    const hasHouseNumber = /\d/.test(line);
    const looksLikeAddress = ADDRESS_KEYWORD_REGEX.test(line) || isAddressLike(line);
    if (hasHouseNumber && looksLikeAddress && !NON_ADDRESS_LINE_REGEX.test(line)) {
      return normalizeMerchantAddress(line.replace(ADDRESS_LABEL_REGEX, ''));
    }
  }

  return undefined;
};

export const isYearLikeAmount = (amount: number, hasExplicitCurrency: boolean): boolean => {
  if (hasExplicitCurrency) {
    return false;
  }

  return amount >= 1900 && amount <= 2099 && Number.isInteger(Math.round(amount));
};

export const shouldSkipLineItem = (
  description: string,
  amount: number,
  hasExplicitCurrency: boolean,
): boolean => {
  return (
    isLikelySentence(description) ||
    isDateRangeLike(description) ||
    isAddressLike(description) ||
    isYearLikeAmount(amount, hasExplicitCurrency)
  );
};

export const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const buildCurrencyTokenPattern = (symbols: string[], currencyCodes: string[]): string => {
  const sortedSymbols = [...symbols]
    .sort((left, right) => right.length - left.length)
    .map(symbol => escapeRegex(symbol));
  const sortedCodes = [...currencyCodes]
    .sort((left, right) => right.length - left.length)
    .map(code => escapeRegex(code));

  return `(?:${[...sortedSymbols, ...sortedCodes].join('|')})`;
};

export const scoreAmountCandidate = (
  amount: number,
  hasTotalKeyword: boolean,
  explicitCurrency: boolean,
  lineIndex: number,
  totalLines: number,
): number => {
  let score = 0;

  if (hasTotalKeyword) {
    score += 100;
  }

  if (explicitCurrency) {
    score += 30;
  }

  const lineWeight = totalLines > 1 ? lineIndex / (totalLines - 1) : 1;
  score += lineWeight * 20;
  score += Math.min(Math.log10(amount + 1) * 5, 20);

  return score;
};

export const extractAmountFragments = (
  line: string,
  includeNumbersWithoutCurrency: boolean,
  currencyTokenPattern: string,
  _numberPattern = NUMBER_PATTERN,
): string[] => {
  const withCurrencyPattern = new RegExp(
    `${currencyTokenPattern}\\s*(?:${NUMBER_PATTERN})|(?:${NUMBER_PATTERN})\\s*${currencyTokenPattern}`,
    'gi',
  );
  const fragments = new Set<string>();

  for (const match of line.matchAll(withCurrencyPattern)) {
    const value = match[0]?.trim();
    if (value) {
      fragments.add(value);
    }
  }

  if (includeNumbersWithoutCurrency) {
    const numberRegex = new RegExp(NUMBER_PATTERN, 'g');
    for (const match of line.matchAll(numberRegex)) {
      const value = match[0]?.trim();
      if (value && /\d/.test(value)) {
        fragments.add(value);
      }
    }
  }

  return Array.from(fragments);
};

/** How far the line items may be off the document's figures: rounding, deposits, a tip. */
export const LINE_ITEMS_TOLERANCE = 0.05;

/**
 * Whether line items add up to what the document states: the subtotal, the
 * total, or the total less tax, within {@link LINE_ITEMS_TOLERANCE}. Lines read
 * as "any text ending in a number" also catch page numbers, dates and postcodes;
 * those never sum to the total, so this is what tells real items from them.
 * A document with no figure to compare against cannot confirm anything.
 */
export const lineItemsReconcile = (
  items: Array<{ amount: number }>,
  figures: { totalAmount?: number | null; subtotal?: number | null; tax?: number | null },
): boolean => {
  if (items.length === 0) {
    return false;
  }
  const sum = items.reduce((acc, item) => acc + item.amount, 0);
  const { totalAmount, subtotal, tax } = figures;
  const targets = [
    subtotal,
    totalAmount,
    totalAmount && tax ? totalAmount - tax : undefined,
  ].filter((value): value is number => typeof value === 'number' && value > 0);
  return targets.some(target => Math.abs(sum - target) <= target * LINE_ITEMS_TOLERANCE);
};

export const extractLineItemsFromLines = async (args: {
  lines: string[];
  currencyTokenPattern: string;
  numberPattern: string;
  hasTotalKeyword: (line: string) => boolean;
  isTaxLine?: (line: string) => boolean;
  parseAmountFragment: (fragment: string) => Promise<{ amount: number; currency?: string } | null>;
  extractCurrency: (text: string) => string | undefined;
  skipTaxLines?: boolean;
}): Promise<Array<{ description: string; amount: number }>> => {
  const lineItems: Array<{ description: string; amount: number }> = [];
  const itemPattern = new RegExp(
    `^(.+?)\\s+((?:${args.currencyTokenPattern}\\s*)?(?:${args.numberPattern})(?:\\s*(?:${args.currencyTokenPattern}))?)$`,
    'i',
  );

  for (const line of args.lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    if (args.hasTotalKeyword(trimmedLine)) {
      continue;
    }

    if (args.skipTaxLines && args.isTaxLine?.(trimmedLine)) {
      continue;
    }

    const match = trimmedLine.match(itemPattern);
    if (!match) {
      continue;
    }

    const description = match[1].trim();
    const parsedAmount = await args.parseAmountFragment(match[2]);
    const amount = parsedAmount?.amount;
    const hasExplicitCurrency = Boolean(args.extractCurrency(match[2]));

    if (
      amount !== undefined &&
      Number.isFinite(amount) &&
      amount > 0 &&
      description.length > 0 &&
      description.length < 200
    ) {
      if (shouldSkipLineItem(description, amount, hasExplicitCurrency)) {
        continue;
      }

      lineItems.push({ description, amount });
    }
  }

  return lineItems;
};
