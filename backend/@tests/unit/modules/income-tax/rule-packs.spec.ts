import { deEuerPack } from '@/modules/income-tax/rule-packs/de/euer';
import { germanIncomeTax } from '@/modules/income-tax/rule-packs/de/tariff';
import { esEdsPack } from '@/modules/income-tax/rule-packs/es/modelo100-eds';
import {
  findPack,
  genericSummaryPack,
  type PackInput,
  resolvePack,
  suggestLine,
} from '@/modules/income-tax/rule-packs';

const item = (amountMinor: number, counterparty = 'Client') => ({ counterparty, amountMinor });

const input = (over: Partial<PackInput> = {}): PackInput => ({
  taxYear: 2025,
  items: {},
  details: {},
  ...over,
});

const figureOf = (figures: Array<{ key: string }>, key: string) =>
  figures.find(figure => figure.key === key) as
    | { amountMinor: number; deductibleMinor: number; lineNo: string | null }
    | undefined;

describe('German tariff § 32a EStG 2026', () => {
  it.each([
    [0, 0],
    [12_348, 0],
    [12_349, 0],
    [17_799, 1_034],
    [17_800, 1_035],
    [69_878, 18_213],
    [69_879, 18_213],
    [277_825, 105_550],
    [277_826, 105_551],
  ])('taxes %i EUR as %i EUR', (income, tax) => {
    expect(germanIncomeTax(income, 2026)).toBe(tax);
  });

  it('rounds the taxable income down to a whole euro first', () => {
    expect(germanIncomeTax(17_799.99, 2026)).toBe(germanIncomeTax(17_799, 2026));
  });

  it('has no tariff for a year that was not verified', () => {
    expect(germanIncomeTax(50_000, 2024)).toBeNull();
  });
});

describe('German tariff § 32a EStG 2025', () => {
  // Spot values from exact decimal arithmetic on the BGBl. 2024 I Nr. 449 formula.
  it.each([
    [12_096, 0],
    [20_000, 1_639],
    [50_000, 10_691],
    [100_000, 31_088],
    [300_000, 115_753],
  ])('taxes %i EUR as %i EUR', (income, tax) => {
    expect(germanIncomeTax(income, 2025)).toBe(tax);
  });

  it('differs from 2026 because the Grundfreibetrag moved', () => {
    expect(germanIncomeTax(20_000, 2026)).toBe(1_570);
    expect(germanIncomeTax(12_348, 2025)).toBeGreaterThan(0);
  });
});

describe('Anlage EÜR 2025 line numbers', () => {
  it('carries the BMF form numbers for the VAT, gift, entertainment and catch-all lines', () => {
    const byKey = Object.fromEntries(deEuerPack.lines.map(line => [line.key, [line.lineNo, line.fieldNo]]));
    expect(byKey).toMatchObject({
      vat_received: ['17', '140'],
      vat_refunded: ['18', '141'],
      input_vat_paid: ['57', '185'],
      vat_paid_to_office: ['58', '186'],
      other_expenses: ['60', '183'],
      gifts: ['62', '164 / 174'],
      entertainment: ['63', '165 / 175'],
    });
    // Only the line that is not on the form has no number.
    expect(deEuerPack.lines.filter(line => line.lineNo === null).map(line => line.key)).toEqual([
      'not_business',
    ]);
  });
});

describe('Anlage EÜR', () => {
  it('sums income, expenses and profit onto the published lines', () => {
    const result = deEuerPack.compute(
      input({
        items: {
          revenue_vatable: [item(10_000_00), item(2_000_00)],
          rent: [item(3_000_00)],
          advertising: [item(500_00)],
          not_business: [item(999_00)],
        },
      }),
    );

    expect(figureOf(result.figures, 'income_total')).toMatchObject({
      lineNo: '23',
      amountMinor: 12_000_00,
    });
    expect(figureOf(result.figures, 'expense_total')?.amountMinor).toBe(3_500_00);
    expect(figureOf(result.figures, 'profit')).toMatchObject({ lineNo: '97', amountMinor: 8_500_00 });
  });

  it('treats a refund booked to an expense line as a reduction', () => {
    const result = deEuerPack.compute(input({ items: { rent: [item(1_000_00), item(-200_00)] } }));
    expect(figureOf(result.figures, 'expense_total')?.amountMinor).toBe(800_00);
  });

  it('deducts 70% of business entertainment and asks for the records', () => {
    const result = deEuerPack.compute(input({ items: { entertainment: [item(100_00)] } }));

    expect(figureOf(result.figures, 'entertainment')).toMatchObject({
      amountMinor: 100_00,
      deductibleMinor: 70_00,
    });
    expect(result.warnings.map(w => w.code)).toContain('de_entertainment_records');
  });

  it('drops every gift to a recipient once that recipient passes 50 EUR', () => {
    const result = deEuerPack.compute(
      input({
        items: { gifts: [item(40_00, 'Anna'), item(30_00, 'Ben'), item(30_00, 'ben ')] },
      }),
    );

    expect(figureOf(result.figures, 'gifts')?.deductibleMinor).toBe(40_00);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'de_gift_limit_exceeded', params: expect.objectContaining({ recipient: 'ben' }) }),
    );
  });

  it('caps the daily home-office allowance at 1,260 EUR', () => {
    const result = deEuerPack.compute(input({ details: { homeOfficeDays: 250 } }));
    expect(figureOf(result.figures, 'home_office')).toMatchObject({
      lineNo: '66',
      amountMinor: 1_260_00,
    });
  });

  it('uses only the annual study flat rate when both are claimed, reduced per missing month', () => {
    const result = deEuerPack.compute(
      input({ details: { homeOfficeDays: 100, homeStudyMonths: 6 } }),
    );

    expect(figureOf(result.figures, 'home_office')).toMatchObject({
      lineNo: '65',
      amountMinor: 630_00,
    });
    expect(result.warnings.map(w => w.code)).toContain('de_home_office_exclusive');
  });

  it('warns when a small business books revenue subject to VAT', () => {
    const result = deEuerPack.compute(
      input({ details: { smallBusiness: true }, items: { revenue_vatable: [item(1_00)] } }),
    );
    expect(result.warnings.map(w => w.code)).toContain('de_small_business_with_vat_revenue');
  });

  it('estimates tax only for a year with a verified tariff', () => {
    const items = { revenue_vatable: [item(30_000_00)] };

    expect(deEuerPack.compute(input({ taxYear: 2024, items })).taxEstimate).toBeNull();
    expect(deEuerPack.compute(input({ taxYear: 2025, items })).taxEstimate?.amountMinor).toBe(
      (germanIncomeTax(30_000, 2025) as number) * 100,
    );

    const estimate = deEuerPack.compute(input({ taxYear: 2026, items })).taxEstimate;
    expect(estimate?.amountMinor).toBe((germanIncomeTax(30_000, 2026) as number) * 100);
    expect(estimate?.excludes.length).toBeGreaterThan(0);
  });
});

