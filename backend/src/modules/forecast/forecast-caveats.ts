import type { ForecastResponse } from '../../contracts';

export type ForecastCaveat = ForecastResponse['caveats'][number];

/**
 * Why the projection may be off, so the page can say so instead of showing a
 * confident runway: averages built on fewer full months than they want, no
 * everyday spending left once the subscriptions are taken out (the curve then
 * only subtracts known bills), and an opening balance summed from rows
 * because no account holds a real one.
 */
export function forecastCaveats(
  historyIsShort: boolean,
  everydayMonthly: number,
  hasAccounts: boolean,
): ForecastCaveat[] {
  const caveats: ForecastCaveat[] = [];
  if (historyIsShort) caveats.push('shortHistory');
  if (everydayMonthly <= 0) caveats.push('noEverydaySpending');
  if (!hasAccounts) caveats.push('derivedBalance');
  return caveats;
}
