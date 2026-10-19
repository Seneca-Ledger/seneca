import { fromMinor, roundHalfAwayFromZero, toMinor } from '@/common/utils/money.util';

describe('money.util', () => {
  describe('roundHalfAwayFromZero', () => {
    it('rounds a positive half up', () => {
      expect(roundHalfAwayFromZero(0.5)).toBe(1);
      expect(roundHalfAwayFromZero(2.5)).toBe(3);
    });

    it('rounds a negative half away from zero, unlike Math.round', () => {
      // Math.round(-0.5) is -0 and Math.round(-2.5) is -2, which would make a
      // refund a cent different from the charge it reverses.
      expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
      expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    });

    it('is symmetric about zero', () => {
      for (const value of [0.4, 0.5, 0.6, 1.5, 10.71, 1071.4285]) {
        expect(roundHalfAwayFromZero(-value)).toBe(-roundHalfAwayFromZero(value));
      }
    });
  });

  describe('toMinor', () => {
    it('converts numbers', () => {
      expect(toMinor(100)).toBe(10000);
      expect(toMinor(89.29)).toBe(8929);
      expect(toMinor(0)).toBe(0);
      expect(toMinor(-45.5)).toBe(-4550);
    });

    it('converts the strings TypeORM returns for decimal columns', () => {
      expect(toMinor('100.00')).toBe(10000);
      expect(toMinor('89.29')).toBe(8929);
      expect(toMinor('-45.50')).toBe(-4550);
    });

    it('survives values that are not exact in binary floating point', () => {
      // 8.29 * 100 is 828.9999999999999 in IEEE 754.
      expect(toMinor(8.29)).toBe(829);
      expect(toMinor(1.1)).toBe(110);
      expect(toMinor(2.675)).toBe(268);
    });

    it('rejects values that are not finite', () => {
      expect(() => toMinor(Number.NaN)).toThrow();
      expect(() => toMinor(Number.POSITIVE_INFINITY)).toThrow();
      expect(() => toMinor('not a number')).toThrow();
    });

    it('rejects amounts too large to stay exact', () => {
      // Silently returning a nearly-right integer is the worst outcome here.
      expect(() => toMinor(1e15)).toThrow(/too large/);
    });
  });

  describe('fromMinor', () => {
    it('converts back to major units', () => {
      expect(fromMinor(10000)).toBe(100);
      expect(fromMinor(8929)).toBe(89.29);
      expect(fromMinor(-4550)).toBe(-45.5);
    });

    it('rejects fractional minor units', () => {
      expect(() => fromMinor(10.5)).toThrow();
    });

    it('round-trips every two-decimal value', () => {
      for (const value of [0, 0.01, 1.99, 12.34, 999.99, -0.01, -1234.56]) {
        expect(fromMinor(toMinor(value))).toBe(value);
      }
    });
  });
});
