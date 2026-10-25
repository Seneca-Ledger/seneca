import type { Mock } from 'vitest';
import { EffectRuntime } from '@/common/effect/effect-runtime';
import { BdiRatesService } from '@/modules/income-tax/bdi-rates.service';
import { NbpRatesService } from '@/modules/income-tax/nbp-rates.service';

const effects = new EffectRuntime();
afterAll(() => effects.onModuleDestroy());

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const status = (code: number) => new Response('', { status: code });

function createCache() {
  return { get: vi.fn().mockResolvedValue(undefined), set: vi.fn() };
}

describe('official tax rates over the network', () => {
  const originalFetch = global.fetch;
  let fetchMock: Mock;
  let cache: ReturnType<typeof createCache>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    cache = createCache();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('NBP', () => {
    const service = () => new NbpRatesService(cache as never, effects);
    // 2025-12-01..2025-12-31 is one 93-day window, so one call per year here.
    const now = new Date('2025-01-15T12:00:00Z');

    it('collects the windows, skipping one NBP has no quotes for', async () => {
      fetchMock
        .mockResolvedValueOnce(status(404))
        .mockResolvedValueOnce(json({ rates: [{ effectiveDate: '2025-01-10', mid: 4.05 }] }));

      const rates = await service().getYearRates('usd', 2025, new Date('2025-03-20T00:00:00Z'));

      expect(rates).toEqual([{ effectiveDate: '2025-01-10', mid: 4.05 }]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(cache.set).toHaveBeenCalledWith('nbp:a:USD:2025', rates, 4 * 3600);
    });

    it('rides out a busy NBP instead of losing the whole year', async () => {
      fetchMock
        .mockResolvedValueOnce(status(503))
        .mockResolvedValueOnce(json({ rates: [{ effectiveDate: '2025-01-10', mid: 4.05 }] }));

      await expect(service().getYearRates('USD', 2025, now)).resolves.toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up with null when NBP keeps failing or answers garbage', async () => {
      fetchMock.mockImplementation(async () => status(500));
      await expect(service().getYearRates('USD', 2025, now)).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);

      fetchMock.mockReset().mockImplementation(async () => json({ rates: [{ mid: 'x' }] }));
      await expect(service().getYearRates('USD', 2025, now)).resolves.toBeNull();
      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  describe("Banca d'Italia", () => {
    const service = () => new BdiRatesService(cache as never, effects);

    it('reads daily rates and monthly averages, skipping N.A.', async () => {
      fetchMock
        .mockResolvedValueOnce(
          json({
            rates: [
              { referenceDate: '2025-02-03', avgRate: '1.03' },
              { referenceDate: '2025-02-04', avgRate: 'N.A.' },
            ],
          }),
        )
        .mockResolvedValueOnce(json({ rates: [{ referenceDate: '2025-02', avgRate: 1.04 }] }));

      const rates = await service().getYearRates('USD', 2025, new Date('2025-03-01T00:00:00Z'));

      expect(rates).toEqual({
        daily: [{ date: '2025-02-03', perEuro: 1.03 }],
        monthly: { '2025-02': 1.04 },
      });
      expect(String(fetchMock.mock.calls[1][0])).toContain('monthlyTimeSeries');
    });

    it('returns null when Banca d’Italia cannot be reached', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      await expect(
        service().getYearRates('USD', 2025, new Date('2025-03-01T00:00:00Z')),
      ).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
});
