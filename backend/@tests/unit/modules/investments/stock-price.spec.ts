import {
  currencyForSymbol,
  normalizeStockSymbol,
  parseStooqCsv,
} from '@/modules/investments/stock-price.service';

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
