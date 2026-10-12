import {
  lineAdjustmentAmount,
  lineAmount,
  type PricableLine,
} from '../../../../src/modules/invoices/invoice-pricing';

const line = (overrides: Partial<PricableLine>): PricableLine => ({
  description: 'Work',
  quantity: 1,
  unitPrice: 100,
  taxRateId: null,
  categoryId: null,
  ...overrides,
});

describe('line amount with a discount or surcharge', () => {
  it('is quantity × price when the line has neither', () => {
    expect(lineAmount(line({ quantity: 3, unitPrice: 33.33 }))).toBe(99.99);
  });

  it('takes a discount off and adds a surcharge, each rounded to cents first', () => {
    expect(lineAdjustmentAmount(line({ quantity: 2, unitPrice: 29.9, adjustmentPercent: -5 }))).toBe(-2.99);
    expect(lineAmount(line({ quantity: 2, unitPrice: 29.9, adjustmentPercent: -5 }))).toBe(56.81);
    expect(lineAmount(line({ quantity: 3, unitPrice: 11.1, adjustmentPercent: '10.00' }))).toBe(36.63);
  });

  it('reads a stored decimal string and a full discount', () => {
    expect(lineAmount(line({ adjustmentPercent: '-100.00' }))).toBe(0);
    expect(lineAmount(line({ adjustmentPercent: null }))).toBe(100);
  });
});
