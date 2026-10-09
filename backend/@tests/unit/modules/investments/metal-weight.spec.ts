import {
  InvestmentAssetClass,
  type InvestmentHolding,
  MetalWeightUnit,
} from '@/entities/investment-holding.entity';
import {
  fineTroyOunces,
  fromTroyOunces,
  pricedUnits,
  toTroyOunces,
  TROY_OUNCE_GRAMS,
} from '@/modules/investments/metal-weight.util';

describe('metal weight', () => {
  it('converts grams and kilos to troy ounces', () => {
    expect(toTroyOunces(TROY_OUNCE_GRAMS, MetalWeightUnit.GRAM)).toBeCloseTo(1, 10);
    expect(toTroyOunces(1, MetalWeightUnit.TROY_OUNCE)).toBe(1);
    expect(toTroyOunces(1, MetalWeightUnit.KILOGRAM)).toBeCloseTo(32.1507466, 6);
    expect(fromTroyOunces(1, MetalWeightUnit.GRAM)).toBeCloseTo(TROY_OUNCE_GRAMS, 10);
  });

  it('counts the fine metal in a lot, not its gross weight', () => {
    // Ten Krugerrands: one gross ounce each, 22 carat.
    expect(
      fineTroyOunces({
        quantity: 10,
        unitWeight: 1,
        weightUnit: MetalWeightUnit.TROY_OUNCE,
        purity: 0.9167,
      }),
    ).toBeCloseTo(9.167, 6);

    // A one-kilo silver bar, 999 fine.
    expect(
      fineTroyOunces({
        quantity: 1,
        unitWeight: 1,
        weightUnit: MetalWeightUnit.KILOGRAM,
        purity: 0.999,
      }),
    ).toBeCloseTo(32.1185958, 6);
  });

  it('reads numeric strings, as the driver returns them', () => {
    expect(
      fineTroyOunces({
        quantity: '2',
        unitWeight: '31.1034768',
        weightUnit: MetalWeightUnit.GRAM,
        purity: '0.5',
      }),
    ).toBeCloseTo(1, 10);
  });

  it('treats a lot with no weight as worth nothing rather than guessing', () => {
    expect(
      fineTroyOunces({
        quantity: 5,
        unitWeight: null,
        weightUnit: null,
        purity: null,
      }),
    ).toBe(0);
  });

  it('defaults a missing purity to pure metal and a missing unit to troy ounces', () => {
    expect(
      fineTroyOunces({ quantity: 3, unitWeight: 2, weightUnit: null, purity: null }),
    ).toBeCloseTo(6, 10);
  });

  it('prices a security per share and a metal lot per fine ounce', () => {
    const share = {
      assetClass: InvestmentAssetClass.STOCK,
      quantity: '7',
    } as unknown as InvestmentHolding;
    expect(pricedUnits(share)).toBe(7);

    const lot = {
      assetClass: InvestmentAssetClass.METAL,
      quantity: '10',
      unitWeight: '1',
      weightUnit: MetalWeightUnit.TROY_OUNCE,
      purity: '0.9167',
    } as unknown as InvestmentHolding;
    expect(pricedUnits(lot)).toBeCloseTo(9.167, 6);
  });
});
