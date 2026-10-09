import { CryptoIconsService } from '../../../../src/modules/crypto/crypto-icons.service';

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

function build(fetchImpl: jest.Mock) {
  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
  global.fetch = fetchImpl as unknown as typeof fetch;
  return { service: new CryptoIconsService(cache as never), cache, store };
}

const json = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
});

const image = (contentType = 'image/png', body: Buffer = PNG) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': contentType }),
  arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
});

describe('CryptoIconsService', () => {
  it('fetches the logo of a coin we price', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      url.includes('/coins/markets')
        ? json([{ image: 'https://coin-images.coingecko.com/coins/1/large/bitcoin.png' }])
        : image(),
    );
    const { service } = build(fetchMock as jest.Mock);

    const result = await service.fetchIcon('btc');

    expect(result).toMatchObject({ status: 'ok', contentType: 'image/png' });
    expect(fetchMock.mock.calls[0][0]).toContain('ids=bitcoin');
  });

  it('answers the second call from the cache, without touching the network', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      url.includes('/coins/markets')
        ? json([{ image: 'https://coin-images.coingecko.com/coins/1/large/bitcoin.png' }])
        : image(),
    );
    const { service } = build(fetchMock as jest.Mock);

    await service.fetchIcon('BTC');
    const calls = fetchMock.mock.calls.length;
    const again = await service.fetchIcon('BTC');

    expect(again.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it('searches for a ticker we do not price, and takes only an exact match', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/search')) {
        return json({
          coins: [
            { symbol: 'adax', large: 'https://coin-images.coingecko.com/wrong.png' },
            { symbol: 'ada', large: 'https://coin-images.coingecko.com/ada.png' },
          ],
        });
      }
      return image();
    });
    const { service } = build(fetchMock as jest.Mock);

    const result = await service.fetchIcon('ADA');

    expect(result.status).toBe('ok');
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe('https://coin-images.coingecko.com/ada.png');
  });

  it('refuses to fetch an image from anywhere but the price source', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      url.includes('/coins/markets')
        ? json([{ image: 'https://evil.example.com/logo.png' }])
        : image(),
    );
    const { service } = build(fetchMock as jest.Mock);

    const result = await service.fetchIcon('BTC');

    expect(result.status).toBe('missing');
    expect(fetchMock.mock.calls.some(call => String(call[0]).includes('evil.example.com'))).toBe(
      false,
    );
  });

  it('rejects anything that is not a raster image', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      url.includes('/coins/markets')
        ? json([{ image: 'https://coin-images.coingecko.com/coins/1/large/bitcoin.png' }])
        : image('image/svg+xml'),
    );
    const { service } = build(fetchMock as jest.Mock);

    // An SVG from another origin can carry script, and we serve this from ours.
    expect((await service.fetchIcon('BTC')).status).toBe('unavailable');
  });

  it('does not take a rate limit for "this coin has no logo"', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 429,
      headers: new Headers(),
      json: async () => ({}),
    }));
    const { service, store } = build(fetchMock as jest.Mock);

    expect((await service.fetchIcon('BTC')).status).toBe('unavailable');
    expect(store.size).toBe(0);
  });

  it('turns away anything that is not a ticker before any request', async () => {
    const fetchMock = jest.fn();
    const { service } = build(fetchMock as jest.Mock);

    expect((await service.fetchIcon('../../etc/passwd')).status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
