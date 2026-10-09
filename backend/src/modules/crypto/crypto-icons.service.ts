import { createHash } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { COINGECKO_IDS } from './crypto.constants';

export type CryptoIconResult =
  | { status: 'ok'; body: Buffer; contentType: string }
  | { status: 'invalid' }
  | { status: 'missing' }
  | { status: 'unavailable' };

type CachedIcon = { contentType: string; body: string } | { miss: true };

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
/** Where CoinGecko serves the logos themselves; nothing else is ever fetched. */
const IMAGE_HOSTS = new Set(['assets.coingecko.com', 'coin-images.coingecko.com']);

/** A logo changes about never, a missing one may appear when a coin is listed. */
const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 4000;
const MAX_BYTES = 128 * 1024;
const TICKER_PATTERN = /^[A-Za-z0-9.$]{2,20}$/;

/**
 * Rasters only. An SVG from an untrusted origin can carry script, and this
 * response is served from our own origin.
 */
const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * The real logo of a coin, fetched from CoinGecko and cached.
 *
 * Nothing about the logos is kept in the repository: a coin we can price is a
 * coin whose logo we can fetch, so a ticker added to `COINGECKO_IDS` — or a new
 * one the exchange's export mentions — arrives with its mark and never needs a
 * file committed or refreshed. A ticker CoinGecko does not know answers 404,
 * which is what makes the page fall back to the monogram.
 *
 * Going through the API rather than letting the browser hit CoinGecko keeps the
 * CSP at `img-src 'self'` and hides the reader's IP, the same way vendor icons do.
 */
@Injectable()
export class CryptoIconsService {
  private readonly logger = new Logger(CryptoIconsService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async fetchIcon(rawAsset: string): Promise<CryptoIconResult> {
    const ticker = rawAsset.trim().toUpperCase();
    // Validated before any egress: the ticker only ever becomes a query value on
    // a fixed host, never a host of its own.
    if (!TICKER_PATTERN.test(ticker)) {
      return { status: 'invalid' };
    }

    const cacheKey = `crypto-icon:v1:${createHash('sha256').update(ticker).digest('hex')}`;
    const cached = await this.readCache(cacheKey);
    if (cached) {
      return 'miss' in cached
        ? { status: 'missing' }
        : {
            status: 'ok',
            body: Buffer.from(cached.body, 'base64'),
            contentType: cached.contentType,
          };
    }

    const result = await this.fetchUpstream(ticker);
    if (result.status === 'ok') {
      await this.writeCache(
        cacheKey,
        { contentType: result.contentType, body: result.body.toString('base64') },
        HIT_TTL_MS,
      );
    } else if (result.status === 'missing') {
      await this.writeCache(cacheKey, { miss: true }, MISS_TTL_MS);
    }
    // 'unavailable' is deliberately not cached: a rate limit today should not
    // hide the logo for a month.
    return result;
  }

  private async fetchUpstream(ticker: string): Promise<CryptoIconResult> {
    const imageUrl = await this.resolveImageUrl(ticker);
    if (imageUrl === null) {
      return { status: 'missing' };
    }
    if (imageUrl === 'unavailable') {
      return { status: 'unavailable' };
    }
    return this.download(imageUrl);
  }

  /**
   * The logo's address. The coin is looked up by the id we already price it by;
   * a ticker outside that table is searched for, so a coin that only ever turns
   * up in an exchange export still gets its mark.
   */
  private async resolveImageUrl(ticker: string): Promise<string | null | 'unavailable'> {
    const knownId = COINGECKO_IDS[ticker];
    if (knownId) {
      const url = await this.imageUrlById(knownId);
      if (url !== null) {
        return url;
      }
    }
    return this.imageUrlBySearch(ticker);
  }

  private async imageUrlById(id: string): Promise<string | null | 'unavailable'> {
    const data = await this.getJson<{ image?: string }[]>(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}`,
    );
    if (data === 'unavailable') {
      return 'unavailable';
    }
    return data?.[0]?.image ?? null;
  }

  private async imageUrlBySearch(ticker: string): Promise<string | null | 'unavailable'> {
    const data = await this.getJson<{
      coins?: { symbol?: string; large?: string; thumb?: string }[];
    }>(`${COINGECKO_API}/search?query=${encodeURIComponent(ticker)}`);
    if (data === 'unavailable') {
      return 'unavailable';
    }
    // The search is fuzzy, so only an exact ticker counts: asking for "OP" must
    // not come back with the logo of whatever else matched the letters.
    const match = data?.coins?.find(coin => coin.symbol?.toUpperCase() === ticker);
    return match?.large ?? match?.thumb ?? null;
  }

  private async download(url: string): Promise<CryptoIconResult> {
    // The address comes from CoinGecko's answer, so it is checked against the
    // hosts that serve the logos before anything is fetched from it.
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return { status: 'missing' };
    }
    if (!IMAGE_HOSTS.has(host)) {
      this.logger.warn(`Crypto icon rejected: host_${host}`);
      return { status: 'missing' };
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 404) {
        return { status: 'missing' };
      }
      if (!response.ok) {
        this.logger.warn(`Crypto icon request failed: http_${response.status}`);
        return { status: 'unavailable' };
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        this.logger.warn(`Crypto icon rejected: content_type_${contentType || 'none'}`);
        return { status: 'unavailable' };
      }

      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
        this.logger.warn(`Crypto icon rejected: size_${body.byteLength}`);
        return { status: 'unavailable' };
      }

      return { status: 'ok', body, contentType };
    } catch (error) {
      return { status: this.networkFailure(error) };
    }
  }

  private async getJson<T>(url: string): Promise<T | null | 'unavailable'> {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        // 429 included: the free tier is small, and the caller must not cache a
        // rate limit as "this coin has no logo".
        this.logger.warn(`CoinGecko icon lookup failed: http_${response.status}`);
        return 'unavailable';
      }
      return (await response.json()) as T;
    } catch (error) {
      this.networkFailure(error);
      return 'unavailable';
    }
  }

  private networkFailure(error: unknown): 'unavailable' {
    const name = error instanceof Error ? error.name : '';
    this.logger.warn(
      `Crypto icon request failed: ${
        name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network'
      }`,
    );
    return 'unavailable';
  }

  private async readCache(key: string): Promise<CachedIcon | null> {
    try {
      return (await this.cacheManager.get<CachedIcon>(key)) ?? null;
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, value: CachedIcon, ttlMs: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlMs);
    } catch {
      // A cache outage only costs a repeated upstream request.
    }
  }
}
