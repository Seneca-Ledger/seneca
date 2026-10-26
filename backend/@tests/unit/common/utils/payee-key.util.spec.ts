import { payeeKeyOf } from '@/common/utils/payee-key.util';

/**
 * The payee key is the only thing the history layer keys on, so its single
 * requirement is: the same shop twice in a row produces the same key, and two
 * different shops do not. It is an internal key — it is never shown instead of
 * the raw descriptor and never used to match a rule the user wrote.
 */
describe('payeeKeyOf', () => {
  describe('the same shop twice', () => {
    it.each([
      ['SQ *BLUE BOTTLE COFFEE 8821  OAKLAND CA', 'SQ *BLUE BOTTLE COFFEE 9113  OAKLAND CA'],
      ['REWE SAGT DANKE 6334 //BERLIN/DE', 'REWE SAGT DANKE 1182 //BERLIN/DE'],
      ['AMZN Mktp DE*2R45T9SK3', 'AMZN Mktp DE*7K12P0QD8'],
      ['CARREFOUR MARKET 2281 PARIS', 'CARREFOUR MARKET 4417 PARIS'],
      ['PAYPAL *SPOTIFY  35314369001', 'PAYPAL *SPOTIFY  35319988214'],
      ['LIDL SAGT DANKE 12.03.26', 'LIDL SAGT DANKE 29.04.26'],
      ['UBER   *TRIP HELP.UBER.COM', 'UBER *TRIP HELP.UBER.COM'],
    ])('gives one key for %s and %s', (first, second) => {
      expect(payeeKeyOf({ counterpartyName: first })).toBe(
        payeeKeyOf({ counterpartyName: second }),
      );
      expect(payeeKeyOf({ counterpartyName: first })).not.toBeNull();
    });
  });

  describe('different shops', () => {
    it.each([
      ['REWE SAGT DANKE 6334', 'EDEKA CITY MARKT 6334'],
      ['SQ *BLUE BOTTLE COFFEE', 'SQ *FOUR BARREL COFFEE'],
      ['PAYPAL *SPOTIFY', 'PAYPAL *NETFLIX'],
    ])('keeps %s and %s apart', (first, second) => {
      expect(payeeKeyOf({ counterpartyName: first })).not.toBe(
        payeeKeyOf({ counterpartyName: second }),
      );
    });
  });

  describe('what it strips', () => {
    it.each([
      ['SQ *BLUE BOTTLE COFFEE', 'blue bottle coffee'],
      ['PAYPAL *SPOTIFY', 'spotify'],
      ['SUMUP  *CAFE EINSTEIN', 'cafe einstein'],
      ['IZ *BAECKEREI MUELLER', 'baeckerei mueller'],
      ['REWE SAGT DANKE 6334 //BERLIN/DE', 'rewe sagt danke berlin de'],
      ['  Deutsche   Telekom AG  ', 'deutsche telekom ag'],
      ['CAFÉ EINSTEIN STAMMHAUS', 'cafe einstein stammhaus'],
    ])('%s -> %s', (raw, expected) => {
      expect(payeeKeyOf({ counterpartyName: raw })).toBe(expected);
    });
  });

  describe('when there is nothing to key on', () => {
    it.each(['', '   ', '1234567', '***', 'Неизвестный контрагент', 'Unknown'])(
      'returns null for %s',
      raw => {
        expect(payeeKeyOf({ counterpartyName: raw })).toBeNull();
      },
    );

    it.each([
      'Invoice number295560440015',
      'Invoice No. 2955-6044-0015',
      'Tax invoice #INV-2026-0042',
      'Receipt 2333-5432-2082',
      'Rechnung Nr. 4711',
      'Счёт № 15',
      'Unknown merchant',
    ])('returns null for %s, which names the document and not who issued it', raw => {
      expect(payeeKeyOf({ counterpartyName: raw })).toBeNull();
    });

    it('keeps a name that only starts with a document word', () => {
      expect(payeeKeyOf({ counterpartyName: 'Invoice Ninja GmbH' })).toBe('invoice ninja gmbh');
    });

    it('falls back to the payment purpose when the counterparty is only a document word', () => {
      expect(
        payeeKeyOf({ counterpartyName: 'Invoice 4711', paymentPurpose: 'HETZNER ONLINE GMBH' }),
      ).toBe('hetzner online gmbh');
    });

    it('falls back to the payment purpose when the counterparty is unnamed', () => {
      expect(
        payeeKeyOf({ counterpartyName: 'Unknown', paymentPurpose: 'SPOTIFY AB MONTHLY' }),
      ).toBe('spotify ab monthly');
    });

    it('ignores the payment purpose when the counterparty is named', () => {
      expect(
        payeeKeyOf({ counterpartyName: 'EDEKA HAMBURG', paymentPurpose: 'Kartenzahlung 4711' }),
      ).toBe('edeka hamburg');
    });
  });

  it('is stable across the casing and spacing a bank happens to use', () => {
    const variants = ['EDEKA CITY MARKT', 'Edeka City Markt', 'edeka  city   markt'];
    const keys = new Set(variants.map(name => payeeKeyOf({ counterpartyName: name })));

    expect(keys.size).toBe(1);
  });
});
