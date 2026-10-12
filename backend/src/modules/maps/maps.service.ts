import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { Effect } from 'effect';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { getWith } from '../../common/effect/http-json';

export type MapStyle = { id: string; name: string };

export type MapStylesResponse = {
  styles: MapStyle[];
  defaultStyleId: string | null;
};

export type TileResult =
  | { status: 'ok'; body: Buffer; contentType: string }
  | { status: 'invalid' }
  | { status: 'unavailable' };

const DEFAULT_TIMEOUT_MS = 5000;
const STYLES_CACHE_KEY = 'maps:styles:v1';
const STYLES_TTL_MS = 10 * 60 * 1000;
const MAX_ZOOM = 22;
const STYLE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/**
 * Serves raster tiles from a self-hosted tileserver-gl. The browser never talks
 * to the tile server: it stays on the internal network, and the tile URL is not
 * baked into the prebuilt frontend image.
 */
@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private readonly baseUrl: string | null;
  private readonly timeoutMs: number;
  private readonly defaultStyle: string | undefined;

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    configService: ConfigService,
    private readonly effects: EffectRuntime,
  ) {
    this.baseUrl = this.resolveBaseUrl(configService.get<string>('TILESERVER_URL'));
    const timeout = Number(configService.get<string>('TILESERVER_TIMEOUT_MS'));
    this.timeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
    this.defaultStyle = configService.get<string>('MAP_DEFAULT_STYLE')?.trim() || undefined;
  }

  async getStyles(): Promise<MapStylesResponse> {
    const styles = this.baseUrl ? await this.loadStyles() : [];
    const defaultStyleId = styles.some(style => style.id === this.defaultStyle)
      ? (this.defaultStyle as string)
      : (styles[0]?.id ?? null);

    return { styles, defaultStyleId };
  }

  async fetchTile(styleId: string, z: string, x: string, y: string): Promise<TileResult> {
    const coords = this.parseTileCoordinates(z, x, y);
    if (!(this.baseUrl && coords)) {
      return { status: 'invalid' };
    }

    // Only ids the tile server itself advertised reach the upstream path.
    const styles = await this.loadStyles();
    const style = styles.find(candidate => candidate.id === styleId);
    if (!style) {
      return { status: 'invalid' };
    }

    // Not through the egress guard: the host is operator config on the private
    // Docker network, which the guard would reject.
    const logger = this.logger;
    return this.effects.run<TileResult, never>(
      getWith(
        `${this.baseUrl}/styles/${style.id}/${coords.z}/${coords.x}/${coords.y}.png`,
        { timeout: this.timeoutMs },
        response =>
          Effect.gen(function* () {
            if (response.status < 200 || response.status >= 300) {
              logger.warn(`Tile request failed: http_${response.status}`);
              return { status: 'unavailable' } as const;
            }
            return {
              status: 'ok',
              body: Buffer.from(yield* response.arrayBuffer),
              contentType: response.headers['content-type'] || 'image/png',
            } as const;
          }),
      ).pipe(
        Effect.catch(error =>
          Effect.sync((): TileResult => {
            logger.warn(
              `Tile request failed: ${error._tag === 'TimeoutError' ? 'timeout' : 'network'}`,
            );
            return { status: 'unavailable' };
          }),
        ),
      ),
    );
  }

  private async loadStyles(): Promise<MapStyle[]> {
    const cached = await this.readCache();
    if (cached) {
      return cached;
    }

    const logger = this.logger;
    const styles = await this.effects.run<MapStyle[], never>(
      getWith(
        `${this.baseUrl}/styles.json`,
        { timeout: this.timeoutMs, headers: { Accept: 'application/json' } },
        response =>
          Effect.gen(function* () {
            if (response.status < 200 || response.status >= 300) {
              logger.warn(`Map styles request failed: http_${response.status}`);
              return [];
            }
            // Read leniently: a style without a usable id or name is skipped.
            const body = yield* response.json;
            return (Array.isArray(body) ? body : [])
              .filter(
                (item): item is MapStyle =>
                  typeof item?.id === 'string' &&
                  STYLE_ID_PATTERN.test(item.id) &&
                  typeof item?.name === 'string',
              )
              .map(({ id, name }) => ({ id, name }));
          }),
      ).pipe(
        Effect.catch(error =>
          Effect.sync((): MapStyle[] => {
            logger.warn(
              `Map styles request failed: ${error._tag === 'TimeoutError' ? 'timeout' : 'network'}`,
            );
            return [];
          }),
        ),
      ),
    );

    // An empty list is not cached: it usually means the server is still importing.
    if (styles.length > 0) {
      await this.writeCache(styles);
    }
    return styles;
  }

  // Leaflet requests `{y}.png`, so the last segment arrives with its extension.
  private parseTileCoordinates(
    z: string,
    x: string,
    y: string,
  ): { z: number; x: number; y: number } | null {
    const toInt = (value: string) => (/^\d{1,8}$/.test(value) ? Number(value) : Number.NaN);
    const zoom = toInt(z);
    if (!(Number.isInteger(zoom) && zoom <= MAX_ZOOM)) {
      return null;
    }

    const size = 2 ** zoom;
    const inGrid = (value: number) => Number.isInteger(value) && value < size;
    const column = toInt(x);
    const row = toInt(y.replace(/\.png$/i, ''));
    return inGrid(column) && inGrid(row) ? { z: zoom, x: column, y: row } : null;
  }

  private async readCache(): Promise<MapStyle[] | null> {
    try {
      return (await this.cacheManager.get<MapStyle[]>(STYLES_CACHE_KEY)) ?? null;
    } catch {
      return null;
    }
  }

  private async writeCache(styles: MapStyle[]): Promise<void> {
    try {
      await this.cacheManager.set(STYLES_CACHE_KEY, styles, STYLES_TTL_MS);
    } catch {
      // A cache outage only costs a repeated styles.json request.
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

    this.logger.warn('TILESERVER_URL is not a valid http(s) URL; maps are disabled');
    return null;
  }
}
