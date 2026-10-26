import { createHash } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { Effect } from 'effect';
import { APP_NAME } from '../../common/brand';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { getWith } from '../../common/effect/http-json';
import { isValidCoordinatePair } from '../../common/utils/capture-location.util';

export type GeoPoint = { lat: number; lng: number };

export type NearbyPlace = GeoPoint & {
  name: string;
  /** OSM tag key and value, e.g. shop / supermarket. */
  category: string;
  type: string;
  address: string | null;
  /** Town, city or village the place is in. */
  locality: string | null;
  osmType: string;
  osmId: string;
};

export type NearbySearch = GeoPoint & {
  radiusM: number;
  /** Free text matched against place names, e.g. the vendor from the receipt. */
  name?: string;
  /**
   * A special phrase from infra/nominatim/special-phrases.csv. Nominatim only
   * knows the phrases that were imported, so an unknown one finds nothing.
   */
  placeType?: string;
};

type CachedGeocode = GeoPoint | { miss: true };

type RawPlace = {
  lat?: unknown;
  lon?: unknown;
  name?: unknown;
  category?: unknown;
  type?: unknown;
  osm_type?: unknown;
  osm_id?: unknown;
  address?: Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 3000;
const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_ADDRESS_LENGTH = 5;
const NEARBY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEARBY_LIMIT = '20';
const METRES_PER_DEGREE = 111_320;

/**
 * Address → point, and places near a point, through a self-hosted Nominatim.
 * Optional: with no GEOCODER_URL every call returns nothing and receipts fall
 * back to the photo or device location. Never throws, and never logs the
 * address or coordinates it was given.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly baseUrl: string | null;
  private readonly timeoutMs: number;

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    configService: ConfigService,
    private readonly effects: EffectRuntime,
  ) {
    this.baseUrl = this.resolveBaseUrl(configService.get<string>('GEOCODER_URL'));
    const timeout = Number(configService.get<string>('GEOCODER_TIMEOUT_MS'));
    this.timeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
  }

  async geocode(address: string): Promise<GeoPoint | null> {
    if (!this.baseUrl) {
      return null;
    }

    const normalized = address.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.length < MIN_ADDRESS_LENGTH) {
      return null;
    }

    // Hashed so plaintext addresses never sit in Redis key listings.
    const cacheKey = `geocode:v1:${createHash('sha256').update(normalized).digest('hex')}`;
    const cached = await this.readCache(cacheKey);
    if (cached) {
      return 'miss' in cached ? null : cached;
    }

    const result = await this.request(normalized);
    // Only a definite "no match" is remembered. A timeout or 5xx says nothing
    // about the address, and caching it would hide every receipt for a day.
    if (result !== 'error') {
      await this.writeCache(cacheKey, result ?? { miss: true }, result ? HIT_TTL_MS : MISS_TTL_MS);
    }
    return result === 'error' ? null : result;
  }

  /**
   * Named places inside a box around the point, in Nominatim's order. The
   * caller ranks them. The centre is snapped to ~100 m so neighbouring fixes
   * share a cache entry; the radius should leave room for that.
   */
  async searchNearby(search: NearbySearch): Promise<NearbyPlace[]> {
    const name = search.name?.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!(this.baseUrl && (name || search.placeType))) {
      return [];
    }
    if (!isValidCoordinatePair(search.lat, search.lng)) {
      return [];
    }

    const lat = Math.round(search.lat * 1e3) / 1e3;
    const lng = Math.round(search.lng * 1e3) / 1e3;
    const radiusM = Math.round(search.radiusM);
    const params: Record<string, string> = {
      viewbox: this.viewbox(lat, lng, radiusM),
      bounded: '1',
      addressdetails: '1',
      limit: NEARBY_LIMIT,
    };
    if (name) {
      params.q = name;
    } else {
      params.amenity = search.placeType as string;
    }

    // Hashed: the key would otherwise spell out where the user has been.
    const fingerprint = [lat, lng, radiusM, name ?? '', search.placeType ?? ''].join('|');
    const cacheKey = `nearby:v1:${createHash('sha256').update(fingerprint).digest('hex')}`;
    const cached = await this.readCache<NearbyPlace[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const body = await this.search(params);
    if (body === 'error') {
      return [];
    }

    const places = body
      .map(raw => this.toNearbyPlace(raw as RawPlace))
      .filter((place): place is NearbyPlace => place !== null);
    await this.writeCache(cacheKey, places, NEARBY_TTL_MS);
    return places;
  }

  private viewbox(lat: number, lng: number, radiusM: number): string {
    const dLat = radiusM / METRES_PER_DEGREE;
    const dLng = radiusM / (METRES_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
    const round = (value: number) => value.toFixed(5);
    return [lng - dLng, lat + dLat, lng + dLng, lat - dLat].map(round).join(',');
  }

  // Unnamed objects (a bench, an anonymous restaurant) cannot be picked from a list.
  private toNearbyPlace(raw: RawPlace): NearbyPlace | null {
    const lat = Number(raw.lat);
    const lng = Number(raw.lon);
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!(name && isValidCoordinatePair(lat, lng))) {
      return null;
    }
    if (typeof raw.osm_type !== 'string' || raw.osm_id === undefined || raw.osm_id === null) {
      return null;
    }

    const road = typeof raw.address?.road === 'string' ? raw.address.road : '';
    const house = typeof raw.address?.house_number === 'string' ? raw.address.house_number : '';
    const address = [road, house].filter(Boolean).join(' ') || null;
    const locality =
      [raw.address?.town, raw.address?.city, raw.address?.village].find(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ) ?? null;

    return {
      lat,
      lng,
      name: name.slice(0, 200),
      category: typeof raw.category === 'string' ? raw.category : '',
      type: typeof raw.type === 'string' ? raw.type : '',
      address,
      locality,
      osmType: raw.osm_type,
      osmId: String(raw.osm_id),
    };
  }

  private async request(query: string): Promise<GeoPoint | null | 'error'> {
    const body = await this.search({ q: query, limit: '1' });
    if (body === 'error') {
      return 'error';
    }

    const first = body[0] as { lat?: unknown; lon?: unknown } | undefined;
    if (!first) {
      return null;
    }

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    return isValidCoordinatePair(lat, lng) ? { lat, lng } : null;
  }

  private search(params: Record<string, string>): Promise<unknown[] | 'error'> {
    const query = new URLSearchParams({ ...params, format: 'jsonv2' });
    const logger = this.logger;
    // Not through the egress guard: the host comes from operator config, never
    // from a user, and a self-hosted geocoder sits on a private Docker address
    // the guard would reject. Never retried: public Nominatim allows one request
    // a second.
    return this.effects.run<unknown[] | 'error', never>(
      getWith(
        `${this.baseUrl}/search?${query.toString()}`,
        {
          timeout: this.timeoutMs,
          headers: { Accept: 'application/json', 'User-Agent': APP_NAME },
        },
        response =>
          Effect.gen(function* () {
            if (response.status < 200 || response.status >= 300) {
              logger.warn(`Geocoding request failed: http_${response.status}`);
              return 'error' as const;
            }
            // Rows are read leniently below; only an array of them counts.
            const body = yield* response.json;
            return Array.isArray(body) ? body : [];
          }),
      ).pipe(
        Effect.catch(error =>
          Effect.sync(() => {
            const reason = error._tag === 'TimeoutError' ? 'timeout' : 'network';
            logger.warn(`Geocoding request failed: ${reason}`);
            return 'error' as const;
          }),
        ),
      ),
    );
  }

  private async readCache<T = CachedGeocode>(key: string): Promise<T | null> {
    try {
      return (await this.cacheManager.get<T>(key)) ?? null;
    } catch {
      return null;
    }
  }

  private async writeCache(
    key: string,
    value: CachedGeocode | NearbyPlace[],
    ttlMs: number,
  ): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlMs);
    } catch {
      // A cache outage only costs a repeated lookup.
    }
  }

  private resolveBaseUrl(raw: string | undefined): string | null {
    const value = raw?.trim();
    if (!value) {
      return null;
    }

    try {
      const { protocol } = new URL(value);
      if (protocol === 'http:' || protocol === 'https:') {
        return value.replace(/\/+$/, '');
      }
    } catch {
      // fall through to the warning below
    }

    this.logger.warn('GEOCODER_URL is not a valid http(s) URL; geocoding is disabled');
    return null;
  }
}
