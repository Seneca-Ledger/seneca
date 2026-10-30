import { CurrencyConverter } from '@/modules/exchange-rates/currency-converter';

/** Answers `getRateCurve` from a fixed curve per currency. */
function ratesWithCurves(curves: Record<string, Array<{ date: string; rate: number }>>) {
  return {
    getRateCurve: vi.fn(async (from: string) => curves[from] ?? []),
  } as any;
}

const DATES = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04'];

describe('CurrencyConverter.loadRange', () => {
  it('holds a rate until the next quote on the curve', async () => {
    const exchangeRates = ratesWithCurves({
      EUR: [
        { date: '2026-03-01', rate: 500 },
        { date: '2026-03-03', rate: 520 },
      ],
    });

    const converter = await CurrencyConverter.loadRange(
      exchangeRates,
      'KZT',
      ['EUR'],
      DATES,
      'ws-1',
    );

    expect(DATES.map(date => converter.convert(1, 'EUR', date))).toEqual([500, 500, 520, 520]);
  });

  it('asks for each currency once, however many days are charted', async () => {
    const exchangeRates = ratesWithCurves({ EUR: [{ date: '2026-03-01', rate: 500 }] });

    await CurrencyConverter.loadRange(exchangeRates, 'KZT', ['EUR', 'EUR'], DATES, 'ws-1');

    expect(exchangeRates.getRateCurve).toHaveBeenCalledTimes(1);
    expect(exchangeRates.getRateCurve).toHaveBeenCalledWith(
      'EUR',
      'KZT',
      '2026-03-01',
      '2026-03-04',
      'ws-1',
    );
  });

  it('leaves days before the first quote unconverted and names the currency', async () => {
    const exchangeRates = ratesWithCurves({ EUR: [{ date: '2026-03-03', rate: 500 }] });

    const converter = await CurrencyConverter.loadRange(
      exchangeRates,
      'KZT',
      ['EUR'],
      DATES,
      'ws-1',
    );

    expect(converter.convert(1, 'EUR', '2026-03-01')).toBe(0);
    expect(converter.convert(1, 'EUR', '2026-03-03')).toBe(500);
    expect(converter.missing).toEqual(['EUR']);
  });

  it('never asks for a rate from the target to itself', async () => {
    const exchangeRates = ratesWithCurves({});

    const converter = await CurrencyConverter.loadRange(
      exchangeRates,
      'KZT',
      ['KZT'],
      DATES,
      'ws-1',
    );

    expect(exchangeRates.getRateCurve).not.toHaveBeenCalled();
    expect(converter.convert(7, 'KZT', '2026-03-01')).toBe(7);
  });

  it('reports a code that is not a currency as missing instead of guessing 1:1', async () => {
    const exchangeRates = ratesWithCurves({});

    const converter = await CurrencyConverter.loadRange(
      exchangeRates,
      'KZT',
      ['BTC-WALLET'],
      DATES,
      'ws-1',
    );

    expect(exchangeRates.getRateCurve).not.toHaveBeenCalled();
    expect(converter.convert(1, 'BTC-WALLET', '2026-03-01')).toBe(0);
    expect(converter.missing).toEqual(['BTC-WALLET']);
  });
});
