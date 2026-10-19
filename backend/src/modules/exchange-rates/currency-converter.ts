import type { ExchangeRatesService } from './exchange-rates.service';

/** An amount per currency code, before conversion. */
export type CurrencyAmounts = Map<string, number>;

/**
 * Upper-cased and trimmed, but otherwise as stored: a code that is not ISO is
 * reported as missing a rate rather than silently read as another currency.
 */
export function normalizeCurrencyCode(currency: string | null | undefined): string {
  return String(currency || '')
    .trim()
    .toUpperCase();
}

export function addAmount(amounts: CurrencyAmounts, currency: string, amount: number): void {
  amounts.set(currency, (amounts.get(currency) ?? 0) + amount);
}

/**
 * Converts amounts in several currencies into one target currency, at the rate
 * of a given day.
 *
 * Rates are loaded up front, one lookup per (currency, day), so that report
 * code can convert synchronously. A currency without a rate is not guessed at
 * 1:1: its amount is left out and the currency is listed in `missing`, for the
 * report to say so.
 */
export class CurrencyConverter {
  private readonly missingCurrencies = new Set<string>();

  private constructor(
    readonly target: string,
    private readonly rates: Map<string, number | null>,
  ) {}

  static async load(
    exchangeRates: ExchangeRatesService,
    target: string,
    needed: Array<{ currency: string; date: string }>,
    workspaceId: string,
  ): Promise<CurrencyConverter> {
    const rates = new Map<string, number | null>();
    for (const { currency, date } of needed) {
      const key = rateKey(currency, date);
      if (currency === target || rates.has(key)) {
        continue;
      }
      rates.set(
        key,
        /^[A-Z]{3}$/.test(currency)
          ? await exchangeRates.getRateOrNull(currency, target, date, workspaceId)
          : null,
      );
    }
    return new CurrencyConverter(target, rates);
  }

  /** `amount` in the target currency; 0 when no rate was found. */
  convert(amount: number, currency: string, date: string): number {
    if (currency === this.target || amount === 0) {
      return amount;
    }
    const rate = this.rates.get(rateKey(currency, date));
    if (rate === null || rate === undefined) {
      this.missingCurrencies.add(currency);
      return 0;
    }
    return amount * rate;
  }

  convertAll(amounts: CurrencyAmounts, date: string): number {
    let total = 0;
    for (const [currency, amount] of amounts) {
      total += this.convert(amount, currency, date);
    }
    return total;
  }

  /** Currencies whose amounts were left out, sorted. */
  get missing(): string[] {
    return [...this.missingCurrencies].sort();
  }
}

function rateKey(currency: string, date: string): string {
  return `${currency}:${date}`;
}
