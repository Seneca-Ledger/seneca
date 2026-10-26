import { buildUstva, type UstvaRow } from '@/modules/tax/ustva/ustva-form';

let next = 0;
const row = (overrides: Partial<UstvaRow>): UstvaRow => ({
  transactionId: `tx-${++next}`,
  direction: 'income',
  reverseCharge: false,
  ratePercent: 19,
  net: 100,
  tax: 19,
  payeeId: null,
  payeeName: null,
  supplyType: null,
  ...overrides,
});

const field = (form: ReturnType<typeof buildUstva>, kz: string) =>
  form?.fields.find(item => item.kz === kz);

describe('buildUstva', () => {
  it('knows only the forms read against the BMF letter', () => {
    expect(buildUstva(2025, [])).toBeNull();
    expect(buildUstva(2026, [])).toMatchObject({ form: 'USt 1 A', year: 2026, fields: [], kz83: 0 });
  });

  it('puts domestic sales on lines 13 and 14 in whole euros, input tax on line 38', () => {
    const form = buildUstva(2026, [
      row({ net: 1000.6, tax: 190.11 }),
      row({ net: 250.99, tax: 47.69 }),
      row({ ratePercent: 7, net: 200.5, tax: 14.04 }),
      row({ direction: 'expense', net: 300, tax: 57.01 }),
    ]);
    expect(field(form, '81')).toMatchObject({ line: 13, kind: 'base', amount: 1251 });
    expect(field(form, '86')).toMatchObject({ line: 14, amount: 200 });
    expect(field(form, '66')).toMatchObject({ line: 38, kind: 'tax', amount: 57.01 });
    // The form's own arithmetic: 1251 × 19 % + 200 × 7 % − 57.01.
    expect(form?.kz83).toBe(237.69 + 14 - 57.01);
  });

  it('drops the cents of a negative base towards zero too', () => {
    const form = buildUstva(2026, [row({ net: -10.7, tax: -2.03 })]);
    expect(field(form, '81')?.amount).toBe(-10);
  });

  it('declares a reverse-charged service bought in the EU on lines 30 and 41', () => {
    const form = buildUstva(2026, [
      row({ direction: 'expense', reverseCharge: true, net: 500, tax: 95, supplyType: 'services' }),
    ]);
    expect(field(form, '46')).toMatchObject({ line: 30, amount: 500 });
    expect(field(form, '47')).toMatchObject({ line: 30, amount: 95 });
    expect(field(form, '67')).toMatchObject({ line: 41, amount: 95 });
    expect(form?.kz83).toBe(0);
  });

  it('declares goods bought in the EU as an intra-Community acquisition', () => {
    const form = buildUstva(2026, [
      row({ direction: 'expense', reverseCharge: true, net: 1000, tax: 190, supplyType: 'goods' }),
      row({ direction: 'expense', reverseCharge: true, ratePercent: 7, net: 100, tax: 7, supplyType: 'goods' }),
    ]);
    expect(field(form, '89')).toMatchObject({ line: 25, amount: 1000 });
    expect(field(form, '93')).toMatchObject({ line: 26, amount: 100 });
    expect(field(form, '61')).toMatchObject({ line: 39, amount: 197 });
    expect(form?.kz83).toBe(0);
  });

  it('declares sales to EU businesses by what was supplied', () => {
    const form = buildUstva(2026, [
      row({ reverseCharge: true, net: 800, tax: 152, supplyType: 'goods' }),
      row({ reverseCharge: true, net: 300.5, tax: 57.1, supplyType: 'services' }),
    ]);
    expect(field(form, '41')).toMatchObject({ line: 19, amount: 800 });
    expect(field(form, '21')).toMatchObject({ line: 35, amount: 300 });
    // Neither is taxed here.
    expect(form?.kz83).toBe(0);
  });

  it('leaves what the data cannot place as open items, grouped by payee, outside Kz 83', () => {
    const form = buildUstva(2026, [
      row({ direction: 'expense', reverseCharge: true, net: 40, tax: 7.6, payeeId: 'p-1', payeeName: 'Google Ireland' }),
      row({ direction: 'expense', reverseCharge: true, net: 60, tax: 11.4, payeeId: 'p-1', payeeName: 'Google Ireland' }),
      row({ ratePercent: 0, net: 900, tax: 0 }),
    ]);
    expect(form?.fields).toEqual([]);
    expect(form?.kz83).toBe(0);
    expect(form?.open).toEqual([
      expect.objectContaining({
        reason: 'supply_type_unknown',
        direction: 'expense',
        lines: [25, 26, 28, 30],
        net: 100,
        tax: 19,
        payeeName: 'Google Ireland',
      }),
      expect.objectContaining({ reason: 'zero_rated', lines: [15, 22, 23], net: 900 }),
    ]);
  });

  it('puts other rates on line 16 with the tax as charged', () => {
    const form = buildUstva(2026, [row({ ratePercent: 16, net: 100, tax: 16 })]);
    expect(field(form, '35')).toMatchObject({ line: 16, amount: 100 });
    expect(field(form, '36')).toMatchObject({ line: 16, amount: 16 });
    expect(form?.kz83).toBe(16);
  });
});
