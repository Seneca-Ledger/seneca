import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Effect } from 'effect';
import type { Repository } from 'typeorm';
import { ExchangeRate } from '../../entities/exchange-rate.entity';
import { COINGECKO_IDS } from './crypto.constants';
import { ATTEMPT_TIMEOUT_MS, requestWithRetry } from './retry.util';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const PRICE_SOURCE = 'coingecko';

/**
 * CoinGecko's free tier answers five calls a minute and then returns 429 with
 * `Retry-After: 60`. Asking for one date at a time meant a wallet with more than a
 * handful of transfer dates ran out of budget mid-sync, so `primeHistoricalPrices`
 * pulls a whole date range per asset in a single call instead.
 */
/** The provider has the price but would not serve it right now — a retry may work. */
export class PriceUnavailableError extends Error {}

/**
 * Prices crypto assets in USD.
 *
 * Rates land in the existing `exchange_rates` table — it is keyed by an opaque
 * currency pair and a date, which describes `ETH → USD on 2026-08-21` exactly as
 * well as it describes `EUR → USD`. That also makes the cache permanent for past
 * dates: a historical price never changes, so each asset costs one API call ever.
 *
 * An asset missing from `COINGECKO_IDS` prices as `null` rather than zero, and the
 * sync drops it. That is the spam filter: airdropped scam tokens are unpriceable,
 * and counting them at face value would invent income the user never received.
 */
@Injectable()
export class CryptoPriceService {
  private readonly logger = new Logger(CryptoPriceService.name);

  constructor(
    @InjectRepository(ExchangeRate)
    private readonly exchangeRateRepo: Repository<ExchangeRate>,
  ) {}

  /**
   * Caches every daily price the given assets had over the window, one request per
   * asset. Call this before pricing a batch of transfers: without it each distinct
   * date costs its own request and the rate limit eats the rest of the sync.
   */
  async primeHistoricalPrices(assets: string[], from: Date, to: Date): Promise<void> {
    const tickers = [...new Set(assets.map(asset => asset.toUpperCase()))].filter(
      ticker => COINGECKO_IDS[ticker],
    );

    for (const ticker of tickers) {
      const prices = await this.fetchPriceRange(COINGECKO_IDS[ticker], from, to);
      await this.savePrices(ticker, prices);
    }
  }

  /**
   * USD price of one unit of `asset` on `date`, or null when the asset has no price
   * at all — it is absent from `COINGECKO_IDS`, or the provider has no data for that
   * day. Throws `PriceUnavailableError` when the price exists but could not be
   * fetched, so a rate-limited lookup fails the sync instead of silently dropping
   * the transfer it was pricing.
   */
  async getUsdPrice(asset: string, date: Date): Promise<number | null> {
    const ticker = asset.toUpperCase();
    const coingeckoId = COINGECKO_IDS[ticker];
    if (!coingeckoId) {
      return null;
    }

    const dateOnly = toDateOnly(date);
    const cached = await this.exchangeRateRepo.findOne({
      where: { baseCurrency: ticker, targetCurrency: 'USD', rateDate: new Date(dateOnly) },
    });
    if (cached) {
      return Number(cached.rate);
    }

    const price = await this.fetchHistoricalPrice(coingeckoId, dateOnly);
    if (price === null) {
      return null;
    }

    await this.savePrice(ticker, price, dateOnly);
    return price;
  }

