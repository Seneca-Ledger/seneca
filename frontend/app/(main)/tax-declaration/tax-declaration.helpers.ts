import type { CategoryMapping, FormLine, IssueCode, MappingEntry } from './tax-declaration.types';

export const STEPS = ['profile', 'data', 'mapping', 'draft', 'export'] as const;
export type StepKey = (typeof STEPS)[number];

export function parseStep(value: string | null): StepKey {
  return (STEPS as readonly string[]).includes(value ?? '') ? (value as StepKey) : 'profile';
}

/** The years a declaration can be prepared for: this one and the three before it. */
export function taxYearOptions(now: Date = new Date()): number[] {
  const year = now.getFullYear();
  return [year, year - 1, year - 2, year - 3];
}

/**
 * Declarations are filed for a finished year, so the previous one is the
 * sensible default; the current year is still offered for a running estimate.
 */
export function parseTaxYear(value: string | null, now: Date = new Date()): number {
  const year = Number(value);
  return taxYearOptions(now).includes(year) ? year : now.getFullYear() - 1;
}

export type CompletenessTone = 'success' | 'warning' | 'error';

export function completenessTone(score: number): CompletenessTone {
  if (score >= 85) return 'success';
  if (score >= 60) return 'warning';
  return 'error';
}

export type IssueTarget = { kind: 'route'; href: string } | { kind: 'step'; step: StepKey } | null;

/** Where the user goes to fix an issue; NULL when there is nothing to click through to. */
export function issueTarget(code: IssueCode): IssueTarget {
  switch (code) {
    case 'unmapped_categories':
      return { kind: 'step', step: 'mapping' };
    case 'no_transactions':
    case 'statement_coverage_gaps':
    case 'stale_upload':
      return { kind: 'route', href: '/statements?upload=1' };
    case 'uncategorized_transactions':
    case 'statements_with_errors':
    case 'statements_pending_review':
    case 'receipts_pending_review':
      return { kind: 'route', href: '/statements' };
    default:
      return null;
  }
}

export function formatLineRef(lineNo: string | null, fieldNo: string | null): string {
  if (!lineNo) return '—';
  return fieldNo ? `${lineNo} · ${fieldNo}` : lineNo;
}

/** Lines that make sense for a category: its own direction, plus "not included". */
export function linesForCategory(lines: FormLine[], type: CategoryMapping['type']): FormLine[] {
  return lines.filter(line => line.section === 'excluded' || line.section === type);
}

/** Every proposal turned into a confirmation, for "accept all suggestions". */
export function suggestionEntries(categories: CategoryMapping[]): MappingEntry[] {
  return categories
    .filter(category => category.status === 'suggested' && category.lineKey !== null)
    .map(category => ({ categoryId: category.categoryId, lineKey: category.lineKey }));
}

export function exportFileName(
  countryCode: string,
  taxYear: number,
  format: 'pdf' | 'xlsx' | 'csv',
): string {
  return `income-tax-${countryCode.toLowerCase()}-${taxYear}.${format}`;
}

// German home-office allowances. Mirrors `homeOfficeMinor` in the backend's
// rule-packs/de/euer.ts — keep the two in step, or the preview and the draft
// will show different numbers.
export const DE_HOME_OFFICE_DAILY_EUR = 6;
export const DE_HOME_OFFICE_CAP_EUR = 1260;
const DE_HOME_STUDY_MONTHLY_EUR = 105;
/** Days at which the daily allowance reaches the annual cap. */
export const DE_HOME_OFFICE_CAP_DAYS = DE_HOME_OFFICE_CAP_EUR / DE_HOME_OFFICE_DAILY_EUR;

export interface HomeOfficeAllowance {
  amount: number;
  basis: 'days' | 'study' | null;
  /** The count the amount is based on: days or study months. */
  units: number;
  capped: boolean;
  /** Both were entered; the law allows only one, so only the study counts. */
  exclusive: boolean;
}

function wholeNumber(value: unknown, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Math.floor(number), max);
}

export function deHomeOfficeAllowance(details: Record<string, unknown>): HomeOfficeAllowance {
  const days = wholeNumber(details.homeOfficeDays, 366);
  const months = wholeNumber(details.homeStudyMonths, 12);

  if (months > 0) {
    return {
      amount: DE_HOME_OFFICE_CAP_EUR - DE_HOME_STUDY_MONTHLY_EUR * (12 - months),
      basis: 'study',
      units: months,
      capped: months === 12,
      exclusive: days > 0,
    };
  }
  if (days > 0) {
    return {
      amount: Math.min(days * DE_HOME_OFFICE_DAILY_EUR, DE_HOME_OFFICE_CAP_EUR),
      basis: 'days',
      units: days,
      capped: days >= DE_HOME_OFFICE_CAP_DAYS,
      exclusive: false,
    };
  }
  return { amount: 0, basis: null, units: 0, capped: false, exclusive: false };
}
