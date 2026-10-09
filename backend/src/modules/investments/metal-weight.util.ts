import {
  InvestmentAssetClass,
  type InvestmentHolding,
  MetalWeightUnit,
} from '../../entities/investment-holding.entity';

/** One troy ounce in grams, the definition every dealer and quote uses. */
export const TROY_OUNCE_GRAMS = 31.1034768;

const GRAMS_PER_UNIT: Record<MetalWeightUnit, number> = {
  [MetalWeightUnit.GRAM]: 1,
  [MetalWeightUnit.TROY_OUNCE]: TROY_OUNCE_GRAMS,
  [MetalWeightUnit.KILOGRAM]: 1000,
};

export function toTroyOunces(weight: number, unit: MetalWeightUnit): number {
  if (!Number.isFinite(weight)) return 0;
  return (weight * GRAMS_PER_UNIT[unit]) / TROY_OUNCE_GRAMS;
}

export function fromTroyOunces(ounces: number, unit: MetalWeightUnit): number {
  if (!Number.isFinite(ounces)) return 0;
  return (ounces * TROY_OUNCE_GRAMS) / GRAMS_PER_UNIT[unit];
}

/**
 * The fine metal in a lot, in troy ounces: ten Krugerrands are ten gross
 * ounces but 9.167 ounces of gold, and the spot price is quoted on the fine
 * weight. A lot missing its weight is worth nothing rather than a guess.
 */
export function fineTroyOunces(lot: {
  quantity: number | string;
  unitWeight: number | string | null;
  weightUnit: MetalWeightUnit | null;
  purity: number | string | null;
}): number {
  const pieces = Number(lot.quantity);
  const unitWeight = Number(lot.unitWeight);
  if (!(Number.isFinite(pieces) && Number.isFinite(unitWeight))) return 0;
  const purity = Number(lot.purity);
  return (
    pieces *
    toTroyOunces(unitWeight, lot.weightUnit ?? MetalWeightUnit.TROY_OUNCE) *
    (Number.isFinite(purity) && purity > 0 ? purity : 1)
  );
}

/**
 * How many units a holding's price applies to: shares for a security, fine
 * troy ounces for a metal lot. Everything that values a holding goes through
 * here so the two classes cannot drift apart.
 */
export function pricedUnits(holding: InvestmentHolding): number {
  if (holding.assetClass !== InvestmentAssetClass.METAL) {
    return Number(holding.quantity);
  }
  return fineTroyOunces(holding);
}
