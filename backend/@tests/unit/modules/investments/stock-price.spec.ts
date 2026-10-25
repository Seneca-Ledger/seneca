import { EffectRuntime } from '@/common/effect/effect-runtime';
import {
  currencyForSymbol,
  normalizeStockSymbol,
  parseStooqCsv,
  StockPriceService,
} from '@/modules/investments/stock-price.service';

vi.mock('@/common/utils/egress-url.util', () => ({
  assertPublicEgressUrl: vi.fn(async () => undefined),
}));

describe('stock prices', () => {
  it('reads closes out of the Stooq CSV and skips unknown symbols', () => {
    const csv = [
      'Symbol,Date,Time,Open,High,Low,Close,Volume',
      'AAPL.US,2026-09-30,22:00:00,230.1,235.2,229.0,233.45,51234567',
      'NOPE.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
      'VWCE.DE,2026-09-30,17:35:00,120,121,119.5,120.75,12345',
    ].join('\n');
    const quotes = parseStooqCsv(csv);
    expect(quotes.get('AAPL.US')).toEqual({ close: 233.45, date: '2026-09-30' });
    expect(quotes.get('VWCE.DE')?.close).toBe(120.75);
    expect(quotes.has('NOPE.US')).toBe(false);
  });

  it('defaults a bare ticker to the US market and reads the currency off the suffix', () => {
    expect(normalizeStockSymbol('aapl')).toBe('AAPL.US');
    expect(normalizeStockSymbol('vwce.de')).toBe('VWCE.DE');
    expect(currencyForSymbol('VWCE.DE')).toBe('EUR');
    expect(currencyForSymbol('AAPL.US')).toBe('USD');
    expect(currencyForSymbol('7203.JP')).toBe('JPY');
  });
});

describe('StockPriceService.getPrices', () => {
  const CLOSE = 233.45;
  const CSV = `Symbol,Date,Time,Open,High,Low,Close,Volume\nACME.US,2026-09-30,22:00:00,230,235,229,${CLOSE},100\n`;
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: StockPriceService;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new StockPriceService(new EffectRuntime());
  });

  it('quotes the symbols from the CSV and caches them', async () => {
    fetchMock.mockImplementation(async () => new Response(CSV, { status: 200 }));

    const first = await service.getPrices(['acme']);
    const second = await service.getPrices(['ACME.US']);

    expect(first.get('ACME.US')).toMatchObject({ price: CLOSE, currency: 'USD' });
    expect(second.get('ACME.US')?.price).toBe(CLOSE);
    expect(String(fetchMock.mock.calls[0][0])).toContain('s=acme.us');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the price out, asking once, when Stooq refuses', async () => {
    fetchMock.mockImplementation(async () => new Response('busy', { status: 503 }));

    await expect(service.getPrices(['ACME'])).resolves.toEqual(new Map());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the price out when Stooq cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.getPrices(['ACME'])).resolves.toEqual(new Map());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
