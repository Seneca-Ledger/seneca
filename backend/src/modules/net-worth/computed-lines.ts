import {
  type BalanceService,
  CASH_ACCOUNT_CODE,
  DEBTS_ACCOUNT_CODE,
} from '../balance/balance.service';
import type { CurrencyAmounts, CurrencyConverter } from '../exchange-rates/currency-converter';

/** Per balance line code, its amounts at each date: the lines kept up from the books rather than from snapshots. */
export type ComputedLines = Map<string, Map<string, CurrencyAmounts>>;

/** Cash and the debts of cards and loans at each of `dates`. */
export async function loadComputedLines(
  balanceService: BalanceService,
  workspaceId: string,
  dates: string[],
): Promise<ComputedLines> {
  const [cash, debts] = await Promise.all([
    balanceService.getCashSeries(workspaceId, dates),
    balanceService.getDebtSeries(workspaceId, dates),
  ]);
  return new Map([
    [CASH_ACCOUNT_CODE, cash],
    [DEBTS_ACCOUNT_CODE, debts],
  ]);
}

/** Every currency the computed lines hold on each date, plus `others`, for the converter to load. */
export function currencyDates(
  lines: ComputedLines,
  dates: string[],
  others: string[],
): Array<{ currency: string; date: string }> {
  return dates.flatMap(date =>
    [
      ...[...lines.values()].flatMap(series => [...(series.get(date)?.keys() ?? [])]),
      ...others,
    ].map(currency => ({ currency, date })),
  );
}

/** A computed line's value on `date` in the converter's currency; null when `code` is not one. */
export function computedValue(
  lines: ComputedLines,
  converter: CurrencyConverter,
  code: string,
  date: string,
): number | null {
  const series = lines.get(code);
  return series ? converter.convertAll(series.get(date) ?? new Map(), date) : null;
}