describe('Modelo 100, estimación directa simplificada', () => {
  it('takes 5% of the positive net income as the flat allowance', () => {
    const result = esEdsPack.compute(
      input({
        details: { activityKey: 'A05' },
        items: { business_income: [item(30_000_00)], deductible_expenses: [item(10_000_00)] },
      }),
    );

    expect(figureOf(result.figures, 'hard_to_justify')?.amountMinor).toBe(1_000_00);
    expect(figureOf(result.figures, 'net_income')?.amountMinor).toBe(19_000_00);
    expect(result.warnings).toEqual([]);
  });

  it('caps the allowance at 2,000 EUR', () => {
    const result = esEdsPack.compute(
      input({ details: { activityKey: 'A05' }, items: { business_income: [item(100_000_00)] } }),
    );
    expect(figureOf(result.figures, 'hard_to_justify')?.amountMinor).toBe(2_000_00);
  });

  it('gives no allowance on a loss', () => {
    const result = esEdsPack.compute(
      input({ details: { activityKey: 'A05' }, items: { deductible_expenses: [item(5_00)] } }),
    );
    expect(figureOf(result.figures, 'hard_to_justify')?.amountMinor).toBe(0);
  });

  it('switches the allowance off under the single-client reduction', () => {
    const result = esEdsPack.compute(
      input({
        details: { activityKey: 'A05', singleClientReduction: true },
        items: { business_income: [item(30_000_00)] },
      }),
    );

    expect(figureOf(result.figures, 'hard_to_justify')?.amountMinor).toBe(0);
    expect(result.warnings.map(w => w.code)).toContain('es_single_client_excludes_allowance');
  });

  it('flags a missing activity key and turnover above 600,000 EUR', () => {
    const codes = esEdsPack
      .compute(input({ details: { previousYearTurnover: 600_001 } }))
      .warnings.map(w => w.code);

    expect(codes).toEqual(['es_activity_key_missing', 'es_simplified_regime_unavailable']);
  });
});

describe('pack registry', () => {
  it('picks the country pack for a verified year and taxpayer type', () => {
    expect(resolvePack('de', 2025, 'self_employed')).toBe(deEuerPack);
    expect(resolvePack('ES', 2026, 'self_employed')).toBe(esEdsPack);
  });

  it('falls back to the generic summary everywhere else', () => {
    expect(resolvePack('DE', 2024, 'self_employed')).toBe(genericSummaryPack);
    expect(resolvePack('DE', 2025, 'employee')).toBe(genericSummaryPack);
    expect(resolvePack('AT', 2025, 'self_employed')).toBe(genericSummaryPack);
    expect(resolvePack(null, 2025, 'company')).toBe(genericSummaryPack);
  });

  it('finds packs by form key and proposes lines by system category name', () => {
    expect(findPack('de-euer')).toBe(deEuerPack);
    expect(findPack('nope')).toBeNull();
    expect(suggestLine(deEuerPack, 'Rent')).toBe('rent');
    expect(suggestLine(deEuerPack, 'Taxes')).toBeNull();
  });

  it('keeps line keys unique within every pack', () => {
    for (const pack of [deEuerPack, esEdsPack, genericSummaryPack]) {
      const keys = pack.lines.map(line => line.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('sums the generic summary', () => {
    const result = genericSummaryPack.compute(
      input({ items: { income: [item(500_00)], expense: [item(200_00)] } }),
    );
    expect(figureOf(result.figures, 'result')?.amountMinor).toBe(300_00);
  });
});