  /** Latest USD prices for several assets in one request. Unpriceable ones are absent. */
  async getCurrentUsdPrices(assets: string[]): Promise<Record<string, number>> {
    const tickers = [...new Set(assets.map(asset => asset.toUpperCase()))].filter(
      ticker => COINGECKO_IDS[ticker],
    );
    if (tickers.length === 0) {
      return {};
    }

    const idsByTicker = new Map(tickers.map(ticker => [COINGECKO_IDS[ticker], ticker]));
    const url = `${COINGECKO_BASE_URL}/simple/price?ids=${[...idsByTicker.keys()].join(',')}&vs_currencies=usd`;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
      if (!response.ok) {
        this.logger.warn(`CoinGecko simple/price returned ${response.status}`);
        return this.getLastKnownPrices(tickers);
      }

      const data = (await response.json()) as Record<string, { usd?: number }>;
      const prices: Record<string, number> = {};
      const today = toDateOnly(new Date());

      for (const [coingeckoId, ticker] of idsByTicker) {
        const price = data[coingeckoId]?.usd;
        if (typeof price === 'number' && Number.isFinite(price)) {
          prices[ticker] = price;
          await this.savePrice(ticker, price, today);
        }
      }

      const missing = tickers.filter(ticker => prices[ticker] === undefined);
      return { ...(await this.getLastKnownPrices(missing)), ...prices };
    } catch (error) {
      this.logger.warn(`CoinGecko simple/price failed: ${String(error)}`);
      return this.getLastKnownPrices(tickers);
    }
  }

  private async fetchHistoricalPrice(
    coingeckoId: string,
    dateOnly: string,
  ): Promise<number | null> {
    // CoinGecko's history endpoint wants DD-MM-YYYY, unlike every other date we handle.
    const [year, month, day] = dateOnly.split('-');
    const response = await this.request(
      `${COINGECKO_BASE_URL}/coins/${coingeckoId}/history?date=${day}-${month}-${year}&localization=false`,
      `history for ${coingeckoId} on ${dateOnly}`,
    );
    if (response === null) {
      return null;
    }

    const data = (await response.json()) as {
      market_data?: { current_price?: { usd?: number } };
    };
    const price = data.market_data?.current_price?.usd;
    return typeof price === 'number' && Number.isFinite(price) ? price : null;
  }

  /** Daily USD prices over the window, keyed by `YYYY-MM-DD`. */
  private async fetchPriceRange(
    coingeckoId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    const params = new URLSearchParams({
      vs_currency: 'usd',
      from: String(Math.floor(from.getTime() / 1000)),
      to: String(Math.floor(to.getTime() / 1000)),
    });
    const response = await this.request(
      `${COINGECKO_BASE_URL}/coins/${coingeckoId}/market_chart/range?${params.toString()}`,
      `price range for ${coingeckoId}`,
    );
    if (response === null) {
      return new Map();
    }

    const data = (await response.json()) as { prices?: [number, number][] };
    const byDate = new Map<string, number>();

    // Short windows come back hourly rather than daily, so the first point of each
    // UTC day wins and the rest of that day is ignored.
    for (const [timestamp, price] of data.prices ?? []) {
      if (!Number.isFinite(price)) {
        continue;
      }
      const dateOnly = toDateOnly(new Date(timestamp));
      if (!byDate.has(dateOnly)) {
        byDate.set(dateOnly, price);
      }
    }

    return byDate;
  }

  /**
   * Returns the response, or null when the provider genuinely has nothing for us.
   * Retries a refusal it describes as temporary and throws once the attempts run
   * out — the caller must not mistake "we could not ask" for "there is no price".
   */
  private request(url: string, description: string): Promise<Response | null> {
    return Effect.runPromise(
      requestWithRetry(url, {}, (status, wait) =>
        this.logger.warn(
          `CoinGecko ${description} returned ${status ?? 'no response'}, retrying in ${wait}ms`,
        ),
      ).pipe(
        Effect.catchTags({
          // A 4xx that is not a rate limit is an answer: this coin or date has no price.
          ProviderAnswered: error =>
            Effect.sync(() => {
              this.logger.warn(`CoinGecko ${description} returned ${error.status}`);
              return null;
            }),
          ProviderUnavailable: error =>
            Effect.fail(
              new PriceUnavailableError(
                `CoinGecko ${description} unavailable after ${error.attempts} attempt(s)` +
                  `${error.status === undefined ? '' : ` (HTTP ${error.status})`}`,
              ),
            ),
        }),
      ),
    );
  }

  private async savePrices(ticker: string, prices: Map<string, number>): Promise<void> {
    if (prices.size === 0) {
      return;
    }

    await this.exchangeRateRepo
      .createQueryBuilder()
      .insert()
      .into(ExchangeRate)
      .values(
        [...prices].map(([dateOnly, price]) => ({
          baseCurrency: ticker,
          targetCurrency: 'USD',
          rate: price,
          rateDate: new Date(dateOnly),
          source: PRICE_SOURCE,
        })),
      )
      .orIgnore()
      .execute();
  }

  /**
   * Fallback when CoinGecko is unreachable: the most recent price we ever stored.
   * A stale portfolio value beats a portfolio that reads as zero.
   */
  private async getLastKnownPrices(tickers: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    for (const ticker of tickers) {
      const latest = await this.exchangeRateRepo.findOne({
        where: { baseCurrency: ticker, targetCurrency: 'USD' },
        order: { rateDate: 'DESC' },
      });
      if (latest) {
        prices[ticker] = Number(latest.rate);
      }
    }
    return prices;
  }

  private async savePrice(ticker: string, price: number, dateOnly: string): Promise<void> {
    await this.exchangeRateRepo
      .createQueryBuilder()
      .insert()
      .into(ExchangeRate)
      .values({
        baseCurrency: ticker,
        targetCurrency: 'USD',
        rate: price,
        rateDate: new Date(dateOnly),
        source: PRICE_SOURCE,
      })
      .orIgnore()
      .execute();
  }
}

function toDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}
