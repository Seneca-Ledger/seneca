import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';

/**
 * Money helpers shared by the goal read models.
 *
 * Both the flow tree and the savings plan sum rows that may each carry their
 * own currency, and both have to land on the workspace currency. Keeping one
 * copy of the conversion means the two screens cannot disagree about what a
 * EUR deposit is worth.
 */

/** Falls back rather than throwing: a bad code must not lose the amount. */
export function normalizeCurrency(currency: string | null | undefined): string {
  return currencyCodeOrDefault(currency);
}

export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * One rate lookup per distinct source currency rather than one per row.
 * getRate never throws: it degrades to a stale rate, then to 1:1, and logs.
 */
export async function buildRateMap(
  exchangeRates: ExchangeRatesService,
  currencies: string[],
  target: string,
  workspaceId: string,
): Promise<Map<string, number>> {
  const rates = new Map<string, number>();
  for (const source of new Set(currencies.map(normalizeCurrency))) {
    rates.set(
      source,
      source === target ? 1 : await exchangeRates.getRate(source, target, undefined, workspaceId),
    );
  }
  return rates;
}

/** Converts with a map built by `buildRateMap`; an unknown currency stays 1:1. */
export function convertWith(
  rates: Map<string, number>,
  amount: string | number | null | undefined,
  from: string,
): number {
  return toNumber(amount) * (rates.get(normalizeCurrency(from)) ?? 1);
}
