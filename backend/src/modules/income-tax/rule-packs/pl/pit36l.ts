import {
  type Figure,
  type FormLine,
  type PackInput,
  type PackResult,
  type PackWarning,
  type RulePack,
  sumItems,
} from '../types';
import { COST_CATEGORIES, REVENUE_CATEGORIES, treatment } from './common';

/**
 * PIT-36L — business income taxed at the flat rate (art. 30c ustawy o PIT).
 *
 * Sources: Ministry of Finance "Broszura do PIT-36L za 2025 r." and
 * podatki.gov.pl/twoj-e-pit/pit-36l-za-2025-rok. Part E row 1 columns b–e,
 * item 40 (social contributions) and item 41 (health contribution) come from
 * the brochure. Tax is not estimated: advance payments (zaliczki) and the
 * rounding of the base were not verified.
 */

/** Annual cap on the health contribution a flat-rate payer may claim, indexed yearly (podatki.gov.pl). */
const HEALTH_CAP_MINOR: Record<number, number> = {
  2025: 12_900_00,
  2026: 14_100_00,
};

const LINES: FormLine[] = [
  {
    key: 'revenue',
    section: 'income',
    lineNo: 'E.1',
    fieldNo: 'b',
    label: 'Business revenue, net of VAT (przychód z pozarolniczej działalności gospodarczej)',
    suggestedFor: REVENUE_CATEGORIES,
  },
  {
    key: 'costs',
    section: 'expense',
    lineNo: 'E.1',
    fieldNo: 'c',
    label: 'Tax-deductible costs (koszty uzyskania przychodów)',
    suggestedFor: COST_CATEGORIES,
  },
  {
    key: 'zus_social',
    section: 'expense',
    lineNo: null,
    fieldNo: null,
    label: 'Social insurance contributions for yourself (składki na ubezpieczenia społeczne)',
    suggestedFor: [],
  },
  {
    key: 'health_contribution',
    section: 'expense',
    lineNo: null,
    fieldNo: null,
    label: 'Health insurance contribution (składka zdrowotna)',
    suggestedFor: [],
  },
  {
    key: 'not_business',
    section: 'excluded',
    lineNo: null,
    fieldNo: null,
    label: 'Not part of this return (private, or reported elsewhere)',
    suggestedFor: ['Interest income'],
  },
];

function figure(
  key: string,
  lineNo: string | null,
  fieldNo: string | null,
  label: string,
  section: Figure['section'],
  amountMinor: number,
  deductibleMinor = amountMinor,
): Figure {
  return { key, lineNo, fieldNo, label, section, amountMinor, deductibleMinor };
}

function compute(input: PackInput): PackResult {
  const warnings: PackWarning[] = [];

  const revenue = sumItems(input.items.revenue);
  const baseCosts = sumItems(input.items.costs);
  const zus = Math.max(0, sumItems(input.items.zus_social));
  const healthPaid = Math.max(0, sumItems(input.items.health_contribution));

  // The cap covers cost and deduction together, so it is applied before the split.
  const cap = HEALTH_CAP_MINOR[input.taxYear];
  const health = Math.min(healthPaid, cap);
  if (healthPaid > cap) {
    warnings.push({
      code: 'pl_health_cap_applied',
      lineKey: 'health_contribution',
      params: { capMinor: cap, paidMinor: healthPaid },
    });
  }

  const zusTreatment = treatment(input.details.zusTreatment);
  const healthTreatment = treatment(input.details.healthTreatment);

  const costs =
    baseCosts + (zusTreatment === 'cost' ? zus : 0) + (healthTreatment === 'cost' ? health : 0);
  const income = revenue - costs;
  const zusDeduction = zusTreatment === 'deduct' ? zus : 0;
  const healthDeduction = healthTreatment === 'deduct' ? health : 0;

  const afterDeductions = Math.max(0, income) - zusDeduction - healthDeduction;
  if (afterDeductions < 0) {
    warnings.push({ code: 'pl_deductions_exceed_income' });
  }

  return {
    figures: [
      figure('revenue', 'E.1', 'b', LINES[0].label, 'income', revenue),
      figure('costs', 'E.1', 'c', LINES[1].label, 'expense', costs),
      figure('income', 'E.1', 'd', 'Income (dochód)', 'total', Math.max(0, income)),
      figure('loss', 'E.1', 'e', 'Loss (strata)', 'total', Math.max(0, -income)),
      figure(
        'zus_social',
        'poz. 40',
        null,
        'Social insurance contributions deducted from income',
        'expense',
        zus,
        zusDeduction,
      ),
      figure(
        'health_contribution',
        'poz. 41',
        null,
        `Health contribution deducted from income (cap ${cap / 100} PLN with costs, ${input.taxYear})`,
        'expense',
        healthPaid,
        healthDeduction,
      ),
      figure(
        'income_after_deductions',
        null,
        null,
        'Income after contribution deductions',
        'result',
        Math.max(0, afterDeductions),
      ),
    ],
    warnings,
    taxEstimate: null,
  };
}

export const plPit36lPack: RulePack = {
  formKey: 'pl-pit36l',
  name: 'PIT-36L',
  countryCode: 'PL',
  taxpayerTypes: ['self_employed'],
  regime: 'liniowy',
  // 2026 uses the 2025 form's numbering until the 2026 edition is checked.
  taxYears: [2025, 2026],
  formEditionYear: 2025,
  filingChannel:
    'Twój e-PIT (podatki.gov.pl) — not accepted automatically; complete and confirm it',
  lines: LINES,
  compute,
};
