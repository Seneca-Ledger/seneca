import { JURISDICTION_SEED, type SeedRate } from '@/modules/tax/jurisdictions.seed';
import { TaxRateKind } from '@/entities/tax-jurisdiction-rate.entity';
import { TaxScheme } from '@/entities/tax-jurisdiction.entity';

/**
 * The seed encodes tax law, so these tests guard its internal consistency
 * rather than the code that reads it. A broken validity window here would
 * silently produce a wrong return months later.
 */

/** Same window predicate the service pushes down to Postgres. */
function inForceOn(rate: SeedRate, date: string): boolean {
  return rate.validFrom <= date && (rate.validTo === null || rate.validTo >= date);
}

function ratesOn(jurisdictionCode: string, date: string): SeedRate[] {
  const jurisdiction = JURISDICTION_SEED.find(j => j.code === jurisdictionCode);
  if (!jurisdiction) {
    throw new Error(`No seed for ${jurisdictionCode}`);
  }
  return jurisdiction.rates.filter(rate => inForceOn(rate, date));
}

describe('JURISDICTION_SEED', () => {
  it('has unique jurisdiction codes', () => {
    const codes = JURISDICTION_SEED.map(j => j.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses ISO-shaped codes and currencies', () => {
    for (const jurisdiction of JURISDICTION_SEED) {
      expect(jurisdiction.code).toMatch(/^[A-Z]{2}$/);
      expect(jurisdiction.currency).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('pairs a threshold amount with a threshold period', () => {
    for (const jurisdiction of JURISDICTION_SEED) {
      // One without the other is meaningless: an amount needs a window to be
      // measured over, and a window needs an amount to compare against.
      expect(jurisdiction.registrationThreshold === null).toBe(
        jurisdiction.thresholdPeriod === null,
      );
    }
  });

  it('gives every VAT jurisdiction at least one rate', () => {
    for (const jurisdiction of JURISDICTION_SEED) {
      if (jurisdiction.scheme === TaxScheme.VAT) {
        expect(jurisdiction.rates.length).toBeGreaterThan(0);
      }
    }
  });

  it('leaves US rate-less because sales tax is not modelled', () => {
    const us = JURISDICTION_SEED.find(j => j.code === 'US');
    expect(us?.scheme).toBe(TaxScheme.SALES_TAX);
    expect(us?.rates).toEqual([]);
  });

  it('never overlaps two versions of the same rate code', () => {
    for (const jurisdiction of JURISDICTION_SEED) {
      const byCode = new Map<string, SeedRate[]>();
      for (const rate of jurisdiction.rates) {
        byCode.set(rate.code, [...(byCode.get(rate.code) ?? []), rate]);
      }

      for (const [code, versions] of byCode) {
        const sorted = [...versions].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
        for (let i = 0; i < sorted.length - 1; i++) {
          const current = sorted[i];
          const next = sorted[i + 1];
          // An open-ended version must be the last one, and a closed one must
          // end strictly before the next begins.
          expect(current.validTo).not.toBeNull();
          expect(current.validTo! < next.validFrom).toBe(true);
        }
      }
    }
  });

  it('has exactly one default rate in force on any given date', () => {
    const probes = ['2024-06-15', '2025-12-31', '2026-01-01', '2030-01-01'];

    for (const jurisdiction of JURISDICTION_SEED) {
      if (jurisdiction.rates.length === 0) {
        continue;
      }

      for (const date of probes) {
        const defaults = jurisdiction.rates.filter(r => r.isDefault && inForceOn(r, date));
        expect({ code: jurisdiction.code, date, count: defaults.length }).toEqual({
          code: jurisdiction.code,
          date,
          count: 1,
        });
      }
    }
  });

  // The case the whole versioning design exists for.
  describe('KZ VAT reform', () => {
    it('applies 12% through 2025', () => {
      const standard = ratesOn('KZ', '2025-06-01').filter(r => r.kind === TaxRateKind.STANDARD);
      expect(standard).toHaveLength(1);
      expect(standard[0].rate).toBe(12);
    });

    it('still applies 12% on the last day of 2025', () => {
      const standard = ratesOn('KZ', '2025-12-31').filter(r => r.kind === TaxRateKind.STANDARD);
      expect(standard[0].rate).toBe(12);
    });

    it('applies 16% from 2026-01-01', () => {
      const standard = ratesOn('KZ', '2026-01-01').filter(r => r.kind === TaxRateKind.STANDARD);
      expect(standard).toHaveLength(1);
      expect(standard[0].rate).toBe(16);
    });

    it('keeps zero-rated and exempt available across the change', () => {
      for (const date of ['2025-06-01', '2026-06-01']) {
        const kinds = ratesOn('KZ', date).map(r => r.kind);
        expect(kinds).toContain(TaxRateKind.ZERO);
        expect(kinds).toContain(TaxRateKind.EXEMPT);
      }
    });
  });
  it("starts Austria's 4.9% food rate on 1 July 2026", () => {
    const rates = (date: string) => ratesOn('AT', date).map(rate => rate.rate);
    expect(rates('2026-06-30')).not.toContain(4.9);
    expect(rates('2026-07-01')).toContain(4.9);
  });
});
