import {
  CryptoPriceService,
  PriceUnavailableError,
} from '@/modules/crypto/crypto-price.service';

interface InsertedRow {
  baseCurrency: string;
  rate: number;
  rateDate: Date;
}

/** Captures what the service would have written, so caching can be asserted on. */
const createRepoMock = () => {
  const inserted: InsertedRow[] = [];
  const repo = {
    inserted,
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((rows: InsertedRow | InsertedRow[]) => {
        inserted.push(...(Array.isArray(rows) ? rows : [rows]));
        return {
          orIgnore: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ raw: [] }),
        };
      }),
    })),
  };
  return repo;
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response;
}

function errorResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    ok: false,
    status,
    headers: new Headers(headers),
    json: async () => ({}),
  } as unknown as Response;
}

const DAY_MS = 86_400_000;

describe('CryptoPriceService', () => {
  let repo: ReturnType<typeof createRepoMock>;
  let service: CryptoPriceService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    repo = createRepoMock();
    service = new CryptoPriceService(repo as never);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('primeHistoricalPrices', () => {
    it('costs one request per asset, not one per date', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          prices: [
            [Date.UTC(2026, 0, 1), 100],
            [Date.UTC(2026, 0, 2), 110],
            [Date.UTC(2026, 0, 3), 120],
          ],
        }),
      );

      await service.primeHistoricalPrices(
        ['ETH', 'USDT', 'ETH'],
        new Date('2026-01-01'),
        new Date('2026-01-03'),
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(repo.inserted).toHaveLength(6);
    });

    it('caches one price per day when the provider answers hourly', async () => {
      // Windows shorter than 90 days come back hourly; the day must not be stored
      // once per hour, or the first row written would decide the day arbitrarily.
      fetchMock.mockResolvedValue(
        jsonResponse({
          prices: [
            [Date.UTC(2026, 0, 1, 0), 100],
            [Date.UTC(2026, 0, 1, 6), 105],
            [Date.UTC(2026, 0, 1, 18), 108],
            [Date.UTC(2026, 0, 2, 0), 200],
          ],
        }),
      );

      await service.primeHistoricalPrices(['ETH'], new Date('2026-01-01'), new Date('2026-01-02'));

      expect(repo.inserted.map(row => row.rate)).toEqual([100, 200]);
    });

    it('skips an asset it cannot price at all', async () => {
      await service.primeHistoricalPrices(['SCAMCOIN'], new Date(), new Date());

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('getUsdPrice', () => {
    it('returns null for an asset absent from the price table', async () => {
      await expect(service.getUsdPrice('SCAMCOIN', new Date())).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('serves a cached date without calling the provider', async () => {
      repo.findOne.mockResolvedValue({ rate: '4117.28' });

      await expect(service.getUsdPrice('ETH', new Date('2026-01-01'))).resolves.toBe(4117.28);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws rather than reporting no price when the provider rate-limits us', async () => {
      // Returning null here is what silently dropped transfers: the caller cannot
      // tell "this asset has no price" from "we were not allowed to ask".
      fetchMock.mockResolvedValue(errorResponse(429, { 'retry-after': '60' }));

      await expect(service.getUsdPrice('ETH', new Date('2026-01-01'))).rejects.toBeInstanceOf(
        PriceUnavailableError,
      );
    });

    it('gives up immediately when told to wait longer than a sync should hold', async () => {
      fetchMock.mockResolvedValue(errorResponse(429, { 'retry-after': '60' }));

      await expect(service.getUsdPrice('ETH', new Date('2026-01-01'))).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries a short refusal and keeps the price it eventually gets', async () => {
      jest.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(errorResponse(429, { 'retry-after': '1' }))
        .mockResolvedValueOnce(jsonResponse({ market_data: { current_price: { usd: 3999.5 } } }));

      const price = service.getUsdPrice('ETH', new Date('2026-01-01'));
      await jest.advanceTimersByTimeAsync(1_000);

      await expect(price).resolves.toBe(3999.5);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a server error with backoff before giving up', async () => {
      jest.useFakeTimers();
      fetchMock.mockResolvedValue(errorResponse(503));

      const price = service.getUsdPrice('ETH', new Date('2026-01-01'));
      const assertion = expect(price).rejects.toBeInstanceOf(PriceUnavailableError);
      await jest.advanceTimersByTimeAsync(10_000);

      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('treats a 404 as an answer: this coin has no price for that date', async () => {
      fetchMock.mockResolvedValue(errorResponse(404));

      await expect(service.getUsdPrice('ETH', new Date('2026-01-01'))).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns null when the provider answers without a price for the date', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ market_data: {} }));

      await expect(service.getUsdPrice('ETH', new Date('2026-01-01'))).resolves.toBeNull();
    });
  });

  describe('getCurrentUsdPrices', () => {
    it('falls back to the last known price instead of failing the dashboard', async () => {
      // The summary endpoint runs on page load; a stale value beats an error page.
      fetchMock.mockResolvedValue(errorResponse(429, { 'retry-after': '60' }));
      repo.findOne.mockResolvedValue({ rate: '2486.72' });

      await expect(service.getCurrentUsdPrices(['ETH'])).resolves.toEqual({ ETH: 2486.72 });
    });
  });

  it('asks for a window that contains the requested day', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ prices: [] }));

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date(from.getTime() + DAY_MS);
    await service.primeHistoricalPrices(['ETH'], from, to);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`from=${Math.floor(from.getTime() / 1000)}`);
    expect(url).toContain(`to=${Math.floor(to.getTime() / 1000)}`);
  });
});
