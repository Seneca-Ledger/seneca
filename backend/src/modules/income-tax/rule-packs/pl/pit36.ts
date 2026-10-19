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
 * PIT-36 — business income taxed on the progressive scale (art. 27 ustawy o PIT).
 *
 * Sources: podatki.gov.pl "Opodatkowanie według skali podatkowej" (12% up to
 * 120 000 PLN, 32% on the excess, tax-reducing amount 3 600 PLN; the health
 * contribution is neither deductible nor a cost) and
 * podatki.gov.pl/twoj-e-pit/pit-36-za-2025-rok (social contributions are
 * deducted from income unless already counted as costs, up to the income).
 * The form's field numbers were not verified, so every figure carries NULL.
 */

const THRESHOLD_MINOR = 120_000_00;
const TAX_REDUCING_AMOUNT_MINOR = 3_600_00;

/** Annual tax on the scale for a base in grosze, before advance payments and rounding. */
export function polishScaleTax(baseMinor: number): number {
  if (baseMinor <= 0) {
    return 0;
  }
  const lower = Math.min(baseMinor, THRESHOLD_MINOR);
  const upper = Math.max(0, baseMinor - THRESHOLD_MINOR);
  const tax = Math.round((lower * 12 + upper * 32) / 100) - TAX_REDUCING_AMOUNT_MINOR;
  return Math.max(0, tax);
}

const LINES: FormLine[] = [
  {
    key: 'revenue',
    section: 'income',
    lineNo: null,
    fieldNo: null,
    label: 'Business revenue, net of VAT (przychód z pozarolniczej działalności gospodarczej)',
    suggestedFor: REVENUE_CATEGORIES,
  },
  {
    key: 'costs',
    section: 'expense',
    lineNo: null,
    fieldNo: null,
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
    section: 'excluded',
    lineNo: null,
    fieldNo: null,
    label: 'Health contribution — not deductible on the tax scale (składka zdrowotna)',
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
  label: string,
  section: Figure['section'],
  amountMinor: number,
  deductibleMinor = amountMinor,
): Figure {
  return { key, lineNo: null, fieldNo: null, label, section, amountMinor, deductibleMinor };
}

function compute(input: PackInput): PackResult {
  const warnings: PackWarning[] = [];

  const revenue = sumItems(input.items.revenue);
  const zus = Math.max(0, sumItems(input.items.zus_social));
  const zusTreatment = treatment(input.details.zusTreatment);

  const costs = sumItems(input.items.costs) + (zusTreatment === 'cost' ? zus : 0);
  const income = revenue - costs;
  const positiveIncome = Math.max(0, income);

  // The deduction cannot exceed the income it is taken from.
  const zusClaimed = zusTreatment === 'deduct' ? zus : 0;
  const zusDeduction = Math.min(zusClaimed, positiveIncome);
  if (zusClaimed > positiveIncome) {
    warnings.push({ code: 'pl_deductions_exceed_income' });
  }
  const base = positiveIncome - zusDeduction;

  return {
    figures: [
      figure('revenue', LINES[0].label, 'income', revenue),
      figure('costs', LINES[1].label, 'expense', costs),
      figure('income', 'Income (dochód)', 'total', positiveIncome),
      figure('loss', 'Loss (strata)', 'total', Math.max(0, -income)),
      figure(
        'zus_social',
        'Social insurance contributions deducted from income',
        'expense',
        zus,
        zusDeduction,
      ),
      figure('tax_base', 'Income after the social contribution deduction', 'result', base),
    ],
    warnings,
    taxEstimate: {
      amountMinor: polishScaleTax(base),
      basis: `Tax scale ${input.taxYear}: 12% up to 120 000 PLN, 32% above, minus the 3 600 PLN tax-reducing amount; this business income as the only income, filed individually`,
      excludes: [
        'Advance payments already made (zaliczki)',
        'Rounding of the base and the tax to whole złoty',
        'Joint filing with a spouse or as a single parent',
        'Reliefs and other deductions (ulgi, donations, IKZE)',
        'Other income taxed on the scale (employment, civil-law contracts)',
        'Losses from previous years',
      ],
    },
  };
}

export const plPit36Pack: RulePack = {
  formKey: 'pl-pit36',
  name: 'PIT-36',
  countryCode: 'PL',
  taxpayerTypes: ['self_employed'],
  regime: 'skala',
  taxYears: [2025],
  // No field numbers are shown, so there is no edition to warn about.
  formEditionYear: null,
  filingChannel:
    'Twój e-PIT (podatki.gov.pl) — not accepted automatically; complete and confirm it',
  lines: LINES,
  compute,
};
