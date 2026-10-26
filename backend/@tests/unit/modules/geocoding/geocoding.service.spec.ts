import type { MockInstance } from 'vitest';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { GeocodingService } from '@/modules/geocoding/geocoding.service';
import { EffectRuntime } from '@/common/effect/effect-runtime';

const DAY_MS = 24 * 60 * 60 * 1000;

const makeCache = () => {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
};

const makeConfig = (values: Record<string, string | undefined>) =>
  ({ get: vi.fn((key: string) => values[key]) }) as unknown as ConfigService;

// A real Response: the HTTP client reads headers and body the standard way.
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('GeocodingService', () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();
  let warnSpy: MockInstance;

  const create = (
    values: Record<string, string | undefined> = { GEOCODER_URL: 'http://nominatim:8080/' },
    cache = makeCache(),
  ) => ({
    service: new GeocodingService(cache as unknown as Cache, makeConfig(values), new EffectRuntime()),
    cache,
  });

  beforeEach(() => {
    fetchMock.mockReset();
    // The HTTP client passes a URL object; the assertions read the string.
    global.fetch = ((input: string | URL, init?: RequestInit) =>
      fetchMock(String(input), init)) as unknown as typeof fetch;
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    global.fetch = originalFetch;
  });

  it('does nothing when no geocoder is configured', async () => {
    const { service } = create({});

    await expect(service.geocode('г. Алматы, ул. Абая 10')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('treats a non-http GEOCODER_URL as disabled', async () => {
    const { service } = create({ GEOCODER_URL: 'ftp://nominatim' });

    await expect(service.geocode('г. Алматы, ул. Абая 10')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('queries the Nominatim search endpoint and parses string coordinates', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ lat: '43.2383', lon: '76.9453' }]));
    const { service } = create();

    await expect(service.geocode('  г. Алматы,   ул. Абая 10 ')).resolves.toEqual({
      lat: 43.2383,
      lng: 76.9453,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe('http://nominatim:8080/search');
    expect(parsed.searchParams.get('q')).toBe('г. алматы, ул. абая 10');
    expect(parsed.searchParams.get('format')).toBe('jsonv2');
    expect(parsed.searchParams.get('limit')).toBe('1');
    expect(init.signal).toBeDefined();
  });

  it('skips addresses too short to mean anything', async () => {
    const { service } = create();

    await expect(service.geocode(' 10 ')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers the same address from cache regardless of case and spacing', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ lat: '43.2383', lon: '76.9453' }]));
    const { service, cache } = create();

    await service.geocode('г. Алматы, ул. Абая 10');
    await expect(service.geocode('Г. АЛМАТЫ,  УЛ. АБАЯ 10')).resolves.toEqual({
      lat: 43.2383,
      lng: 76.9453,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [key, , ttl] = cache.set.mock.calls[0];
    expect(key).toMatch(/^geocode:v1:[0-9a-f]{64}$/);
    expect(ttl).toBe(30 * DAY_MS);
  });

  it('remembers a definite miss for a day', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const { service, cache } = create();

    await expect(service.geocode('nowhere street 404')).resolves.toBeNull();
    await expect(service.geocode('nowhere street 404')).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.set.mock.calls[0][1]).toEqual({ miss: true });
    expect(cache.set.mock.calls[0][2]).toBe(DAY_MS);
  });

  it('does not cache failures, so the next upload retries', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 503))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse([{ lat: '43.2383', lon: '76.9453' }]));
    const { service, cache } = create();

    await expect(service.geocode('г. Алматы, ул. Абая 10')).resolves.toBeNull();
    await expect(service.geocode('г. Алматы, ул. Абая 10')).resolves.toBeNull();
    await expect(service.geocode('г. Алматы, ул. Абая 10')).resolves.toEqual({
      lat: 43.2383,
      lng: 76.9453,
    });

    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('Geocoding request failed: http_503');
    expect(warnSpy).toHaveBeenCalledWith('Geocoding request failed: network');
  });

  it('reports a timeout without the address', async () => {
    // A geocoder that never answers: the request is cut off at the timeout.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const { service } = create({ GEOCODER_URL: 'http://nominatim:8080', GEOCODER_TIMEOUT_MS: '50' });

    await expect(service.geocode('г. Алматы, ул. Абая 10')).resolves.toBeNull();

    expect(warnSpy).toHaveBeenCalledWith('Geocoding request failed: timeout');
    expect(JSON.stringify(warnSpy.mock.calls)).not.toMatch(/абая/i);
  });

  it('rejects coordinates outside the valid range', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ lat: '91', lon: '76.9' }]));
    const { service } = create();

    await expect(service.geocode('г. Алматы, ул. Абая 10')).resolves.toBeNull();
  });

  it('keeps working when the cache is down', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ lat: '43.2383', lon: '76.9453' }]));
    const cache = makeCache();
    cache.get.mockRejectedValue(new Error('redis down'));
    cache.set.mockRejectedValue(new Error('redis down'));
    const { service } = create(undefined, cache);

    await expect(service.geocode('г. Алматы, ул. Абая 10')).resolves.toEqual({
      lat: 43.2383,
      lng: 76.9453,
    });
  });

  describe('searchNearby', () => {
    const near = { lat: 43.73081, lng: 7.41697, radiusM: 230 };
    const carrefour = {
      lat: '43.7307976',
      lon: '7.4169685',
      name: 'Carrefour',
      category: 'shop',
      type: 'supermarket',
      osm_type: 'node',
      osm_id: 274497719,
      address: { road: 'Avenue Albert II', house_number: '4', town: 'Monaco' },
    };

    it('does nothing without a geocoder or without anything to look for', async () => {
      await expect(create({}).service.searchNearby({ ...near, name: 'carrefour' })).resolves.toEqual(
        [],
      );
      await expect(create().service.searchNearby(near)).resolves.toEqual([]);
      await expect(
        create().service.searchNearby({ ...near, lat: 91, placeType: 'cafe' }),
      ).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('searches a bounded box around the snapped point by kind of place', async () => {
      fetchMock.mockResolvedValue(jsonResponse([carrefour]));
      const { service } = create();

      await expect(service.searchNearby({ ...near, placeType: 'supermarket' })).resolves.toEqual([
        {
          lat: 43.7307976,
          lng: 7.4169685,
          name: 'Carrefour',
          category: 'shop',
          type: 'supermarket',
          address: 'Avenue Albert II 4',
          locality: 'Monaco',
          osmType: 'node',
          osmId: '274497719',
        },
      ]);

      const params = new URL(fetchMock.mock.calls[0][0] as string).searchParams;
      expect(params.get('amenity')).toBe('supermarket');
      expect(params.get('q')).toBeNull();
      expect(params.get('bounded')).toBe('1');
      expect(params.get('addressdetails')).toBe('1');
      expect(params.get('format')).toBe('jsonv2');
      const [west, north, east, south] = (params.get('viewbox') ?? '').split(',').map(Number);
      // Centre snapped to 43.731 / 7.417, 230 m each way.
      expect((north + south) / 2).toBeCloseTo(43.731, 5);
      expect((west + east) / 2).toBeCloseTo(7.417, 5);
      expect(Math.abs((north - south) * 111_320 - 460)).toBeLessThan(2);
    });

    it('searches by name in lower case', async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      const { service } = create();

      await service.searchNearby({ ...near, name: '  ООО  Carrefour ' });

      const params = new URL(fetchMock.mock.calls[0][0] as string).searchParams;
      expect(params.get('q')).toBe('ооо carrefour');
      expect(params.get('amenity')).toBeNull();
    });

    it('drops unnamed and malformed places', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse([
          { ...carrefour, name: '' },
          { ...carrefour, name: undefined },
          { ...carrefour, lat: 'x' },
          { ...carrefour, osm_type: undefined },
          { ...carrefour, address: undefined, osm_id: 7 },
        ]),
      );
      const { service } = create();

      const places = await service.searchNearby({ ...near, placeType: 'supermarket' });

      expect(places).toHaveLength(1);
      expect(places[0]).toMatchObject({ osmId: '7', address: null, locality: null });
    });

    it('caches results under a hashed key and serves nearby fixes from it', async () => {
      fetchMock.mockResolvedValue(jsonResponse([carrefour]));
      const { service, cache } = create();

      await service.searchNearby({ ...near, placeType: 'supermarket' });
      await service.searchNearby({ ...near, lat: 43.73099, placeType: 'supermarket' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [key, , ttl] = cache.set.mock.calls[0];
      expect(key).toMatch(/^nearby:v1:[0-9a-f]{64}$/);
      expect(ttl).toBe(7 * DAY_MS);
    });

    it('returns nothing on failure, caches nothing and logs no coordinates', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 503))
        .mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
      const { service, cache } = create();

      await expect(service.searchNearby({ ...near, placeType: 'cafe' })).resolves.toEqual([]);
      await expect(service.searchNearby({ ...near, placeType: 'cafe' })).resolves.toEqual([]);

      expect(cache.set).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('Geocoding request failed: http_503');
      expect(warnSpy).toHaveBeenCalledWith('Geocoding request failed: network');
      expect(JSON.stringify(warnSpy.mock.calls)).not.toMatch(/43\.7|7\.41/);
    });
  });
});

