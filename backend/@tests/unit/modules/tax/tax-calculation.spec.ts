import { toMinor } from '@/common/utils/money.util';
import { computeTax } from '@/modules/tax/tax-calculation';

describe('computeTax', () => {
  describe('tax-inclusive amounts', () => {
    it('extracts KZ 12% from a gross 100.00', () => {
      const result = computeTax({ amountMinor: 10000, rate: 12, isInclusive: true });

      expect(result).toEqual({
        netMinor: 8929,
        taxMinor: 1071,
        grossMinor: 10000,
        notionalTaxMinor: 1071,
      });
    });

    it('extracts KZ 16% from a gross 100.00', () => {
      const result = computeTax({ amountMinor: 10000, rate: 16, isInclusive: true });

      expect(result.taxMinor).toBe(1379);
      expect(result.netMinor).toBe(8621);
    });

    it('extracts DE 19% from a gross 119.00 back to exactly 100.00', () => {
      const result = computeTax({ amountMinor: 11900, rate: 19, isInclusive: true });

      expect(result.netMinor).toBe(10000);
      expect(result.taxMinor).toBe(1900);
    });
  });

  describe('tax-exclusive amounts', () => {
    it('adds 12% onto a net 100.00', () => {
      const result = computeTax({ amountMinor: 10000, rate: 12, isInclusive: false });

      expect(result).toEqual({
        netMinor: 10000,
        taxMinor: 1200,
        grossMinor: 11200,
        notionalTaxMinor: 1200,
      });
    });

    it('is the inverse of the inclusive path', () => {
      const exclusive = computeTax({ amountMinor: 10000, rate: 19, isInclusive: false });
      const inclusive = computeTax({
        amountMinor: exclusive.grossMinor,
        rate: 19,
        isInclusive: true,
      });

      expect(inclusive.netMinor).toBe(10000);
      expect(inclusive.taxMinor).toBe(exclusive.taxMinor);
    });
  });

  describe('zero and exempt rates', () => {
    it('charges nothing at 0%', () => {
      const result = computeTax({ amountMinor: 10000, rate: 0, isInclusive: true });

      expect(result).toEqual({
        netMinor: 10000,
        taxMinor: 0,
        grossMinor: 10000,
        notionalTaxMinor: 0,
      });
    });

    it('leaves a zero amount at zero', () => {
      const result = computeTax({ amountMinor: 0, rate: 20, isInclusive: true });
      expect(result).toEqual({ netMinor: 0, taxMinor: 0, grossMinor: 0, notionalTaxMinor: 0 });
    });
  });

  describe('refunds', () => {
    it('mirrors the charge it reverses, to the minor unit', () => {
      const charge = computeTax({ amountMinor: 10000, rate: 12, isInclusive: true });
      const refund = computeTax({ amountMinor: -10000, rate: 12, isInclusive: true });

      // If these disagreed by one unit, a sale and its refund would leave a
      // residue in the period they both fall in.
      expect(refund.taxMinor).toBe(-charge.taxMinor);
      expect(refund.netMinor).toBe(-charge.netMinor);
      expect(refund.grossMinor).toBe(-charge.grossMinor);
    });

    it('mirrors exactly on an amount that rounds at a half', () => {
      const charge = computeTax({ amountMinor: 1050, rate: 0, isInclusive: false });
      const refund = computeTax({ amountMinor: -1050, rate: 0, isInclusive: false });
      expect(refund.grossMinor).toBe(-charge.grossMinor);
    });
  });

  describe('reverse charge', () => {
    it('charges nothing but reports the notional tax', () => {
      const result = computeTax({
        amountMinor: 100000,
        rate: 19,
        isInclusive: true,
        isReverseCharge: true,
      });

      expect(result.taxMinor).toBe(0);
      expect(result.netMinor).toBe(100000);
      expect(result.grossMinor).toBe(100000);
      // Reported on both sides of the return, so the two entries cancel.
      expect(result.notionalTaxMinor).toBe(19000);
    });

    it('treats the amount as net regardless of the inclusive flag', () => {
      // A reverse-charge invoice carries no tax, so there is nothing inside
      // the amount to extract even when the rate is marked inclusive.
      const asInclusive = computeTax({
        amountMinor: 100000,
        rate: 19,
        isInclusive: true,
        isReverseCharge: true,
      });
      const asExclusive = computeTax({
        amountMinor: 100000,
        rate: 19,
        isInclusive: false,
        isReverseCharge: true,
      });

      expect(asInclusive).toEqual(asExclusive);
    });
  });

  describe('the reconciliation invariant', () => {
    const RATES = [0, 5, 7, 8, 12, 16, 19, 20, 23, 100];
    const AMOUNTS = [1, 7, 99, 100, 333, 1001, 10000, 12345, 999999, -1, -7, -12345];

    it('keeps net + tax === gross for every rate and amount', () => {
      for (const rate of RATES) {
        for (const amountMinor of AMOUNTS) {
          for (const isInclusive of [true, false]) {
            const { netMinor, taxMinor, grossMinor } = computeTax({
              amountMinor,
              rate,
              isInclusive,
            });

            expect({ rate, amountMinor, isInclusive, sum: netMinor + taxMinor }).toEqual({
              rate,
              amountMinor,
              isInclusive,
              sum: grossMinor,
            });
          }
        }
      }
    });

    it('returns whole minor units only', () => {
      for (const rate of RATES) {
        for (const amountMinor of AMOUNTS) {
          const result = computeTax({ amountMinor, rate, isInclusive: true });
          for (const value of Object.values(result)) {
            expect(Number.isInteger(value)).toBe(true);
          }
        }
      }
    });

    it('never lets tax exceed the gross amount', () => {
      for (const rate of RATES) {
        const { taxMinor, grossMinor } = computeTax({
          amountMinor: 10000,
          rate,
          isInclusive: true,
        });
        expect(Math.abs(taxMinor)).toBeLessThanOrEqual(Math.abs(grossMinor));
      }
    });
  });

  describe('input validation', () => {
    it('rejects fractional minor units', () => {
      expect(() => computeTax({ amountMinor: 100.5, rate: 12, isInclusive: true })).toThrow(
        /whole minor units/,
      );
    });

    it('rejects rates outside 0..100', () => {
      expect(() => computeTax({ amountMinor: 100, rate: -1, isInclusive: true })).toThrow();
      expect(() => computeTax({ amountMinor: 100, rate: 101, isInclusive: true })).toThrow();
      expect(() => computeTax({ amountMinor: 100, rate: Number.NaN, isInclusive: true })).toThrow();
    });
  });

  describe('working from major units', () => {
    it('composes with toMinor for a realistic receipt', () => {
      const result = computeTax({
        amountMinor: toMinor('1234.56'),
        rate: 12,
        isInclusive: true,
      });

      expect(result.grossMinor).toBe(123456);
      expect(result.netMinor + result.taxMinor).toBe(123456);
    });
  });
});
