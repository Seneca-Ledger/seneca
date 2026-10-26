import type { Mock } from 'vitest';
import { EffectRuntime } from '@/common/effect/effect-runtime';
import { ExchangeRatesService } from '@/modules/exchange-rates/exchange-rates.service';

const effects = new EffectRuntime();
afterAll(() => effects.onModuleDestroy());

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const statusResponse = (status: number) => new Response(null, { status });
/** The URLs fetched so far, in order. */
const requestedUrls = () => (global.fetch as Mock).mock.calls.map(([url]) => String(url));

function createRepoMock() {
  return {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    createQueryBuilder: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      into: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      orIgnore: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    }),
  } as any;
}

function createCacheMock() {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn(),
  } as any;
}

function createConfigMock(apiKey?: string) {
  return {
    get: vi.fn().mockReturnValue(apiKey),
  } as any;
}

/** An in-memory workspace_exchange_rates table, enough for findOne/count/upsert/delete. */
function createWorkspaceRateRepo() {
  const rows: any[] = [];
  const day = (value: any) => new Date(value).toISOString().slice(0, 10);
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, expected]: [string, any]) => {
      if (key !== 'rateDate') return row[key] === expected;
      if (expected?.type === 'lessThanOrEqual') return day(row.rateDate) <= day(expected.value);
      return day(row.rateDate) === day(expected);
    });
  return {
    rows,
    findOne: vi.fn(async ({ where, order }: any) => {
      const found = rows.filter(row => matches(row, where));
      if (order?.rateDate === 'DESC') found.sort((a, b) => day(b.rateDate).localeCompare(day(a.rateDate)));
      return found[0] ?? null;
    }),
    count: vi.fn(async ({ where }: any) => rows.filter(row => matches(row, where)).length),
    upsert: vi.fn(async (row: any) => {
      const index = rows.findIndex(
        existing =>
          existing.workspaceId === row.workspaceId &&
          existing.baseCurrency === row.baseCurrency &&
          existing.targetCurrency === row.targetCurrency &&
          day(existing.rateDate) === day(row.rateDate),
      );
      if (index >= 0) rows[index] = { ...rows[index], ...row };
      else rows.push({ ...row });
    }),
    delete: vi.fn(async (where: any) => {
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1);
    }),
  } as any;
}

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;
  let repo: ReturnType<typeof createRepoMock>;
  let cache: ReturnType<typeof createCacheMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => statusResponse(404)) as any;
    repo = createRepoMock();
    cache = createCacheMock();
    service = new ExchangeRatesService(repo, cache, createConfigMock(), effects);
  });

  // ─── getRate ───────────────────────────────────────────────

  describe('getRate', () => {
    it('returns 1 for same currency', async () => {
      const rate = await service.getRate('USD', 'USD');
      expect(rate).toBe(1);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('normalizes currency codes to uppercase', async () => {
      repo.findOne.mockResolvedValue({ rate: 3.5 });
      const rate = await service.getRate('  usd ', ' ils');
      expect(rate).toBe(3.5);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            baseCurrency: 'USD',
            targetCurrency: 'ILS',
          }),
        }),
      );
    });

    it('returns cached rate when available', async () => {
      cache.get.mockResolvedValue(3.67);
      const rate = await service.getRate('USD', 'ILS');
      expect(rate).toBe(3.67);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('looks up rate from database when not cached', async () => {
      repo.findOne.mockResolvedValue({ rate: '3.65' });
      const rate = await service.getRate('USD', 'ILS');
      expect(rate).toBe(3.65);
      expect(cache.set).toHaveBeenCalled();
    });

    it('uses inverse database rate when only the reverse pair exists', async () => {
      repo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ rate: '500', rateDate: '2026-03-17' });

      const rate = await service.getRate('KZT', 'USD');

      expect(rate).toBe(0.002);
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('exchange_rate:KZT:USD'),
        0.002,
        expect.any(Number),
      );
    });

    it('returns stale DB rate as last resort before fallback to 1', async () => {
      // First findOne (exact date) returns null
      // Second findOne (reverse exact date) returns null
      // Third findOne (latest by date) returns a stale rate
      repo.findOne
        .mockResolvedValueOnce(null) // exact date lookup
        .mockResolvedValueOnce(null) // reverse exact date lookup
        .mockResolvedValueOnce({ rate: '3.50', rateDate: '2025-01-01' }); // latest rate

      const rate = await service.getRate('USD', 'ILS');
      expect(rate).toBe(3.50);
    });

    it('returns 1 when no rate is found anywhere (fallback)', async () => {
      repo.findOne.mockResolvedValue(null);
      const rate = await service.getRate('USD', 'KZT');
      expect(rate).toBe(1);
    });

    it('fetches the current rate from the public API when no API key is configured', async () => {
      repo.findOne.mockResolvedValue(null);
      global.fetch = vi.fn(async () =>
        jsonResponse({ date: '2026-04-29', usd: { kzt: 512.34 } }),
      ) as any;

      const rate = await service.getRate('USD', 'KZT');

      expect(rate).toBe(512.34);
      expect(requestedUrls()).toEqual([
        expect.stringMatching(/@fawazahmed0\/currency-api@latest\/.*\/currencies\/usd\.json$/),
      ]);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('exchange_rate:USD:KZT'),
        512.34,
        expect.any(Number),
      );
    });

    it('retries a failing CDN twice, then uses the public API fallback URL', async () => {
      repo.findOne.mockResolvedValue(null);
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(statusResponse(503))
        .mockResolvedValueOnce(statusResponse(503))
        .mockResolvedValueOnce(statusResponse(503))
        .mockResolvedValueOnce(jsonResponse({ date: '2026-04-29', usd: { kzt: 511.22 } })) as any;

      const rate = await service.getRate('USD', 'KZT');

      expect(rate).toBe(511.22);
      expect(requestedUrls()).toEqual([
        expect.stringContaining('cdn.jsdelivr.net'),
        expect.stringContaining('cdn.jsdelivr.net'),
        expect.stringContaining('cdn.jsdelivr.net'),
        expect.stringContaining('latest.currency-api.pages.dev'),
      ]);
    });

    it('does not retry a 404, which will not change', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.getRate('USD', 'KZT');

      expect(requestedUrls()).toEqual([
        expect.stringContaining('cdn.jsdelivr.net'),
        expect.stringContaining('latest.currency-api.pages.dev'),
      ]);
    });

    it('gives up on a provider that does not answer within five seconds', async () => {
      repo.findOne.mockResolvedValue(null);
      global.fetch = vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
          ),
      ) as any;
      vi.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

      try {
        const pending = service.getRate('USD', 'KZT');
        await vi.advanceTimersByTimeAsync(5_000);
        await vi.advanceTimersByTimeAsync(5_000);
        await expect(pending).resolves.toBe(1);
      } finally {
        vi.useRealTimers();
      }
      expect(requestedUrls()).toHaveLength(2);
    });

    it('uses specific date when provided', async () => {
      repo.findOne.mockResolvedValue({ rate: '3.60' });
      const date = new Date('2025-06-15');
      await service.getRate('USD', 'ILS', date);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rateDate: new Date('2025-06-15'),
          }),
        }),
      );
    });

    it('normalizes NIS to ILS for exchange-rate lookups', async () => {
      repo.findOne.mockResolvedValue({ rate: '3.72' });

      const rate = await service.getRate('USD', 'NIS');

      expect(rate).toBe(3.72);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            baseCurrency: 'USD',
            targetCurrency: 'ILS',
          }),
        }),
      );
    });
  });

  // ─── getRateQuote ──────────────────────────────────────────

  describe('getRateQuote', () => {
    const noExactRate = () => repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    it('marks an exact rate as fresh', async () => {
      repo.findOne.mockResolvedValue({ rate: '0.91' });
      await expect(service.getRateQuote('USD', 'EUR', '2025-03-10')).resolves.toEqual({
        rate: 0.91,
        rateDate: '2025-03-10',
        stale: false,
      });
    });

    it('borrows only a rate quoted on or before the requested day', async () => {
      noExactRate()
        .mockResolvedValueOnce({ rate: '0.90', rateDate: '2025-03-07' })
        .mockResolvedValueOnce(null);

      const quote = await service.getRateQuote('USD', 'EUR', '2025-03-10');

      expect(quote).toEqual({ rate: 0.9, rateDate: '2025-03-07', stale: true });
      const fallbackWhere = repo.findOne.mock.calls[2][0].where;
      expect(fallbackWhere.rateDate).toMatchObject({
        type: 'lessThanOrEqual',
        value: new Date('2025-03-10'),
      });
      expect(repo.findOne.mock.calls[2][0].order).toEqual({ rateDate: 'DESC' });
    });

    it('prefers whichever of the direct and reverse pair is closer to the day', async () => {
      noExactRate()
        .mockResolvedValueOnce({ rate: '0.80', rateDate: '2025-02-01' })
        .mockResolvedValueOnce({ rate: '1.25', rateDate: '2025-03-09' });

      const quote = await service.getRateQuote('USD', 'EUR', '2025-03-10');

      expect(quote).toEqual({ rate: 0.8, rateDate: '2025-03-09', stale: true });
    });

    it('refuses a borrowed rate older than maxStaleDays', async () => {
      noExactRate()
        .mockResolvedValueOnce({ rate: '0.90', rateDate: '2025-03-01' })
        .mockResolvedValueOnce(null);

      await expect(
        service.getRateQuote('USD', 'EUR', '2025-03-10', { maxStaleDays: 7 }),
      ).resolves.toBeNull();
    });

    it('accepts a borrowed rate within maxStaleDays', async () => {
      noExactRate()
        .mockResolvedValueOnce({ rate: '0.90', rateDate: '2025-03-03' })
        .mockResolvedValueOnce(null);

      await expect(
        service.getRateQuote('USD', 'EUR', '2025-03-10', { maxStaleDays: 7 }),
      ).resolves.toMatchObject({ rate: 0.9, stale: true });
    });

    it('caches a borrowed rate and skips the network while it is cached', async () => {
      noExactRate()
        .mockResolvedValueOnce({ rate: '0.90', rateDate: '2025-03-07' })
        .mockResolvedValueOnce(null);
      await service.getRateQuote('USD', 'EUR', '2025-03-10');
      expect(cache.set).toHaveBeenCalledWith(
        'exchange_rate_fallback:USD:EUR:2025-03-10',
        { rate: 0.9, rateDate: '2025-03-07', stale: true },
        3600 * 1000,
      );

      (global.fetch as Mock).mockClear();
      cache.get.mockImplementation(async (key: string) =>
        key.startsWith('exchange_rate_fallback:')
          ? { rate: 0.9, rateDate: '2025-03-07', stale: true }
          : undefined,
      );
      repo.findOne.mockResolvedValue(null);

      await expect(service.getRateQuote('USD', 'EUR', '2025-03-10')).resolves.toMatchObject({
        rate: 0.9,
        stale: true,
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('never stores the paid API latest rates under a past date', async () => {
      const serviceWithKey = new ExchangeRatesService(repo, cache, createConfigMock('test-api-key'), effects);
      repo.findOne.mockResolvedValue(null);

      await serviceWithKey.getRateQuote('EUR', 'KZT', '2025-03-10');

      const urls = (global.fetch as Mock).mock.calls.map(([url]) => String(url));
      expect(urls.some(url => url.includes('/latest/'))).toBe(false);
      expect(urls.some(url => url.includes('@2025-03-10'))).toBe(true);
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('still asks the paid API for today', async () => {
      const serviceWithKey = new ExchangeRatesService(repo, cache, createConfigMock('test-api-key'), effects);
      repo.findOne.mockResolvedValue(null);

      await serviceWithKey.getRateQuote('USD', 'KZT');

      const urls = (global.fetch as Mock).mock.calls.map(([url]) => String(url));
      expect(urls).toContain('https://v6.exchangerate-api.com/v6/test-api-key/latest/USD');
    });
  });

  // ─── convert ───────────────────────────────────────────────

  describe('getRateCurve', () => {
    /** Answers `find` from an in-memory table of provider quotes. */
    function seed(rows: Array<{ from: string; to: string; date: string; rate: number }>) {
      repo.find.mockImplementation(async ({ where }: any) =>
        rows
          .filter(row => row.from === where.baseCurrency && row.to === where.targetCurrency)
          .map(row => ({ rateDate: new Date(row.date), rate: row.rate })),
      );
      repo.findOne.mockResolvedValue(null);
    }

    it('carries the last quote before the window in as its opening point', async () => {
      seed([
        { from: 'EUR', to: 'KZT', date: '2026-01-10', rate: 480 },
        { from: 'EUR', to: 'KZT', date: '2026-02-10', rate: 500 },
        { from: 'EUR', to: 'KZT', date: '2026-06-10', rate: 520 },
      ]);

      const curve = await service.getRateCurve('EUR', 'KZT', '2026-03-01', '2026-07-01');

      // Only the latest pre-window quote matters, and it opens the window.
      expect(curve).toEqual([
        { date: '2026-03-01', rate: 500 },
        { date: '2026-06-10', rate: 520 },
      ]);
    });

    it('inverts the reverse pair when only it was quoted', async () => {
      seed([{ from: 'KZT', to: 'EUR', date: '2026-03-05', rate: 0.002 }]);

      const curve = await service.getRateCurve('EUR', 'KZT', '2026-03-01', '2026-07-01');

      expect(curve).toEqual([{ date: '2026-03-05', rate: 500 }]);
    });

    it('lets a hand-entered rate win over the provider on the same day', async () => {
      seed([{ from: 'EUR', to: 'KZT', date: '2026-03-05', rate: 500 }]);
      const workspaceRates = createWorkspaceRateRepo();
      workspaceRates.rows.push({
        workspaceId: 'ws-1',
        baseCurrency: 'EUR',
        targetCurrency: 'KZT',
        rate: 530,
        rateDate: new Date('2026-03-05'),
      });
      workspaceRates.find = vi.fn(async ({ where }: any) =>
        workspaceRates.rows.filter(
          (row: any) =>
            row.baseCurrency === where.baseCurrency && row.targetCurrency === where.targetCurrency,
        ),
      );
      const withManual = new ExchangeRatesService(
        repo,
        createCacheMock(),
        createConfigMock(),
        effects,
        undefined,
        workspaceRates,
      );

      const curve = await withManual.getRateCurve('EUR', 'KZT', '2026-03-01', '2026-07-01', 'ws-1');

      expect(curve).toEqual([{ date: '2026-03-05', rate: 530 }]);
    });

    it('returns an empty curve when the pair was never quoted', async () => {
      seed([]);

      await expect(service.getRateCurve('CHF', 'KZT', '2026-03-01', '2026-07-01')).resolves.toEqual(
        [],
      );
    });
  });

  describe('convert', () => {
    it('multiplies amount by rate', async () => {
      repo.findOne.mockResolvedValue({ rate: '3.67' });
      const result = await service.convert(100, 'USD', 'ILS');
      expect(result.converted).toBeCloseTo(367, 2);
      expect(result.rate).toBe(3.67);
      expect(result.source).toBe('exchange-rates-service');
    });

    it('returns same amount for same currency', async () => {
      const result = await service.convert(250, 'EUR', 'EUR');
      expect(result.converted).toBe(250);
      expect(result.rate).toBe(1);
    });

    it('handles zero amount', async () => {
      repo.findOne.mockResolvedValue({ rate: '3.67' });
      const result = await service.convert(0, 'USD', 'ILS');
      expect(result.converted).toBe(0);
    });

    it('handles negative amounts', async () => {
      repo.findOne.mockResolvedValue({ rate: '3.67' });
      const result = await service.convert(-50, 'USD', 'ILS');
      expect(result.converted).toBeCloseTo(-183.5, 1);
    });
  });

  // ─── bulkConvert ───────────────────────────────────────────

  describe('bulkConvert', () => {
    it('converts multiple items to target currency', async () => {
      // USD->ILS first, EUR->ILS second
      repo.findOne
        .mockResolvedValueOnce({ rate: '3.67' }) // USD->ILS
        .mockResolvedValueOnce(null) // EUR->ILS exact
        .mockResolvedValueOnce(null) // ILS->EUR exact
        .mockResolvedValueOnce({ rate: '4.05', rateDate: '2026-01-01' }); // EUR->ILS latest

      const results = await service.bulkConvert(
        [
          { amount: 100, currency: 'USD' },
          { amount: 200, currency: 'EUR' },
        ],
        'ILS',
      );

      expect(results).toHaveLength(2);
      expect(results[0].converted).toBeCloseTo(367, 0);
      expect(results[1].converted).toBeCloseTo(810, 0);
    });

    it('handles empty items array', async () => {
      const results = await service.bulkConvert([], 'USD');
      expect(results).toEqual([]);
    });
  });

  // ─── fetchAndCacheRates ────────────────────────────────────

  describe('fetchAndCacheRates', () => {
    it('does nothing when API key is not set', async () => {
      // service created without API key (default in beforeEach)
      await service.fetchAndCacheRates('USD');
      // Should not throw, should not call repo
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('fetches and saves rates from API', async () => {
      const serviceWithKey = new ExchangeRatesService(
        repo,
        cache,
        createConfigMock('test-api-key'),
        effects,
      );

      const mockRates = { USD: 1, EUR: 0.85, ILS: 3.67 };
      global.fetch = vi.fn(async () =>
        jsonResponse({ result: 'success', conversion_rates: mockRates }),
      ) as any;

      await serviceWithKey.fetchAndCacheRates('USD');

      // Should insert one rate per conversion_rates entry
      expect(repo.createQueryBuilder).toHaveBeenCalledTimes(3);
    });

    it('handles API error gracefully', async () => {
      const serviceWithKey = new ExchangeRatesService(
        repo,
        cache,
        createConfigMock('test-api-key'),
        effects,
      );

      global.fetch = vi.fn(async () => statusResponse(500)) as any;

      // Should not throw
      await expect(serviceWithKey.fetchAndCacheRates('USD')).resolves.toBeUndefined();
    });

    it('handles unsuccessful API result', async () => {
      const serviceWithKey = new ExchangeRatesService(
        repo,
        cache,
        createConfigMock('test-api-key'),
        effects,
      );

      global.fetch = vi.fn(async () => jsonResponse({ result: 'error' })) as any;

      await serviceWithKey.fetchAndCacheRates('USD');
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('handles network failure gracefully', async () => {
      const serviceWithKey = new ExchangeRatesService(
        repo,
        cache,
        createConfigMock('test-api-key'),
        effects,
      );

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;
      await expect(serviceWithKey.fetchAndCacheRates()).resolves.toBeUndefined();
    });
  });

  // ─── workspace manual rates ────────────────────────────────

  describe('manual rates', () => {
    let workspaceRates: ReturnType<typeof createWorkspaceRateRepo>;
    let scoped: ExchangeRatesService;

    beforeEach(() => {
      workspaceRates = createWorkspaceRateRepo();
      repo.findOne.mockResolvedValue(null);
      repo.delete = vi.fn();
      cache.del = vi.fn();
      scoped = new ExchangeRatesService(
        repo,
        cache,
        createConfigMock(),
        effects,
        undefined,
        workspaceRates,
      );
    });

    it('stores the rate for its workspace and leaves the shared provider cache alone', async () => {
      await scoped.setManualRate('ws-a', 'zzx', 'usd', 0.25, '2025-03-10');

      expect(workspaceRates.rows).toHaveLength(1);
      expect(workspaceRates.rows[0]).toMatchObject({
        workspaceId: 'ws-a',
        baseCurrency: 'ZZX',
        targetCurrency: 'USD',
        rate: 0.25,
      });
      expect(repo.delete).not.toHaveBeenCalled();
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('applies only inside the workspace that entered it', async () => {
      await scoped.setManualRate('ws-a', 'ZZX', 'USD', 0.25, '2025-03-10');

      await expect(
        scoped.getRateQuote('ZZX', 'USD', '2025-03-10', { workspaceId: 'ws-a' }),
      ).resolves.toEqual({ rate: 0.25, rateDate: '2025-03-10', stale: false });
      await expect(
        scoped.getRateQuote('ZZX', 'USD', '2025-03-10', { workspaceId: 'ws-b' }),
      ).resolves.toBeNull();
      await expect(scoped.getRateQuote('ZZX', 'USD', '2025-03-10')).resolves.toBeNull();
    });

    it('wins over the provider rate for its day', async () => {
      repo.findOne.mockResolvedValue({ rate: '0.30' });
      await scoped.setManualRate('ws-a', 'ZZX', 'USD', 0.25, '2025-03-10');

      await expect(scoped.getRate('ZZX', 'USD', '2025-03-10', 'ws-a')).resolves.toBe(0.25);
      await expect(scoped.getRate('ZZX', 'USD', '2025-03-10', 'ws-b')).resolves.toBe(0.3);
    });

    it('answers the reverse pair with the inverse rate', async () => {
      await scoped.setManualRate('ws-a', 'ZZX', 'USD', 0.25, '2025-03-10');

      await expect(scoped.getRateOrNull('USD', 'ZZX', '2025-03-10', 'ws-a')).resolves.toBe(4);
    });

    it('replaces the same day, also when entered for the reverse pair', async () => {
      await scoped.setManualRate('ws-a', 'ZZX', 'USD', 0.25, '2025-03-10');
      await scoped.setManualRate('ws-a', 'USD', 'ZZX', 5, '2025-03-10');

      expect(workspaceRates.rows).toHaveLength(1);
      await expect(scoped.getRateOrNull('ZZX', 'USD', '2025-03-10', 'ws-a')).resolves.toBe(0.2);
    });

    it('lends an earlier manual rate to a later day that has none', async () => {
      await scoped.setManualRate('ws-a', 'ZZX', 'USD', 0.25, '2025-03-01');

      await expect(
        scoped.getRateQuote('ZZX', 'USD', '2025-03-10', { workspaceId: 'ws-a' }),
      ).resolves.toEqual({ rate: 0.25, rateDate: '2025-03-01', stale: true });
      await expect(
        scoped.getRateQuote('ZZX', 'USD', '2025-03-10', { workspaceId: 'ws-a', maxStaleDays: 7 }),
      ).resolves.toBeNull();
    });

    it('does not query manual rates for a workspace that has none', async () => {
      await scoped.getRateQuote('ZZX', 'USD', '2025-03-10', { workspaceId: 'ws-empty' });
      await scoped.getRateQuote('ZZX', 'USD', '2025-03-11', { workspaceId: 'ws-empty' });

      expect(workspaceRates.findOne).not.toHaveBeenCalled();
    });
  });
});
