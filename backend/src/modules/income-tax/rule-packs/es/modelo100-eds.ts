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
 * Modelo 100 (IRPF), economic activities under estimación directa simplificada.
 *
 * Sources: AEAT, "Régimen de estimación directa simplificada" and the Renta
 * 2025 manual, section 7.4.2.9. Box numbers (casillas) were not verified, so
 * every line carries NULL and the draft is organised by concept instead.
 */

const TURNOVER_LIMIT_MINOR = 600_000_00;
const HARD_TO_JUSTIFY_PERCENT = 5;
const HARD_TO_JUSTIFY_CAP_MINOR = 2_000_00;

export const ES_ACTIVITY_KEYS = [
  'A01',
  'A02',
  'A03',
  'A04',
  'A05',
  'B01',
  'B02',
  'B03',
  'B04',
  'B05',
  'B06',
] as const;

const LINES: FormLine[] = [
  {
    key: 'business_income',
    section: 'income',
    lineNo: null,
    fieldNo: null,
    label: 'Operating income (ingresos íntegros de la actividad)',
    suggestedFor: ['Sales', 'Services', 'Other income'],
  },
  {
    key: 'deductible_expenses',
    section: 'expense',
    lineNo: null,
    fieldNo: null,
    label: 'Deductible expenses (gastos fiscalmente deducibles)',
    suggestedFor: [
      'Advertising',
      'Benefits and compensation',
      'Equipment',
      'Fees and charges',
      'Insurance',
      'Interest',
      'Payroll',
      'Maintenance and repairs',
      'Materials',
      'Office supplies',
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
    label: 'Not part of this activity (private, or reported elsewhere)',
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

function checkProfile(details: Record<string, unknown>, warnings: PackWarning[]): void {
  const activityKey = details.activityKey;
  if (
    typeof activityKey !== 'string' ||
    !(ES_ACTIVITY_KEYS as readonly string[]).includes(activityKey)
  ) {
    warnings.push({ code: 'es_activity_key_missing' });
  }

  const previousTurnover = Number(details.previousYearTurnover);
  if (Number.isFinite(previousTurnover) && previousTurnover * 100 > TURNOVER_LIMIT_MINOR) {
    warnings.push({
      code: 'es_simplified_regime_unavailable',
      params: { limitMinor: TURNOVER_LIMIT_MINOR },
    });
  }
}

function compute(input: PackInput): PackResult {
  const warnings: PackWarning[] = [];
  checkProfile(input.details, warnings);

  const incomeMinor = sumItems(input.items.business_income);
  const expenseMinor = sumItems(input.items.deductible_expenses);
  const netBeforeMinor = incomeMinor - expenseMinor;

  // The flat allowance replaces provisions and hard-to-document expenses. It
  // cannot be combined with the reduction for working for a single client
  // (art. 32.2.3º LIRPF), so claiming that reduction switches it off.
  const singleClient = input.details.singleClientReduction === true;
  const hardToJustifyMinor =
    singleClient || netBeforeMinor <= 0
      ? 0
      : Math.min(
          Math.trunc((netBeforeMinor * HARD_TO_JUSTIFY_PERCENT) / 100),
          HARD_TO_JUSTIFY_CAP_MINOR,
        );
  if (singleClient) {
    warnings.push({ code: 'es_single_client_excludes_allowance' });
  }

  const netMinor = netBeforeMinor - hardToJustifyMinor;

  return {
    figures: [
      figure('business_income', LINES[0].label, 'income', incomeMinor),
      figure('deductible_expenses', LINES[1].label, 'expense', expenseMinor),
      figure(
        'net_before_allowance',
        'Net income before the flat allowance (rendimiento neto previo)',
        'total',
        netBeforeMinor,
      ),
      figure(
        'hard_to_justify',
        'Provisions and hard-to-document expenses, 5% up to 2,000 EUR (gastos de difícil justificación)',
        'expense',
        hardToJustifyMinor,
      ),
      figure('net_income', 'Net income from the activity (rendimiento neto)', 'result', netMinor),
    ],
    warnings,
    // No verified IRPF scale, and the scale is split between State and
    // autonomous community — an estimate would be a guess.
    taxEstimate: null,
  };
}

export const esEdsPack: RulePack = {
  formKey: 'es-modelo100-eds',
  name: 'Modelo 100 — estimación directa simplificada',
  countryCode: 'ES',
  taxpayerTypes: ['self_employed'],
  taxYears: [2025, 2026],
  formEditionYear: 2025,
  filingChannel: 'Renta WEB (sede.agenciatributaria.gob.es)',
  lines: LINES,
  compute,
};
