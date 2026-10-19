import {
  type Figure,
  type FormLine,
  type PackInput,
  type PackResult,
  type PackWarning,
  type RulePack,
  sumItems,
} from '../types';

/**
 * PIT-28 — ryczałt od przychodów ewidencjonowanych (lump-sum tax on recorded revenue).
 *
 * Source: podatki.gov.pl/twoj-e-pit/pit-28-za-2025-rok and the Ministry of
 * Finance limits page. Under ryczałt costs do not reduce the base; revenue is
 * taxed at the rate of the activity and reduced by 50% of health contributions
 * paid. Field numbers of PIT-28 were not verified, so lines carry none, and
 * how the health reduction is split across several rates was not verified
 * either — the draft flags that case instead of guessing.
 */

/** Previous-year revenue ceiling for ryczałt in 2025: EUR 2 000 000 at 4.2846. */
const ELIGIBILITY_LIMIT_2025_MINOR = 8_569_200_00;

const RATE_LINES: FormLine[] = [
  {
    key: 'revenue_17',
    section: 'income',
    lineNo: null,
    fieldNo: null,
    label: 'Revenue at 17% — liberal professions (wolne zawody)',
    suggestedFor: [],
  },
  {
    key: 'revenue_15',
    section: 'income',
    lineNo: null,
    fieldNo: null,
    label: 'Revenue at 15% — services listed in art. 12(1)(2)',
    suggestedFor: [],
  },
  {
    key: 'revenue_14',
    section: 'income',
    lineNo: null,
    fieldNo: null,
    label:
      'Revenue at 14% — healthcare (PKWiU 86), architecture and engineering (71), specialised design (74.1)',
    suggestedFor: [],
  },
  {
    key: 'revenue_12',
    section: 'income',
    lineNo: null,
    fieldNo: null,
    label:
      'Revenue at 12% — IT services (PKWiU 62.01.1, 62.01.2, 62.02, 62.03.1, 62.09.20.0) and software publishing (58.2)',
    suggestedFor: [],
  },
  {
    key: 'revenue_10',
    section: 'income',
    lineNo: null,
    fieldNo: null,
    label: 'Revenue at 10% — buying and selling real estate on own account (PKWiU 68.10.1)',
    suggestedFor: [],
  },
];

const LINES: FormLine[] = [
  ...RATE_LINES,
  {
    key: 'health_contribution',
    section: 'expense',
    lineNo: null,
    fieldNo: null,
    label: 'Health insurance contribution paid (składka zdrowotna) — 50% reduces revenue',
    suggestedFor: [],
  },
  {
    key: 'not_deductible',
    section: 'excluded',
    lineNo: null,
    fieldNo: null,
    label: 'Business costs — they do not reduce revenue under ryczałt',
    suggestedFor: [
      'Advertising',
      'Equipment',
      'Fees and charges',
      'Insurance',
      'Maintenance and repairs',
      'Materials',
      'Office supplies',
      'Payroll',
      'Professional services',
      'Rent',
      'Travel',
      'Utilities',
      'Other expenses',
    ],
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

  const previousRevenue = Number(input.details.previousYearRevenue);
  if (Number.isFinite(previousRevenue) && previousRevenue * 100 > ELIGIBILITY_LIMIT_2025_MINOR) {
    warnings.push({
      code: 'pl_ryczalt_limit_exceeded',
      params: { limitMinor: ELIGIBILITY_LIMIT_2025_MINOR },
    });
  }

  const rateFigures = RATE_LINES.map(line =>
    figure(line.key, line.label, 'income', sumItems(input.items[line.key])),
  );
  const totalRevenue = rateFigures.reduce((total, rate) => total + rate.amountMinor, 0);
  if (rateFigures.filter(rate => rate.amountMinor !== 0).length > 1) {
    warnings.push({ code: 'pl_ryczalt_multiple_rates' });
  }

  const healthPaid = Math.max(0, sumItems(input.items.health_contribution));
  const healthReduction = Math.trunc(healthPaid / 2);
  const afterReduction = totalRevenue - healthReduction;
  if (afterReduction < 0) {
    warnings.push({ code: 'pl_deductions_exceed_income' });
  }

  return {
    figures: [
      ...rateFigures,
      figure('revenue_total', 'Total recorded revenue (przychód)', 'total', totalRevenue),
      figure(
        'health_contribution',
        '50% of health contributions paid, deducted from revenue',
        'expense',
        healthPaid,
        healthReduction,
      ),
      figure(
        'revenue_after_reduction',
        'Revenue after the health contribution reduction',
        'result',
        Math.max(0, afterReduction),
      ),
    ],
    warnings,
    taxEstimate: null,
  };
}

export const plPit28Pack: RulePack = {
  formKey: 'pl-pit28',
  name: 'PIT-28 (ryczałt)',
  countryCode: 'PL',
  taxpayerTypes: ['self_employed'],
  regime: 'ryczalt',
  taxYears: [2025],
  formEditionYear: 2025,
  filingChannel:
    'Twój e-PIT (podatki.gov.pl) — not accepted automatically; complete and confirm it',
  lines: LINES,
  compute,
};
