import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Effect, Schema } from 'effect';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { describeHttpFailure, getJson } from '../../common/effect/http-json';

/** Banca d'Italia quotes every currency as units of that currency for one euro. */
export interface BdiRates {
  /** Sorted by date. */
  daily: Array<{ date: string; perEuro: number }>;
  /** YYYY-MM → monthly average. */
  monthly: Record<string, number>;
}

export interface BdiQuote {
  perEuro: number;
  /** The day of a daily rate, or YYYY-MM for a monthly average. */
  rateDate: string;
}

const BDI_API = 'https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0';
const REQUEST_TIMEOUT_MS = 15_000;
const DAY_MS = 86_400_000;
/**
 * How far "the nearest earlier day" may reach. A week covers weekends and
 * holidays; a longer gap means no rate was fixed around the transaction, and
 * the instructions then switch to the monthly average.
 */
const MAX_LOOKBACK_DAYS = 7;

/**
 * The reference rate of the transaction day or the nearest earlier day; failing
 * that, the average of the transaction's month (Redditi PF instructions,
 * "Conversione delle valute estere").
 */
export function referenceRateFor(rates: BdiRates, date: string): BdiQuote | null {
  let low = 0;
  let high = rates.daily.length - 1;
  let found: BdiRates['daily'][number] | null = null;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (rates.daily[middle].date <= date) {
      found = rates.daily[middle];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (found && Date.parse(date) - Date.parse(found.date) <= MAX_LOOKBACK_DAYS * DAY_MS) {
    return { perEuro: found.perEuro, rateDate: found.date };
  }

  const month = date.slice(0, 7);
  const average = rates.monthly[month];
  return average ? { perEuro: average, rateDate: month } : null;
}

const BdiResponse = Schema.Struct({
  rates: Schema.optional(
    Schema.Array(
      Schema.Struct({
        referenceDate: Schema.String,
        avgRate: Schema.Union([Schema.String, Schema.Number]),
      }),
    ),
  ),
});

/** "N.A." marks days (or months) the currency had no rate. */
function parseRate(value: string | number): number | null {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Banca d'Italia exchange rates for Italian income tax. Kept apart from
 * ExchangeRatesService for the same reason as NbpRatesService: commercial
 * feeds with stale fallbacks are not the rate the instructions require.
 */
@Injectable()
export class BdiRatesService {
  private readonly logger = new Logger(BdiRatesService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly effects: EffectRuntime,
  ) {}

  /**
   * Daily rates from the previous December (so early January finds an earlier
   * day) and monthly averages for the tax year. NULL when Banca d'Italia has no
   * rate for the currency or cannot be reached.
   */
  async getYearRates(
    currency: string,
    taxYear: number,
    now: Date = new Date(),
  ): Promise<BdiRates | null> {
    const code = currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return null;
    }

    const cacheKey = `bdi:${code}:${taxYear}`;
    const cached = await this.cacheManager.get<BdiRates>(cacheKey);
    if (cached) {
      return cached;
    }

    const today = now.toISOString().slice(0, 10);
    const yearEnd = `${taxYear}-12-31`;
    const from = `${taxYear - 1}-12-01`;
    const to = yearEnd < today ? yearEnd : today;
    if (to < from) {
      return null;
    }
    const lastMonth = to.startsWith(String(taxYear)) ? Number(to.slice(5, 7)) : 0;
    const pair = `baseCurrencyIsoCode=${code}&currencyIsoCode=EUR&lang=en`;

    const rows = (url: string) =>
      getJson(url, BdiResponse, { timeout: REQUEST_TIMEOUT_MS }).pipe(
        Effect.map(body => body.rates ?? []),
      );
    const fetched = await this.effects.run(
      Effect.all([
        rows(`${BDI_API}/dailyTimeSeries?startDate=${from}&endDate=${to}&${pair}`),
        lastMonth > 0
          ? rows(
              `${BDI_API}/monthlyTimeSeries?startMonth=1&startYear=${taxYear}&endMonth=${lastMonth}&endYear=${taxYear}&${pair}`,
            )
          : Effect.succeed([]),
      ]).pipe(
        Effect.catch(error =>
          Effect.sync(() => {
            this.logger.warn(
              `Banca d'Italia rates for ${code} ${taxYear} unavailable: ${describeHttpFailure(error)}`,
            );
            return null;
          }),
        ),
      ),
    );
    if (!fetched) {
      return null;
    }

    const [dailyRows, monthlyRows] = fetched;
    const rates: BdiRates = { daily: [], monthly: {} };
    for (const row of dailyRows) {
      const perEuro = parseRate(row.avgRate);
      if (perEuro !== null) {
        rates.daily.push({ date: row.referenceDate, perEuro });
      }
    }
    for (const row of monthlyRows) {
      const perEuro = parseRate(row.avgRate);
      if (perEuro !== null) {
        rates.monthly[row.referenceDate] = perEuro;
      }
    }

    if (rates.daily.length === 0 && Object.keys(rates.monthly).length === 0) {
      return null;
    }
    rates.daily.sort((a, b) => a.date.localeCompare(b.date));

    // A finished year never changes; the current one gains a rate every business day.
    await this.cacheManager.set(cacheKey, rates, yearEnd < today ? 0 : 4 * 3600);
    return rates;
  }
}
