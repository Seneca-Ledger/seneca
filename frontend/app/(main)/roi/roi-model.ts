/**
 * A scratchpad, not a report: everything here is derived from the two numbers
 * the user types in. Nothing reads the workspace's own data, and nothing is
 * saved — the point is to sanity-check a purchase before committing to it.
 */

export const PROJECTION_YEARS = 30;
export const TABLE_YEARS = [1, 5, 10, 20, 30];

export interface RoiResult {
  annualIncome: number;
  annualRoiPercent: number;
  /** Years until the income paid back the investment. Null if it never does. */
  paybackYears: number | null;
}

export interface ProjectionPoint {
  year: number;
  /** Returns reinvested into the same asset every year. */
  compound: number;
  /** Asset value flat, income merely set aside as cash. */
  simple: number;
}

/**
 * Returns null when the inputs cannot describe an investment — a zero or
 * negative outlay has no return to speak of, and blank fields are not zero.
 */
export function calculateRoi(investment: number, monthlyIncome: number): RoiResult | null {
  if (!(Number.isFinite(investment) && Number.isFinite(monthlyIncome)) || investment <= 0) {
    return null;
  }

  const annualIncome = monthlyIncome * 12;
  return {
    annualIncome,
    annualRoiPercent: (annualIncome / investment) * 100,
    paybackYears: annualIncome > 0 ? investment / annualIncome : null,
  };
}

/**
 * Two scenarios from the same starting point, compounded annually. The gap
 * between the lines is what reinvesting is worth.
 */
export function buildProjection(
  investment: number,
  annualIncome: number,
  years = PROJECTION_YEARS,
): ProjectionPoint[] {
  const rate = investment > 0 ? annualIncome / investment : 0;

  return Array.from({ length: years + 1 }, (_, year) => ({
    year,
    compound: investment * (1 + rate) ** year,
    simple: investment + annualIncome * year,
  }));
}

/** "2 года 6 мес" reads better than "2.5" for a payback period. */
export function splitPayback(paybackYears: number): { years: number; months: number } {
  const totalMonths = Math.round(paybackYears * 12);
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

/**
 * "10 000,50", "10,000.50", "10000" → 10000.5. The last of "." or "," is the
 * decimal mark when two digits or fewer follow it; any other one groups thousands.
 */
export function parseAmount(text: string): number | null {
  const compact = text.replace(/[\s'\u00a0\u202f]/g, '');
  if (compact === '') {
    return null;
  }
  const lastMark = Math.max(compact.lastIndexOf('.'), compact.lastIndexOf(','));
  const decimals = lastMark >= 0 ? compact.length - lastMark - 1 : 0;
  const normalized =
    lastMark >= 0 && decimals <= 2
      ? `${compact.slice(0, lastMark).replace(/[.,]/g, '')}.${compact.slice(lastMark + 1)}`
      : compact.replace(/[.,]/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
