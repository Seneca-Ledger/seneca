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
 * One rate lookup per distinct source currency rather than one per row. A
 * currency with no rate to `target` is left out of the map, so `convertWith`
 * drops its amounts instead of reading 500 UAH as 500 USD; `getRate` would
 * hand back 1:1 for it.
 */
export async function buildRateMap(
  exchangeRates: ExchangeRatesService,
  currencies: string[],
  target: string,
  workspaceId: string,
): Promise<Map<string, number>> {
  const rates = new Map<string, number>([[normalizeCurrency(target), 1]]);
  await addMissingRates(exchangeRates, rates, currencies, target, workspaceId);
  return rates;
}

/** Looks up the currencies `rates` does not know yet, for rows read after the map was built. */
export async function addMissingRates(
  exchangeRates: ExchangeRatesService,
  rates: Map<string, number>,
  currencies: string[],
  target: string,
  workspaceId: string,
): Promise<void> {
  const to = normalizeCurrency(target);
  for (const source of new Set(currencies.map(normalizeCurrency))) {
    if (rates.has(source)) {
      continue;
    }
    if (source === to) {
      rates.set(source, 1);
      continue;
    }
    const rate = await exchangeRates
      .getRateOrNull(source, to, undefined, workspaceId)
      .catch(() => null);
    if (rate !== null) {
      rates.set(source, rate);
    }
  }
}

/**
 * Converts with a map built by `buildRateMap`. A currency the map has no rate
 * for counts as nothing: leaving an amount out is a smaller error than counting
 * it one to one in another currency.
 */
export function convertWith(
  rates: Map<string, number>,
  amount: string | number | null | undefined,
  from: string,
): number {
  const rate = rates.get(normalizeCurrency(from));
  return rate === undefined ? 0 : toNumber(amount) * rate;
}
