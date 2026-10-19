import { parseExpenseText } from '../../../../src/modules/telegram/telegram-inbound.util';

describe('parseExpenseText', () => {
  it('reads "merchant amount"', () => {
    expect(parseExpenseText('coffee 4.50')).toEqual({ amount: 4.5, currency: null, merchant: 'coffee' });
  });

  it('reads "amount merchant" with a comma decimal and a currency symbol', () => {
    expect(parseExpenseText('4,50 € кофе')).toEqual({ amount: 4.5, currency: 'EUR', merchant: 'кофе' });
  });

  it('reads a currency code after the amount and a multi-word merchant', () => {
    expect(parseExpenseText('lunch at Lido 12.30 EUR')).toEqual({
      amount: 12.3,
      currency: 'EUR',
      merchant: 'lunch at Lido',
    });
  });

  it('reads a glued local currency', () => {
    expect(parseExpenseText('такси 1500тг')).toEqual({ amount: 1500, currency: 'KZT', merchant: 'такси' });
  });

  it('leaves the merchant empty when only an amount was sent', () => {
    expect(parseExpenseText('25')).toEqual({ amount: 25, currency: null, merchant: '' });
  });

  it('refuses commands, text without a number and zero amounts', () => {
    expect(parseExpenseText('/report')).toBeNull();
    expect(parseExpenseText('hello there')).toBeNull();
    expect(parseExpenseText('coffee 0')).toBeNull();
  });

  it('does not mistake a date for an amount when a proper amount follows', () => {
    expect(parseExpenseText('parking 12.50')).toEqual({ amount: 12.5, currency: null, merchant: 'parking' });
  });

  it('strips separators around the merchant', () => {
    expect(parseExpenseText('— coffee: 4.50')).toEqual({ amount: 4.5, currency: null, merchant: 'coffee' });
  });

  it('stays linear on a long run of separators inside the merchant', () => {
    const text = `coffee${' -'.repeat(50_000)}x 4.50`;
    const startedAt = Date.now();
    expect(parseExpenseText(text)?.amount).toBe(4.5);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});
