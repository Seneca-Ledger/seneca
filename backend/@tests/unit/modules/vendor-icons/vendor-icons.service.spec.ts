import { Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { VendorIconsService } from '@/modules/vendor-icons/vendor-icons.service';
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

// A real Response: the HTTP client reads headers and body the standard way.
const imageResponse = (body: Buffer, contentType = 'image/png', status = 200) =>
  new Response(new Uint8Array(body), { status, headers: { 'content-type': contentType } });

describe('VendorIconsService', () => {
  const originalFetch = global.fetch;
  let cache: ReturnType<typeof makeCache>;
  let service: VendorIconsService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    cache = makeCache();
    service = new VendorIconsService(cache as unknown as Cache, new EffectRuntime());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('input validation', () => {
    it.each([
      ['a traversal segment', '../etc'],
      ['a dotless host', 'localhost'],
      ['a bare IP', '1.2.3.4'],
      ['an email address', 'a@b.com'],
      ['a single label', 'foo'],
      ['a path', 'evil.com/x'],
      ['a port', 'evil.com:8080'],
      ['an over-long name', `${'x'.repeat(250)}.com`],
    ])('rejects %s without reaching the network', async (_label, domain) => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(service.fetchIcon(domain)).resolves.toEqual({ status: 'invalid' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('returns and caches a raster icon', async () => {
    const body = Buffer.from('png-bytes');
    global.fetch = jest.fn().mockResolvedValue(imageResponse(body)) as unknown as typeof fetch;

    const result = await service.fetchIcon('netflix.com');

    expect(result).toEqual({ status: 'ok', body, contentType: 'image/png' });
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('serves a repeat request from the cache', async () => {
    const fetchMock = jest.fn().mockResolvedValue(imageResponse(Buffer.from('png-bytes')));
    global.fetch = fetchMock as unknown as typeof fetch;

    await service.fetchIcon('netflix.com');
    const second = await service.fetchIcon('netflix.com');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual({
      status: 'ok',
      body: Buffer.from('png-bytes'),
      contentType: 'image/png',
    });
  });

  it('caches a 404 as a miss for a day', async () => {
    const fetchMock = jest.fn().mockResolvedValue(imageResponse(Buffer.alloc(0), 'text/html', 404));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(service.fetchIcon('no-icon-here.com')).resolves.toEqual({ status: 'missing' });
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), { miss: true }, 24 * 60 * 60 * 1000);

    await expect(service.fetchIcon('no-icon-here.com')).resolves.toEqual({ status: 'missing' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a server error', imageResponse(Buffer.alloc(0), 'image/png', 500)],
    ['a non-image body', imageResponse(Buffer.from('<html>'), 'text/html')],
    ['an oversized body', imageResponse(Buffer.alloc(100 * 1024), 'image/png')],
    ['an empty body', imageResponse(Buffer.alloc(0), 'image/png')],
  ])('reports %s as unavailable and does not cache it', async (_label, response) => {
    global.fetch = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(service.fetchIcon('netflix.com')).resolves.toEqual({ status: 'unavailable' });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('reports a timeout as unavailable and does not cache it', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    global.fetch = jest.fn().mockRejectedValue(timeout) as unknown as typeof fetch;

    await expect(service.fetchIcon('netflix.com')).resolves.toEqual({ status: 'unavailable' });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('survives a cache outage', async () => {
    cache.get.mockRejectedValue(new Error('redis down'));
    cache.set.mockRejectedValue(new Error('redis down'));
    global.fetch = jest
      .fn()
      .mockResolvedValue(imageResponse(Buffer.from('png-bytes'))) as unknown as typeof fetch;

    await expect(service.fetchIcon('netflix.com')).resolves.toMatchObject({ status: 'ok' });
  });
});
