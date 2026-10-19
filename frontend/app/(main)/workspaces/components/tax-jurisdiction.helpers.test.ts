import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type JurisdictionRate,
  flagFor,
  formatRate,
  ratesInForce,
  supportMailto,
  todayLocal,
} from './tax-jurisdiction.helpers';

const rate = (over: Partial<JurisdictionRate>): JurisdictionRate => ({
  code: 'X',
  name: 'X',
  rate: '10.00',
  kind: 'standard',
  isDefault: false,
  validFrom: '1900-01-01',
  validTo: null,
  ...over,
});

describe('formatRate', () => {
  it('drops trailing zeros that read as false precision', () => {
    expect(formatRate('12.00')).toBe('12%');
    expect(formatRate('5.50')).toBe('5.5%');
    expect(formatRate(0)).toBe('0%');
  });

  it('degrades rather than printing NaN', () => {
    expect(formatRate('not a number')).toBe('—');
  });
});

describe('ratesInForce', () => {
  const KZ = [
    rate({ code: 'OLD', rate: '12.00', validFrom: '1900-01-01', validTo: '2025-12-31' }),
    rate({ code: 'NEW', rate: '16.00', validFrom: '2026-01-01', validTo: null, isDefault: true }),
    rate({ code: 'ZERO', rate: '0.00' }),
  ];

  it('keeps the version that applies on the date', () => {
    expect(ratesInForce(KZ, '2025-06-01').map(r => r.code)).toEqual(['OLD', 'ZERO']);
    expect(ratesInForce(KZ, '2026-06-01').map(r => r.code)).toEqual(['NEW', 'ZERO']);
  });

  it('treats both period ends as inclusive', () => {
    // The day a rate ends it still applies; the next day it does not.
    expect(ratesInForce(KZ, '2025-12-31').map(r => r.code)).toContain('OLD');
    expect(ratesInForce(KZ, '2026-01-01').map(r => r.code)).not.toContain('OLD');
  });

  it('puts the default first', () => {
    expect(ratesInForce(KZ, '2026-06-01')[0].code).toBe('NEW');
  });
});

describe('todayLocal', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 01:30 on the 1st in a zone ahead of UTC is still 22:30 on the previous
    // day in UTC. Sending the UTC date would ask the API for the wrong day.
    const localFirst = new Date(2026, 0, 1, 1, 30);
    expect(todayLocal(localFirst)).toBe('2026-01-01');
  });

  it('zero-pads', () => {
    expect(todayLocal(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});

describe('flagFor', () => {
  it('resolves a supported country', () => {
    expect(flagFor('kz')).not.toBeNull();
    expect(flagFor('DE')).not.toBeNull();
  });

  it('returns null for a country seeded without a flag here', () => {
    // The backend can add a jurisdiction without a frontend release; it must
    // render flagless rather than throw.
    expect(flagFor('JP')).toBeNull();
  });
});

describe('supportMailto', () => {
  const original = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = original;
  });

  it('is absent until an address is configured', () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = '';
    // Better no link than one that silently goes nowhere.
    expect(supportMailto('subject')).toBeNull();
  });

  it('builds an encoded mailto when configured', () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'help@example.com';
    expect(supportMailto('Tax rate correction')).toBe(
      'mailto:help@example.com?subject=Tax%20rate%20correction',
    );
  });
});
