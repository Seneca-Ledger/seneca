/**
 * Turns a chat line like "coffee 4.50", "4,50 € кофе" or "lunch 12.30 EUR"
 * into an expense. One number is the amount; a currency may sit next to it;
 * everything else is the merchant.
 */
export interface ParsedExpenseText {
  amount: number;
  currency: string | null;
  merchant: string;
}

const CURRENCY_ALIASES: Record<string, string> = {
  '€': 'EUR',
  eur: 'EUR',
  евро: 'EUR',
  $: 'USD',
  usd: 'USD',
  '£': 'GBP',
  gbp: 'GBP',
  '₸': 'KZT',
  kzt: 'KZT',
  тг: 'KZT',
  тенге: 'KZT',
  '₽': 'RUB',
  rub: 'RUB',
  руб: 'RUB',
  '₴': 'UAH',
  uah: 'UAH',
  грн: 'UAH',
  pln: 'PLN',
  zł: 'PLN',
  chf: 'CHF',
  czk: 'CZK',
  sek: 'SEK',
  try: 'TRY',
  '₺': 'TRY',
};

const AMOUNT_PATTERN = /(?<![\d.,])(\d{1,9}(?:[.,]\d{1,2})?)(?![\d.,])/u;
const CURRENCY_PATTERN = /^(€|\$|£|₸|₽|₴|₺|[a-zа-яё]{2,5})$/iu;
const SEPARATOR_PATTERN = /[\s\-–—:,;]/u;

// A loop rather than /[…]+$/: an anchored run of separators backtracks
// quadratically on long user text.
function trimSeparators(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && SEPARATOR_PATTERN.test(value[start])) {
    start++;
  }
  while (end > start && SEPARATOR_PATTERN.test(value[end - 1])) {
    end--;
  }
  return value.slice(start, end);
}

export function parseExpenseText(input: string): ParsedExpenseText | null {
  const text = input.trim();
  if (!text || text.startsWith('/')) return null;

  const match = AMOUNT_PATTERN.exec(text);
  if (!match || match.index === undefined) return null;
  const amount = Number(match[1].replace(',', '.'));
  if (!(amount > 0)) return null;

  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  let currency: string | null = null;
  let merchantParts = [before, after];

  // A currency glued to the amount ("4.50€", "450тг") or the next/previous token.
  const afterTokens = after.split(/\s+/).filter(Boolean);
  const beforeTokens = before.split(/\s+/).filter(Boolean);
  const takeCurrency = (token: string | undefined): string | null => {
    if (!token) return null;
    const normalised = token.toLowerCase();
    return CURRENCY_PATTERN.test(token) && CURRENCY_ALIASES[normalised]
      ? CURRENCY_ALIASES[normalised]
      : null;
  };
  const afterCurrency = takeCurrency(afterTokens[0]);
  const beforeCurrency = afterCurrency ? null : takeCurrency(beforeTokens[beforeTokens.length - 1]);
  if (afterCurrency) {
    currency = afterCurrency;
    merchantParts = [before, afterTokens.slice(1).join(' ')];
  } else if (beforeCurrency) {
    currency = beforeCurrency;
    merchantParts = [beforeTokens.slice(0, -1).join(' '), after];
  }

  const merchant = trimSeparators(merchantParts.join(' ')).replace(/\s+/g, ' ');

  return { amount: Math.round(amount * 100) / 100, currency, merchant };
}
