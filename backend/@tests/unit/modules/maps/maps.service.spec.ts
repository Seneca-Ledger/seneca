import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { MapsService } from '@/modules/maps/maps.service';
import { EffectRuntime } from '@/common/effect/effect-runtime';

const makeCache = () => {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
};

const makeConfig = (values: Record<string, string | undefined>) =>
  ({ get: jest.fn((key: string) => values[key]) }) as unknown as ConfigService;

// Real Responses: the HTTP client reads headers and body the standard way.
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const STYLES = [
  { id: 'osm-bright', name: 'OSM Bright', url: 'http://tileserver:8080/styles/osm-bright/style.json' },
  { id: 'dark-matter', name: 'Dark Matter' },
  { id: '../../etc', name: 'Traversal' },
  { name: 'No id' },
];

describe('MapsService', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  let warnSpy: jest.SpyInstance;

  const create = (
    values: Record<string, string | undefined> = { TILESERVER_URL: 'http://tileserver:8080/' },
    cache = makeCache(),
  ) => ({
    service: new MapsService(cache as unknown as Cache, makeConfig(values), new EffectRuntime()),
    cache,
  });

  /** The style list, and a tile answering with `status`, or hanging until the timeout. */
  const routeFetch = (tile: { status?: number } | 'hang' = {}) =>
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/styles.json')) {
        return jsonResponse(STYLES);
      }
      if (tile === 'hang') {
        return new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      }
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: tile.status ?? 200,
        headers: { 'content-type': 'image/png' },
      });
    });

  beforeEach(() => {
    fetchMock.mockReset();
    // The HTTP client passes a URL object; the routes match on the string.
    global.fetch = ((input: string | URL, init?: RequestInit) =>
      fetchMock(String(input), init)) as unknown as typeof fetch;
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    global.fetch = originalFetch;
  });

  describe('getStyles', () => {
    it('offers nothing when no tile server is configured', async () => {
      const { service } = create({});

      await expect(service.getStyles()).resolves.toEqual({ styles: [], defaultStyleId: null });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('lists well-formed styles and defaults to the first one', async () => {
      routeFetch();
      const { service } = create();

      await expect(service.getStyles()).resolves.toEqual({
        styles: [
          { id: 'osm-bright', name: 'OSM Bright' },
          { id: 'dark-matter', name: 'Dark Matter' },
        ],
        defaultStyleId: 'osm-bright',
      });
      expect(fetchMock).toHaveBeenCalledWith('http://tileserver:8080/styles.json', expect.anything());
    });

    it('honours MAP_DEFAULT_STYLE only when the server offers it', async () => {
      routeFetch();

      const configured = create({
        TILESERVER_URL: 'http://tileserver:8080',
        MAP_DEFAULT_STYLE: 'dark-matter',
      });
      await expect(configured.service.getStyles()).resolves.toMatchObject({
        defaultStyleId: 'dark-matter',
      });

      const unknown = create({ TILESERVER_URL: 'http://tileserver:8080', MAP_DEFAULT_STYLE: 'nope' });
      await expect(unknown.service.getStyles()).resolves.toMatchObject({
        defaultStyleId: 'osm-bright',
      });
    });

    it('caches the style list for ten minutes', async () => {
      routeFetch();
      const { service, cache } = create();

      await service.getStyles();
      await service.getStyles();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledWith('maps:styles:v1', expect.any(Array), 10 * 60 * 1000);
    });

    it('does not cache a failed or empty answer', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: 'starting' }, 503))
        .mockResolvedValueOnce(jsonResponse([]));
      const { service, cache } = create();

      await expect(service.getStyles()).resolves.toMatchObject({ styles: [] });
      await expect(service.getStyles()).resolves.toMatchObject({ styles: [] });

      expect(cache.set).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('Map styles request failed: http_503');
    });
  });

  describe('fetchTile', () => {
    it('proxies a raster tile of an advertised style', async () => {
      routeFetch();
      const { service } = create();

      const tile = await service.fetchTile('osm-bright', '3', '1', '2.png');

      expect(tile).toEqual({
        status: 'ok',
        body: Buffer.from([137, 80, 78, 71]),
        contentType: 'image/png',
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        'http://tileserver:8080/styles/osm-bright/3/1/2.png',
        expect.objectContaining({ signal: expect.anything() }),
      );
    });

    it.each([
      ['an unknown style', 'satellite', '3', '1', '2.png'],
      ['a zoom beyond the grid', 'osm-bright', '23', '0', '0.png'],
      ['a column outside the zoom level', 'osm-bright', '2', '4', '0.png'],
      ['a non-numeric coordinate', 'osm-bright', '2', '1e1', '0.png'],
      ['a negative coordinate', 'osm-bright', '2', '-1', '0.png'],
    ])('rejects %s without calling the tile endpoint', async (_label, style, z, x, y) => {
      routeFetch();
      const { service } = create();

      await expect(service.fetchTile(style, z, x, y)).resolves.toEqual({ status: 'invalid' });
      expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/styles.json'))).toBe(
        true,
      );
    });

    it('reports an upstream error as unavailable', async () => {
      routeFetch({ status: 500 });
      const { service } = create();

      await expect(service.fetchTile('osm-bright', '0', '0', '0.png')).resolves.toEqual({
        status: 'unavailable',
      });
      expect(warnSpy).toHaveBeenCalledWith('Tile request failed: http_500');
    });

    it('reports a timeout as unavailable', async () => {
      routeFetch('hang');
      const { service } = create({ TILESERVER_URL: 'http://tileserver:8080/', TILESERVER_TIMEOUT_MS: '50' });

      await expect(service.fetchTile('osm-bright', '0', '0', '0.png')).resolves.toEqual({
        status: 'unavailable',
      });
      expect(warnSpy).toHaveBeenCalledWith('Tile request failed: timeout');
    });

    it('treats tiles as invalid when maps are disabled', async () => {
      const { service } = create({});

      await expect(service.fetchTile('osm-bright', '0', '0', '0.png')).resolves.toEqual({
        status: 'invalid',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
