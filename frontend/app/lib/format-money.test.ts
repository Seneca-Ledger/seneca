// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { formatMoney } from './format-money';
import { formatWholeNumber } from './user-format-store';

const amount = 1234.56;
const storeUser = (user: Record<string, unknown>) =>
  window.localStorage.setItem('user', JSON.stringify({ locale: 'en', ...user }));

describe('formatMoney rounding preference', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps whole units by default', () => {
    expect(formatMoney(amount, 'EUR', 'en', { fractionDigits: 0 })).toBe('€1,235');
    storeUser({ roundAmounts: true });
    expect(formatMoney(amount, 'EUR', 'en', { fractionDigits: 0 })).toBe('€1,235');
  });

  it('shows cents when rounding is turned off', () => {
    storeUser({ roundAmounts: false });

    expect(formatMoney(amount, 'EUR', 'en', { fractionDigits: 0 })).toBe('€1,234.56');
    expect(formatMoney(amount, 'EUR', 'en')).toBe('€1,234.56');
  });

  it('leaves a finer precision and compact axis labels alone', () => {
    storeUser({ roundAmounts: false });

    expect(formatMoney(0.12345, 'EUR', 'en', { fractionDigits: 4 })).toBe('€0.1235');
    expect(formatMoney(amount, 'EUR', 'en', { notation: 'compact' })).toBe('€1.2K');
  });

  it('applies to plain whole-units numbers too', () => {
    expect(formatWholeNumber(amount)).toBe('1,235');
    storeUser({ roundAmounts: false });
    expect(formatWholeNumber(amount)).toBe('1,234.56');
  });
});
