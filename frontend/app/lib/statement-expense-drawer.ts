import { currencyOr } from './currency';

export { DEFAULT_RECENT_CURRENCIES } from './currency';
export type StatementExpenseMode = 'scan' | 'manual';
export type ManualStep = 'amount' | 'details';

export const STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT = 'statements:open-expense-drawer';
export const ALWAYS_ALLOW_STATEMENT_DUPLICATES = true;
export type OpenExpenseDrawerEventDetail = {
  mode?: StatementExpenseMode | string | null;
};

export type ManualExpenseDraft = {
  amount: string;
  currency: string;
  description: string;
  merchant: string;
  categoryId: string;
  taxRateId: string;
};

export type TaxRateOption = {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isEnabled: boolean;
};

export type CreateTaxRatePayload = {
  name: string;
  rate: number;
  isEnabled: true;
};

export type CurrencySearchItem = {
  code: string;
  symbol: string;
  label: string;
  searchText: string;
};

const FALLBACK_WORLD_CURRENCIES = [
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'SEK',
  'NZD',
  'MXN',
  'SGD',
  'HKD',
  'NOK',
  'KRW',
  'TRY',
  'INR',
  'RUB',
  'BRL',
  'ZAR',
  'AED',
  'SAR',
  'ILS',
  'KZT',
  'UAH',
  'THB',
  'MYR',
  'IDR',
  'PLN',
  'CZK',
] as const;

const getWorldCurrencyCodes = (): string[] => {
  const supportedValuesOf = (
    globalThis.Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;

  if (typeof supportedValuesOf === 'function') {
    const worldCurrencies = supportedValuesOf('currency');
    if (Array.isArray(worldCurrencies) && worldCurrencies.length > 0) {
      return [...new Set(worldCurrencies.map(code => code.toUpperCase()))];
    }
  }

  return [...FALLBACK_WORLD_CURRENCIES];
};

const getCurrencySymbol = (currencyCode: string): string => {
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1);

    const symbol = parts.find(part => part.type === 'currency')?.value?.trim();
    return symbol && symbol.length > 0 ? symbol : currencyCode;
  } catch {
    return currencyCode;
  }
};

export function getCurrencySymbolForCode(currencyCode: string): string {
  return getCurrencySymbol(currencyCode.toUpperCase());
}

export const WORLD_CURRENCY_CODES = getWorldCurrencyCodes();

export function buildCurrencySearchIndex(
  codes: string[] = WORLD_CURRENCY_CODES,
): CurrencySearchItem[] {
  return [...new Set(codes.map(code => code.toUpperCase()))]
    .sort((left, right) => left.localeCompare(right))
    .map(code => {
      const symbol = getCurrencySymbol(code);
      const label = `${code} - ${symbol}`;

      return {
        code,
        symbol,
        label,
        searchText: `${code} ${symbol} ${label}`.toLowerCase(),
      };
    });
}

export function sanitizeManualAmountInput(value: string): string {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integerPart, ...decimalParts] = normalized.split('.');

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join('')}`;
}

export function hasPositiveManualAmount(value: string): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function computeManualAmountFontSize(value: string): number {
  const BASE_FONT_SIZE = 76;
  const MIN_FONT_SIZE = 24;
  const LAYOUT_WIDTH = 290;
  const SYMBOL_WIDTH_UNITS = 1.2;
  const GAP_WIDTH_UNITS = 0.35;
  const DIGIT_WIDTH_UNITS = 0.62;

  const amountText = value.trim().length > 0 ? value.trim() : '0';
  const widthUnits = SYMBOL_WIDTH_UNITS + GAP_WIDTH_UNITS + amountText.length * DIGIT_WIDTH_UNITS;
  const fittedFontSize = Math.floor(LAYOUT_WIDTH / widthUnits);

  return Math.max(MIN_FONT_SIZE, Math.min(BASE_FONT_SIZE, fittedFontSize));
}

export function resolveExpenseDrawerMode(mode: string | null | undefined): StatementExpenseMode {
  return mode === 'manual' ? 'manual' : 'scan';
}

export function resolveDefaultCurrency(currency: string | null | undefined): string {
  return currencyOr(currency);
}

export function createDefaultManualDraft(currency: string): ManualExpenseDraft {
  return { amount: '', currency, description: '', merchant: '', categoryId: '', taxRateId: '' };
}

export function validateManualExpenseDraft(draft: ManualExpenseDraft): {
  amount: boolean;
  merchant: boolean;
  category: boolean;
} {
  const parsedAmount = Number(draft.amount);

  return {
    amount: Number.isFinite(parsedAmount) && parsedAmount > 0,
    merchant: draft.merchant.trim().length > 0,
    category: draft.categoryId.trim().length > 0,
  };
}
