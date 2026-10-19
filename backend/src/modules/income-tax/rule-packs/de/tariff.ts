/**
 * German income-tax tariff, § 32a Abs. 1 EStG, for a single assessment.
 *
 * Parameters are keyed by assessment year and only contain years checked
 * against the statutory text (gesetze-im-internet.de/estg/__32a.html). A year
 * that is missing returns NULL rather than borrowing a neighbour's figures:
 * the Grundfreibetrag changes almost every year, and an estimate built on the
 * wrong one is worse than none.
 */

interface TariffYear {
  /** Upper bound of each zone, in whole euros. The last zone is open-ended. */
  zone1End: number;
  zone2End: number;
  zone3End: number;
  zone4End: number;
  zone2: { a: number; b: number };
  zone3: { a: number; b: number; c: number };
  zone4: { rate: number; minus: number };
  zone5: { rate: number; minus: number };
}

const TARIFF: Record<number, TariffYear> = {
  // BGBl. 2024 I Nr. 449 (Steuerfortentwicklungsgesetz), Art. 1 Nr. 2, "ab dem
  // Veranlagungszeitraum 2025"; matches BMF Lohnsteuer2025 UPTAB25 (GFB 12 096).
  2025: {
    zone1End: 12_096,
    zone2End: 17_443,
    zone3End: 68_480,
    zone4End: 277_825,
    zone2: { a: 932.3, b: 1_400 },
    zone3: { a: 176.64, b: 2_397, c: 1_015.13 },
    zone4: { rate: 0.42, minus: 10_911.92 },
    zone5: { rate: 0.45, minus: 19_246.67 },
  },
  2026: {
    zone1End: 12_348,
    zone2End: 17_799,
    zone3End: 69_878,
    zone4End: 277_825,
    zone2: { a: 914.51, b: 1_400 },
    zone3: { a: 173.1, b: 2_397, c: 1_034.87 },
    zone4: { rate: 0.42, minus: 11_135.63 },
    zone5: { rate: 0.45, minus: 19_470.38 },
  },
};

export function hasGermanTariff(year: number): boolean {
  return year in TARIFF;
}

/**
 * Tax in whole euros for a taxable income in whole euros.
 *
 * Both ends are rounded down, as § 32a Abs. 1 prescribes: the taxable income
 * to a full euro before the formula, the resulting tax to a full euro after.
 */
export function germanIncomeTax(taxableIncomeEuros: number, year: number): number | null {
  const tariff = TARIFF[year];
  if (!tariff) {
    return null;
  }

  const x = Math.floor(Math.max(0, taxableIncomeEuros));

  if (x <= tariff.zone1End) {
    return 0;
  }
  if (x <= tariff.zone2End) {
    const y = (x - tariff.zone1End) / 10_000;
    return Math.floor((tariff.zone2.a * y + tariff.zone2.b) * y);
  }
  if (x <= tariff.zone3End) {
    const z = (x - tariff.zone2End) / 10_000;
    return Math.floor((tariff.zone3.a * z + tariff.zone3.b) * z + tariff.zone3.c);
  }
  if (x <= tariff.zone4End) {
    return Math.floor(tariff.zone4.rate * x - tariff.zone4.minus);
  }
  return Math.floor(tariff.zone5.rate * x - tariff.zone5.minus);
}
