/** What the tile reads of a budget, whether from the contract or the budgets page's own shape. */
interface BudgetFigures {
  currency: string;
  startsOn?: string | null;
  endsOn?: string | null;
  limitAmount: number | string;
  availableAmount?: number;
  spentAmount: number;
}

/**
 * What the budgets governing a `YYYY-MM` month still allow, per currency, or
 * null when none does: no budget yet, or only ones whose window starts after
 * the month or ended before it. Then the tile shows what was spent instead.
 */
export function leftToSpend(
  budgets: readonly BudgetFigures[],
  month: string,
): Array<{ currency: string; amount: number }> | null {
  const [year, index] = month.split('-').map(Number);
  const first = `${month}-01`;
  const last = `${month}-${String(new Date(year, index, 0).getDate()).padStart(2, '0')}`;
  const inMonth = budgets.filter(
    b => (!b.startsOn || b.startsOn <= last) && (!b.endsOn || b.endsOn >= first),
  );
  if (inMonth.length === 0) {
    return null;
  }
  const totals = new Map<string, number>();
  for (const b of inMonth) {
    const allowed = Number(b.availableAmount ?? b.limitAmount);
    totals.set(b.currency, (totals.get(b.currency) ?? 0) + allowed - b.spentAmount);
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
