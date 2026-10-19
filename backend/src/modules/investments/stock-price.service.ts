import { Injectable, Logger } from '@nestjs/common';
import { assertPublicEgressUrl } from '../../common/utils/egress-url.util';

export interface QuotedPrice {
  symbol: string;
  price: number;
  currency: string;
  at: Date;
}

/** Stooq's daily quote CSV: `Symbol,Date,Time,Open,High,Low,Close,Volume`, `N/D` when unknown. */
export function parseStooqCsv(csv: string): Map<string, { close: number; date: string }> {
  const result = new Map<string, { close: number; date: string }>();
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0]?.toLowerCase().split(',') ?? [];
  const symbolIndex = header.indexOf('symbol');
  const closeIndex = header.indexOf('close');
  const dateIndex = header.indexOf('date');
  if (symbolIndex < 0 || closeIndex < 0) return result;
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const close = Number.parseFloat(cells[closeIndex] ?? '');
    const symbol = (cells[symbolIndex] ?? '').trim().toUpperCase();
    if (!(symbol && Number.isFinite(close)) || close <= 0) continue;
    result.set(symbol, { close, date: cells[dateIndex] ?? '' });
  }
  return result;
}

/** `AAPL` → `AAPL.US`; a symbol that already names its market is kept. */
export function normalizeStockSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  return trimmed.includes('.') ? trimmed : `${trimmed}.US`;
}

/** The currency a market quotes in, by Stooq's suffix. */
export function currencyForSymbol(symbol: string): string {
  const suffix = symbol.split('.').pop()?.toUpperCase() ?? 'US';
  return SUFFIX_CURRENCY[suffix] ?? 'USD';
}

const SUFFIX_CURRENCY: Record<string, string> = {
  US: 'USD',
  UK: 'GBP',
  DE: 'EUR',
  F: 'EUR',
  FR: 'EUR',
  NL: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  PL: 'PLN',
  JP: 'JPY',
  HK: 'HKD',
  CA: 'CAD',
  AU: 'AUD',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  TR: 'TRY',
  KZ: 'KZT',
};

const STOOQ_URL = 'https://stooq.com/q/l/';
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Daily close prices from Stooq, a free source that needs no key. Quotes are
 * cached for fifteen minutes; the host is checked against the egress guard
 * like every other outbound call. A price that cannot be fetched is simply
 * absent, and the holding keeps the one it had.
 */
@Injectable()
export class StockPriceService {
  private readonly logger = new Logger(StockPriceService.name);
  private readonly cache = new Map<string, QuotedPrice>();

  async getPrices(symbols: string[]): Promise<Map<string, QuotedPrice>> {
    const wanted = [...new Set(symbols.map(normalizeStockSymbol))];
    const result = new Map<string, QuotedPrice>();
    const stale: string[] = [];
    const now = Date.now();
    for (const symbol of wanted) {
      const cached = this.cache.get(symbol);
      if (cached && now - cached.at.getTime() < CACHE_TTL_MS) {
        result.set(symbol, cached);
      } else {
        stale.push(symbol);
      }
    }
    if (stale.length === 0) return result;

    const url = `${STOOQ_URL}?s=${stale.map(s => s.toLowerCase()).join('+')}&f=sd2t2ohlcv&h&e=csv`;
    try {
      await assertPublicEgressUrl(url);
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        this.logger.warn(`Stooq returned ${response.status}`);
        return result;
      }
      const quotes = parseStooqCsv(await response.text());
      for (const [symbol, quote] of quotes) {
        const priced: QuotedPrice = {
          symbol,
          price: quote.close,
          currency: currencyForSymbol(symbol),
          at: new Date(),
        };
        this.cache.set(symbol, priced);
        result.set(symbol, priced);
      }
    } catch (error) {
      this.logger.warn(`Stooq quote failed: ${String(error)}`);
    }
    return result;
  }
}
