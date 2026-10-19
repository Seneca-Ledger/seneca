import { createHash } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Effect } from 'effect';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { contentTypeOf, getWith } from '../../common/effect/http-json';
import { isValidVendorDomain } from './vendor-domain.util';

export type VendorIconResult =
  | { status: 'ok'; body: Buffer; contentType: string }
  | { status: 'invalid' }
  | { status: 'missing' }
  | { status: 'unavailable' };

type CachedIcon = { contentType: string; body: string } | { miss: true };

const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 3000;
const MAX_BYTES = 64 * 1024;

/**
 * Rasters only. An SVG from an untrusted origin can carry script, and this
 * response is served from our own origin.
 */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
]);

/**
 * Brand icons for subscription vendors, fetched by domain and cached in Redis.
 *
 * Going through the API rather than letting the browser hit the icon host keeps
 * the CSP at `img-src 'self'` and hides the reader's IP. The vendor domains
 * themselves are still visible to the icon provider — that is the cost of not
 * bundling a logo for every company in the world.
 */
@Injectable()
export class VendorIconsService {
  private readonly logger = new Logger(VendorIconsService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly effects: EffectRuntime,
  ) {}

  async fetchIcon(rawDomain: string): Promise<VendorIconResult> {
    const domain = rawDomain.trim().toLowerCase();
    // Validated before any egress: the domain only ever becomes a path segment
    // on a fixed host, never a host of its own.
    if (!isValidVendorDomain(domain)) {
      return { status: 'invalid' };
    }

    const cacheKey = `vendor-icon:v1:${createHash('sha256').update(domain).digest('hex')}`;
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

    const result = await this.fetchUpstream(domain);
    if (result.status === 'ok') {
      await this.writeCache(
        cacheKey,
        { contentType: result.contentType, body: result.body.toString('base64') },
        HIT_TTL_MS,
      );
    } else if (result.status === 'missing') {
      await this.writeCache(cacheKey, { miss: true }, MISS_TTL_MS);
    }
    // 'unavailable' is deliberately not cached: a timeout today should not hide
    // the icon for a week.
    return result;
  }

  private fetchUpstream(domain: string): Promise<VendorIconResult> {
    // A fixed host, not user input: no SSRF surface, so no egress guard.
    const url = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    const logger = this.logger;
    return this.effects.run<VendorIconResult, never>(
      getWith(url, { timeout: TIMEOUT_MS }, response =>
        Effect.gen(function* () {
          // A real 404 is what makes negative caching honest; providers that answer
          // 200 with a placeholder globe would poison the cache instead.
          if (response.status === 404) {
            return { status: 'missing' } as const;
          }
          if (response.status < 200 || response.status >= 300) {
            logger.warn(`Vendor icon request failed: http_${response.status}`);
            return { status: 'unavailable' } as const;
          }
          const contentType = contentTypeOf(response);
          if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
            logger.warn(`Vendor icon rejected: content_type_${contentType || 'none'}`);
            return { status: 'unavailable' } as const;
          }
          const body = Buffer.from(yield* response.arrayBuffer);
          if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
            logger.warn(`Vendor icon rejected: size_${body.byteLength}`);
            return { status: 'unavailable' } as const;
          }
          return { status: 'ok', body, contentType } as const;
        }),
      ).pipe(
        Effect.catch(error =>
          Effect.sync((): VendorIconResult => {
            logger.warn(
              `Vendor icon request failed: ${error._tag === 'TimeoutError' ? 'timeout' : 'network'}`,
            );
            return { status: 'unavailable' };
          }),
        ),
      ),
    );
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
