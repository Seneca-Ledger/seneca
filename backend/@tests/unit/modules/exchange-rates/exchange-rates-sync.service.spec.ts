import { ExchangeRatesSyncService } from '@/modules/exchange-rates/exchange-rates-sync.service';

describe('ExchangeRatesSyncService', () => {
  let syncService: ExchangeRatesSyncService;
  const exchangeRatesService = {
    fetchAndCacheRates: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    syncService = new ExchangeRatesSyncService(exchangeRatesService);
  });

  it('syncs rates for USD, EUR, and RUB', async () => {
    await syncService.syncRates();

    expect(exchangeRatesService.fetchAndCacheRates).toHaveBeenCalledTimes(3);
    expect(exchangeRatesService.fetchAndCacheRates).toHaveBeenCalledWith('USD');
    expect(exchangeRatesService.fetchAndCacheRates).toHaveBeenCalledWith('EUR');
    expect(exchangeRatesService.fetchAndCacheRates).toHaveBeenCalledWith('RUB');
  });

  it('calls fetchAndCacheRates sequentially', async () => {
    const callOrder: string[] = [];
    exchangeRatesService.fetchAndCacheRates.mockImplementation(async (base: string) => {
      callOrder.push(base);
    });

    await syncService.syncRates();
    expect(callOrder).toEqual(['USD', 'EUR', 'RUB']);
  });
});
