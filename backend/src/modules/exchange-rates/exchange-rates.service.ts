import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ExchangeRate } from '../../entities/exchange-rate.entity';
import { Transaction } from '../../entities/transaction.entity';
import { WorkspaceExchangeRate } from '../../entities/workspace-exchange-rate.entity';

/**
 * A rate and the day it was quoted for. `stale` marks a rate borrowed from an
 * earlier day because none was found for the requested one.
 */
export interface RateQuote {
  rate: number;
  rateDate: string;
  stale: boolean;
}

/** One point of a rate curve: the rate that applies from `date` onwards. */
export interface RatePoint {
  date: string;
  rate: number;
}

/** A quote on its way to becoming a curve point; `manual` decides precedence. */
interface RateCurveQuote {
  date: string;
  rate: number;
  manual: boolean;
}

export interface RateQuoteOptions {
  /** Refuse a borrowed rate quoted more than this many days before the requested day. */
  maxStaleDays?: number;
  /** Whose hand-entered rates apply; without it only provider rates are used. */
  workspaceId?: string;
}

const FALLBACK_CACHE_TTL_MS = 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

export interface ConvertResult {
  converted: number;
  rate: number;
  source: string;
}

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private readonly apiKey: string | undefined;
  private readonly apiBaseUrl = 'https://v6.exchangerate-api.com/v6';

  constructor(
    @InjectRepository(ExchangeRate)
    private readonly exchangeRateRepository: Repository<ExchangeRate>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    @Optional()
    @InjectRepository(Transaction)
    private readonly transactionRepository?: Repository<Transaction>,
    @Optional()
    @InjectRepository(WorkspaceExchangeRate)
    private readonly workspaceRateRepository?: Repository<WorkspaceExchangeRate>,
  ) {
    this.apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY');
  }

  async getRate(
    from: string,
    to: string,
    date?: Date | string,
    workspaceId?: string,
  ): Promise<number> {
    const rate = await this.getRateOrNull(from, to, date, workspaceId);
    if (rate === null) {
      this.logger.warn(
        `No rate found for ${this.normalizeCurrencyCode(from)}→${this.normalizeCurrencyCode(to)}, returning 1`,
      );
      return 1;
    }
    return rate;
  }

  /**
   * The same lookup chain as `getRate`, but NULL when no rate exists instead of 1.
   *
   * Tax figures need the difference: a silent 1 turns 1,000 USD into 1,000 EUR on
   * a declaration, where a missing rate can at least be reported to the user.
   */
  async getRateOrNull(
    from: string,
    to: string,
    date?: Date | string,
    workspaceId?: string,
  ): Promise<number | null> {
    const quote = await this.getRateQuote(from, to, date, { workspaceId });
    return quote ? quote.rate : null;
  }

  /**
   * The rate for `date`, or failing that the latest rate quoted on or before it.
   *
   * A rate from after the requested day is never used: converting a March
   * payment at a September rate would be silently wrong. `maxStaleDays` bounds
   * how far back the borrowed rate may be.
   */
  async getRateQuote(
    from: string,
    to: string,
    date?: Date | string,
    options: RateQuoteOptions = {},
  ): Promise<RateQuote | null> {
    const normalizedFrom = this.normalizeCurrencyCode(from);
    const normalizedTo = this.normalizeCurrencyCode(to);
    const rateDate = this.toDateOnly(date ?? new Date());

    if (normalizedFrom === normalizedTo) {
      return { rate: 1, rateDate, stale: false };
    }

    const manualWorkspace =
      options.workspaceId && (await this.hasManualRates(options.workspaceId))
        ? options.workspaceId
        : null;
    if (manualWorkspace) {
      const manual = await this.lookupManualRate(
        manualWorkspace,
        normalizedFrom,
        normalizedTo,
        rateDate,
      );
      if (manual !== null) {
        return { rate: manual, rateDate, stale: false };
      }
    }

    const stored = await this.lookupStoredRate(normalizedFrom, normalizedTo, rateDate);
    if (stored !== null) {
      return { rate: stored, rateDate, stale: false };
    }

    // A day already known to be missing skips the network until the cache expires.
    const cachedFallback = await this.lookupEarlierRateCached(
      normalizedFrom,
      normalizedTo,
      rateDate,
    );
    const fetched = cachedFallback
      ? null
      : await this.fetchRate(normalizedFrom, normalizedTo, rateDate);
    if (fetched !== null) {
      return { rate: fetched, rateDate, stale: false };
    }

    const providerQuote =
      cachedFallback ?? (await this.lookupEarlierRate(normalizedFrom, normalizedTo, rateDate));
    const manualQuote = manualWorkspace
      ? await this.findEarlierManualRate(manualWorkspace, normalizedFrom, normalizedTo, rateDate)
      : null;
    // The closer of the two to the requested day.
    const quote =
      [providerQuote, manualQuote]
        .filter((item): item is RateQuote => item !== null)
        .sort((a, b) => b.rateDate.localeCompare(a.rateDate))[0] ?? null;
    if (!quote) {
      return null;
    }
    const ageDays = Math.round(
      (new Date(rateDate).getTime() - new Date(quote.rateDate).getTime()) / DAY_MS,
    );
    if (options.maxStaleDays !== undefined && ageDays > options.maxStaleDays) {
      return null;
    }
    return quote;
  }

  /**
   * The rates that apply to `from`→`to` across `fromDate`..`toDate`, ascending,
   * with the last quote before the window carried in as its opening value.
   *
   * A report that needs a rate for every day of a multi-year window cannot
   * afford `getRateQuote` per day — that is a cache read, two table reads and
   * possibly a network call each. This is two reads per source instead, and
   * the caller forward-fills between the points. The quote for `toDate` still
   * goes through `getRateQuote`, so today's figure stays as fresh as it is on
   * the single-day path.
   */
  async getRateCurve(
    from: string,
    to: string,
    fromDate: string,
    toDate: string,
    workspaceId?: string,
  ): Promise<RatePoint[]> {
    const normalizedFrom = this.normalizeCurrencyCode(from);
    const normalizedTo = this.normalizeCurrencyCode(to);
    if (normalizedFrom === normalizedTo) {
      return [{ date: fromDate, rate: 1 }];
    }

    const quotes = await this.collectRateQuotes(normalizedFrom, normalizedTo, toDate, workspaceId);

    const curve: RatePoint[] = [];
    for (const quote of quotes) {
      const last = curve[curve.length - 1];
      if (last && last.date === quote.date) {
        last.rate = quote.rate;
      } else if (quote.date < fromDate) {
        // Everything before the window collapses into one opening point.
        curve.length = 0;
        curve.push({ date: fromDate, rate: quote.rate });
      } else {
        curve.push({ date: quote.date, rate: quote.rate });
      }
    }

    // The last day may only exist behind the network or the cache; everything
    // else is already on the curve, so a quote equal to the running one adds
    // nothing but a point.
    const fresh = await this.getRateQuote(normalizedFrom, normalizedTo, toDate, { workspaceId });
    const last = curve[curve.length - 1];
    if (fresh && fresh.rate !== last?.rate) {
      if (last && last.date === toDate) {
        last.rate = fresh.rate;
      } else {
        curve.push({ date: toDate, rate: fresh.rate });
      }
    }

    return curve;
  }

  /**
   * Every quote for the pair up to `toDate`, ascending, with the manual one
   * last inside a day so that it overwrites the provider's — the precedence
   * `getRateQuote` applies, expressed once for a whole window.
   */
  private async collectRateQuotes(
    normalizedFrom: string,
    normalizedTo: string,
    toDate: string,
    workspaceId?: string,
  ): Promise<RateCurveQuote[]> {
    const onOrBefore = LessThanOrEqual(new Date(toDate));
    const order = { rateDate: 'ASC' as const };
    const pair = (base: string, target: string) => ({
      baseCurrency: base,
      targetCurrency: target,
      rateDate: onOrBefore,
    });

    const [direct, reverse] = await Promise.all([
      this.exchangeRateRepository.find({ where: pair(normalizedFrom, normalizedTo), order }),
      this.exchangeRateRepository.find({ where: pair(normalizedTo, normalizedFrom), order }),
    ]);
    // Reverse first: a direct quote for the same day is the one worth keeping.
    const quotes = [
      ...this.toCurveQuotes(reverse, false, true),
      ...this.toCurveQuotes(direct, false, false),
    ];

    if (this.workspaceRateRepository && workspaceId && (await this.hasManualRates(workspaceId))) {
      const repository = this.workspaceRateRepository;
      const [manualDirect, manualReverse] = await Promise.all([
        repository.find({ where: { workspaceId, ...pair(normalizedFrom, normalizedTo) }, order }),
        repository.find({ where: { workspaceId, ...pair(normalizedTo, normalizedFrom) }, order }),
      ]);
      quotes.push(
        ...this.toCurveQuotes(manualReverse, true, true),
        ...this.toCurveQuotes(manualDirect, true, false),
      );
    }

    return quotes.sort(
      (a, b) => a.date.localeCompare(b.date) || Number(a.manual) - Number(b.manual),
    );
  }

  /** Rows as curve quotes, dropping anything that is not a usable rate. */
  private toCurveQuotes(
    rows: Array<{ rateDate: Date; rate: number }>,
    manual: boolean,
    invert: boolean,
  ): RateCurveQuote[] {
    return rows
      .map(row => ({ date: this.toDateOnly(row.rateDate), rate: Number(row.rate), manual }))
      .filter(quote => Number.isFinite(quote.rate) && quote.rate > 0)
      .map(quote => (invert ? { ...quote, rate: 1 / quote.rate } : quote));
  }

  private async lookupStoredRate(
    normalizedFrom: string,
    normalizedTo: string,
    rateDate: string,
  ): Promise<number | null> {
    const cacheKey = `exchange_rate:${normalizedFrom}:${normalizedTo}:${rateDate}`;

    // 1. Redis cache
    const cached = await this.cacheManager.get<number>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    // 2. Database
    const dbRate = await this.exchangeRateRepository.findOne({
      where: {
        baseCurrency: normalizedFrom,
        targetCurrency: normalizedTo,
        rateDate: new Date(rateDate),
      },
    });
    if (dbRate) {
      const ttl = this.isToday(rateDate) ? 4 * 3600 : 0; // 4h for today, permanent for historical
      await this.cacheManager.set(cacheKey, Number(dbRate.rate), ttl);
      return Number(dbRate.rate);
    }

    const reverseDbRate = await this.exchangeRateRepository.findOne({
      where: {
        baseCurrency: normalizedTo,
        targetCurrency: normalizedFrom,
        rateDate: new Date(rateDate),
      },
    });
    const reverseRate = Number(reverseDbRate?.rate);
    if (Number.isFinite(reverseRate) && reverseRate > 0) {
      const invertedRate = 1 / reverseRate;
      await this.cacheManager.set(cacheKey, invertedRate, this.isToday(rateDate) ? 4 * 3600 : 0);
      return invertedRate;
    }

    return null;
  }

  private async fetchRate(
    normalizedFrom: string,
    normalizedTo: string,
    rateDate: string,
  ): Promise<number | null> {
    const cacheKey = `exchange_rate:${normalizedFrom}:${normalizedTo}:${rateDate}`;

    // 3. Try to compute via USD base (e.g., EUR→KZT = (1/USD→EUR) * USD→KZT)
    if (normalizedFrom !== 'USD' && normalizedTo !== 'USD') {
      const rateFromUsd = await this.getRateFromApi('USD', normalizedFrom, rateDate);
      const rateToUsd = await this.getRateFromApi('USD', normalizedTo, rateDate);
      if (rateFromUsd && rateToUsd) {
        const crossRate = rateToUsd / rateFromUsd;
        await this.saveRate(normalizedFrom, normalizedTo, crossRate, rateDate, 'computed');
        await this.cacheManager.set(cacheKey, crossRate, this.isToday(rateDate) ? 4 * 3600 : 0);
        return crossRate;
      }
    }

    // 4. External API (direct)
    const apiRate = await this.getRateFromApi(normalizedFrom, normalizedTo, rateDate);
    if (apiRate) {
      await this.saveRate(normalizedFrom, normalizedTo, apiRate, rateDate, 'exchangerate-api');
      await this.cacheManager.set(cacheKey, apiRate, this.isToday(rateDate) ? 4 * 3600 : 0);
      return apiRate;
    }

    const publicApiRate = await this.getRateFromPublicApi(normalizedFrom, normalizedTo, rateDate);
    if (publicApiRate) {
      await this.saveRate(normalizedFrom, normalizedTo, publicApiRate, rateDate, 'currency-api');
      await this.cacheManager.set(cacheKey, publicApiRate, this.isToday(rateDate) ? 4 * 3600 : 0);
      return publicApiRate;
    }

    return null;
  }

  /**
   * 5. Fallback: the most recent stored rate on or before `rateDate`. Cached
   * briefly so a missing day does not repeat the network lookups on every call.
   */
  private async lookupEarlierRateCached(
    normalizedFrom: string,
    normalizedTo: string,
    rateDate: string,
  ): Promise<RateQuote | null> {
    const cached = await this.cacheManager.get<RateQuote>(
      this.fallbackCacheKey(normalizedFrom, normalizedTo, rateDate),
    );
    return cached ?? null;
  }

  private async lookupEarlierRate(
    normalizedFrom: string,
    normalizedTo: string,
    rateDate: string,
  ): Promise<RateQuote | null> {
    const cacheKey = this.fallbackCacheKey(normalizedFrom, normalizedTo, rateDate);
    const quote = await this.findEarlierStoredRate(normalizedFrom, normalizedTo, rateDate);
    if (quote) {
      this.logger.warn(
        `Using stale rate ${normalizedFrom}→${normalizedTo} from ${quote.rateDate} for ${rateDate}`,
      );
      await this.cacheManager.set(cacheKey, quote, FALLBACK_CACHE_TTL_MS);
    }
    return quote;
  }

  private fallbackCacheKey(normalizedFrom: string, normalizedTo: string, rateDate: string): string {
    return `exchange_rate_fallback:${normalizedFrom}:${normalizedTo}:${rateDate}`;
  }

  private async findEarlierStoredRate(
    normalizedFrom: string,
    normalizedTo: string,
    rateDate: string,
  ): Promise<RateQuote | null> {
    const onOrBefore = LessThanOrEqual(new Date(rateDate));
    const direct = await this.exchangeRateRepository.findOne({
      where: { baseCurrency: normalizedFrom, targetCurrency: normalizedTo, rateDate: onOrBefore },
      order: { rateDate: 'DESC' },
    });
    const reverse = await this.exchangeRateRepository.findOne({
      where: { baseCurrency: normalizedTo, targetCurrency: normalizedFrom, rateDate: onOrBefore },
      order: { rateDate: 'DESC' },
    });

    const candidates: RateQuote[] = [];
    const directRate = Number(direct?.rate);
    if (direct && Number.isFinite(directRate) && directRate > 0) {
      candidates.push({
        rate: directRate,
        rateDate: this.toDateOnly(direct.rateDate),
        stale: true,
      });
    }
    const reverseRate = Number(reverse?.rate);
    if (reverse && Number.isFinite(reverseRate) && reverseRate > 0) {
      candidates.push({
        rate: 1 / reverseRate,
        rateDate: this.toDateOnly(reverse.rateDate),
        stale: true,
      });
    }
    // The closer of the two to the requested day.
    candidates.sort((a, b) => b.rateDate.localeCompare(a.rateDate));
    return candidates[0] ?? null;
  }

  /**
   * A rate a workspace entered by hand for one day. It wins over the provider
   * for that day and is lent to later days without a rate, in that workspace
   * only. The same day entered for the reverse pair is replaced, so a pair has
   * one hand-entered rate per day.
   */
  async setManualRate(
    workspaceId: string,
    from: string,
    to: string,
    rate: number,
    date?: Date | string,
  ): Promise<{ from: string; to: string; rate: number; rateDate: string }> {
    if (!this.workspaceRateRepository) {
      throw new Error('Workspace exchange rates are not available');
    }
    const normalizedFrom = this.normalizeCurrencyCode(from);
    const normalizedTo = this.normalizeCurrencyCode(to);
    const rateDate = this.toDateOnly(date ?? new Date());
    await this.workspaceRateRepository.delete({
      workspaceId,
      baseCurrency: normalizedTo,
      targetCurrency: normalizedFrom,
      rateDate: new Date(rateDate),
    });
    await this.workspaceRateRepository.upsert(
      {
        workspaceId,
        baseCurrency: normalizedFrom,
        targetCurrency: normalizedTo,
        rate,
        rateDate: new Date(rateDate),
      },
      ['workspaceId', 'baseCurrency', 'targetCurrency', 'rateDate'],
    );
    await this.cacheManager.del(this.manualCountCacheKey(workspaceId));
    return { from: normalizedFrom, to: normalizedTo, rate, rateDate };
  }

  private manualCountCacheKey(workspaceId: string): string {
    return `exchange_rate_manual_count:${workspaceId}`;
  }

  /** Most workspaces never enter a rate; this keeps their lookups off the table. */
  private async hasManualRates(workspaceId: string): Promise<boolean> {
    if (!this.workspaceRateRepository) {
      return false;
    }
    const key = this.manualCountCacheKey(workspaceId);
    const cached = await this.cacheManager.get<number>(key);
    if (cached !== null && cached !== undefined) {
      return cached > 0;
    }
    const count = await this.workspaceRateRepository.count({ where: { workspaceId } });
    await this.cacheManager.set(key, count, FALLBACK_CACHE_TTL_MS);
    return count > 0;
  }

  private async lookupManualRate(
    workspaceId: string,
    normalizedFrom: string,
    normalizedTo: string,
    rateDate: string,
  ): Promise<number | null> {
    const repository = this.workspaceRateRepository as Repository<WorkspaceExchangeRate>;
    const day = new Date(rateDate);
    const direct = await repository.findOne({
      where: {
        workspaceId,
        baseCurrency: normalizedFrom,
        targetCurrency: normalizedTo,
        rateDate: day,
      },
    });
    const directRate = Number(direct?.rate);
    if (direct && Number.isFinite(directRate) && directRate > 0) {
      return directRate;
    }
    const reverse = await repository.findOne({
      where: {
        workspaceId,
        baseCurrency: normalizedTo,
        targetCurrency: normalizedFrom,
        rateDate: day,
      },
    });
    const reverseRate = Number(reverse?.rate);
    return reverse && Number.isFinite(reverseRate) && reverseRate > 0 ? 1 / reverseRate : null;
  }

  private async findEarlierManualRate(
    workspaceId: string,
    normalizedFrom: string,
    normalizedTo: string,
    rateDate: string,
  ): Promise<RateQuote | null> {
    const repository = this.workspaceRateRepository as Repository<WorkspaceExchangeRate>;
    const onOrBefore = LessThanOrEqual(new Date(rateDate));
    const order = { rateDate: 'DESC' as const };
    const direct = await repository.findOne({
      where: {
        workspaceId,
        baseCurrency: normalizedFrom,
        targetCurrency: normalizedTo,
        rateDate: onOrBefore,
      },
      order,
    });
    const reverse = await repository.findOne({
      where: {
        workspaceId,
        baseCurrency: normalizedTo,
        targetCurrency: normalizedFrom,
        rateDate: onOrBefore,
      },
      order,
    });
    const candidates: RateQuote[] = [];
    const directRate = Number(direct?.rate);
    if (direct && Number.isFinite(directRate) && directRate > 0) {
      candidates.push({
        rate: directRate,
        rateDate: this.toDateOnly(direct.rateDate),
        stale: true,
      });
    }
    const reverseRate = Number(reverse?.rate);
    if (reverse && Number.isFinite(reverseRate) && reverseRate > 0) {
      candidates.push({
        rate: 1 / reverseRate,
        rateDate: this.toDateOnly(reverse.rateDate),
        stale: true,
      });
    }
    candidates.sort((a, b) => b.rateDate.localeCompare(a.rateDate));
    return candidates[0] ?? null;
  }

  /**
   * Every currency the workspace's rows carry, with whether a rate to the
   * workspace currency exists. The dashboard and reports convert at 1.0 when
   * none does; this is where that becomes visible instead of silent.
   */
  async coverageForWorkspace(
    workspaceId: string,
    workspaceCurrency: string,
    sinceDays = 365,
  ): Promise<
    Array<{
      currency: string;
      rate: number | null;
      rateDate: string | null;
      stale: boolean;
      rows: number;
    }>
  > {
    if (!this.transactionRepository) return [];
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('UPPER(t.currency)', 'currency')
      .addSelect('COUNT(*)', 'rows')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.transactionDate >= :since', { since })
      .andWhere('t.currency IS NOT NULL')
      .groupBy('UPPER(t.currency)')
      .getRawMany<{ currency: string; rows: string }>();
    const target = this.normalizeCurrencyCode(workspaceCurrency);
    const result = [];
    for (const row of rows) {
      const currency = this.normalizeCurrencyCode(row.currency);
      if (currency === target) continue;
      const quote = await this.getRateQuote(currency, target, new Date(), { workspaceId });
      result.push({
        currency,
        rate: quote?.rate ?? null,
        rateDate: quote?.rateDate ?? null,
        stale: quote?.stale ?? false,
        rows: Number(row.rows),
      });
    }
    return result.sort(
      (a, b) => Number(a.rate !== null) - Number(b.rate !== null) || b.rows - a.rows,
    );
  }

  async convert(
    amount: number,
    from: string,
    to: string,
    date?: Date | string,
    workspaceId?: string,
  ): Promise<ConvertResult> {
    const rate = await this.getRate(from, to, date, workspaceId);
    return { converted: amount * rate, rate, source: 'exchange-rates-service' };
  }

  async bulkConvert(
    items: Array<{ amount: number; currency: string; date?: Date | string }>,
    targetCurrency: string,
    workspaceId?: string,
  ): Promise<ConvertResult[]> {
    return Promise.all(
      items.map(item =>
        this.convert(item.amount, item.currency, targetCurrency, item.date, workspaceId),
      ),
    );
  }

  async fetchAndCacheRates(baseCurrency = 'USD'): Promise<void> {
    if (!this.apiKey) {
      this.logger.debug('EXCHANGE_RATE_API_KEY not set, skipping rate fetch');
      return;
    }

    try {
      const url = `${this.apiBaseUrl}/${this.apiKey}/latest/${baseCurrency.toUpperCase()}`;
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Exchange rate API returned ${response.status}`);
        return;
      }

      const data = (await response.json()) as {
        result: string;
        conversion_rates: Record<string, number>;
      };

      if (data.result !== 'success') {
        this.logger.warn('Exchange rate API response was not successful');
        return;
      }

      const today = this.toDateOnly(new Date());
      const base = baseCurrency.toUpperCase();

      for (const [target, rate] of Object.entries(data.conversion_rates)) {
        await this.saveRate(base, target, rate, today, 'exchangerate-api');
      }

      this.logger.log(
        `Fetched and cached ${Object.keys(data.conversion_rates).length} rates for ${base}`,
      );
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates', error);
    }
  }

  private async getRateFromApi(from: string, to: string, rateDate: string): Promise<number | null> {
    // Only the latest rates are on our tier (the historical endpoint needs a
    // higher one), and storing them under a past date would fix a wrong rate
    // there for good: saveRate never overwrites.
    if (!(this.apiKey && this.isToday(rateDate))) {
      return null;
    }

    try {
      const url = `${this.apiBaseUrl}/${this.apiKey}/latest/${from}`;
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        result: string;
        conversion_rates: Record<string, number>;
      };

      if (data.result !== 'success' || !data.conversion_rates[to]) {
        return null;
      }

      const rate = data.conversion_rates[to];
      // Cache all rates from this response to avoid repeated API calls
      for (const [target, targetRate] of Object.entries(data.conversion_rates)) {
        await this.saveRate(from, target, targetRate, rateDate, 'exchangerate-api').catch(() => {});
      }

      return rate;
    } catch {
      return null;
    }
  }

  private async getRateFromPublicApi(
    from: string,
    to: string,
    rateDate: string,
  ): Promise<number | null> {
    for (const url of this.buildPublicCurrencyApiUrls(from, rateDate)) {
      const rate = await this.fetchPublicCurrencyRate(url, to);
      if (rate) {
        return rate;
      }
    }
    return null;
  }

  private buildPublicCurrencyApiUrls(from: string, rateDate: string): string[] {
    const datePath = this.isToday(rateDate) ? 'latest' : rateDate;
    const fromCode = from.toLowerCase();
    const endpoint = `v1/currencies/${fromCode}.json`;
    return [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${datePath}/${endpoint}`,
      `https://${datePath}.currency-api.pages.dev/${endpoint}`,
    ];
  }

  private async fetchPublicCurrencyRate(url: string, to: string): Promise<number | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const targetKey = to.toLowerCase();
      const data = (await response.json()) as Record<string, unknown>;
      const baseKey = this.extractBaseCurrencyFromPublicCurrencyUrl(url);
      const rates = baseKey ? data[baseKey] : undefined;
      const rate =
        rates && typeof rates === 'object' && !Array.isArray(rates)
          ? (rates as Record<string, unknown>)[targetKey]
          : data[targetKey];
      return typeof rate === 'number' && Number.isFinite(rate) ? rate : null;
    } catch {
      return null;
    }
  }

  private extractBaseCurrencyFromPublicCurrencyUrl(url: string): string | null {
    const match = url.match(/\/currencies\/([a-z]{3})\.json$/i);
    return match ? match[1].toLowerCase() : null;
  }

  private async saveRate(
    from: string,
    to: string,
    rate: number,
    rateDate: string | Date,
    source: string,
  ): Promise<void> {
    const dateStr = typeof rateDate === 'string' ? rateDate : this.toDateOnly(rateDate);
    await this.exchangeRateRepository
      .createQueryBuilder()
      .insert()
      .into(ExchangeRate)
      .values({
        baseCurrency: from,
        targetCurrency: to,
        rate,
        rateDate: new Date(dateStr),
        source,
      })
      .orIgnore()
      .execute();
  }

  /**
   * Accepts a string as well as a Date.
   *
   * TypeORM hands back a plain 'YYYY-MM-DD' string for a `type: 'date'` column,
   * never a Date — and Transaction.transactionDate is declared `Date`, so the
   * annotation lies and TypeScript could not catch it. Calling .toISOString()
   * on that string threw, and the whole transactions list came back 500 as soon
   * as a currency conversion was requested.
   */
  private toDateOnly(date: Date | string): string {
    if (typeof date === 'string') {
      const dateOnly = /^\d{4}-\d{2}-\d{2}/.exec(date);
      if (dateOnly) {
        return dateOnly[0];
      }
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime())
        ? new Date().toISOString().split('T')[0]
        : parsed.toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  }

  private normalizeCurrencyCode(currency: string): string {
    const normalized = currency.toUpperCase().trim();
    if (normalized === 'NIS' || normalized === '\u20aa') {
      return 'ILS';
    }
    return normalized;
  }

  private isToday(dateStr: string): boolean {
    return dateStr === this.toDateOnly(new Date());
  }
}
