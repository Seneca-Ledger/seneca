import { deEuerPack } from './de/euer';
import { esEdsPack } from './es/modelo100-eds';
import { genericSummaryPack } from './generic/annual-summary';
import { plPit28Pack } from './pl/pit28';
import { plPit36Pack } from './pl/pit36';
import { plPit36lPack } from './pl/pit36l';
import type { RulePack, TaxpayerType } from './types';

export * from './types';
export { genericSummaryPack };

/**
 * Country packs, in the order they are tried. A pack only appears here once its
 * figures have been checked against the published form; everything else falls
 * back to the generic summary.
 */
const COUNTRY_PACKS: RulePack[] = [deEuerPack, esEdsPack, plPit36lPack, plPit28Pack, plPit36Pack];

export function resolvePack(
  countryCode: string | null,
  taxYear: number,
  taxpayerType: TaxpayerType,
  details: Record<string, unknown> = {},
): RulePack {
  const match = COUNTRY_PACKS.find(
    pack =>
      pack.countryCode === countryCode?.toUpperCase() &&
      pack.taxpayerTypes.includes(taxpayerType) &&
      (pack.regime === undefined || pack.regime === details.regime) &&
      (pack.taxYears.length === 0 || pack.taxYears.includes(taxYear)),
  );
  return match ?? genericSummaryPack;
}

export function findPack(formKey: string): RulePack | null {
  return [...COUNTRY_PACKS, genericSummaryPack].find(pack => pack.formKey === formKey) ?? null;
}

/** The line a category is proposed for, by the seeded system category name. */
export function suggestLine(pack: RulePack, categoryName: string): string | null {
  return pack.lines.find(line => line.suggestedFor.includes(categoryName))?.key ?? null;
}
