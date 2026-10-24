/** One budget period's room, in the budget's currency; days are YYYY-MM-DD. */
export interface WithinLimitPeriod {
  start: string;
  end: string;
  /** What is left to spend when the rows begin: available minus what the period already spent. */
  remaining: number;
}

export interface WithinLimitBudget {
  id: string;
  categoryId: string;
  /** The category and every category under it. */
  categoryIds: string[];
  periods: WithinLimitPeriod[];
}

export interface WithinLimitRow {
  transactionId: string;
  date: string;
  categoryId: string;
  currency: string;
  /** Positive, in the row's own currency. */
  amount: number;
  /** The amount in each budget's currency; null when there is no rate for the row's day. */
  inBudgetCurrency: ReadonlyMap<string, number | null>;
}

export interface WithinLimitAmount {
  transactionId: string;
  date: string;
  currency: string;
  /** The part of the row a budget still had room for, in the row's own currency. */
  amount: number;
}

/**
 * The part of each expense row that fell within a budget's limit, rows taken in the order given
 * (by day). A row is judged by the budgets on its nearest budgeted category, so a Groceries
 * budget governs a grocery row even when Food has one too; it still uses up the room of every
 * budget that counts it, as the budgets page counts it against the parent as well. Past the
 * limit, or with no budget, a row is not within any limit.
 */
export function allocateWithinLimit(
  budgets: WithinLimitBudget[],
  rows: WithinLimitRow[],
  parentOf: ReadonlyMap<string, string | null>,
): WithinLimitAmount[] {
  const room = new Map(budgets.map(budget => [budget, budget.periods.map(p => p.remaining)]));
  const result: WithinLimitAmount[] = [];

  for (const row of rows) {
    const covering = budgets.flatMap(budget => {
      const index = budget.periods.findIndex(p => p.start <= row.date && row.date <= p.end);
      return index >= 0 && budget.categoryIds.includes(row.categoryId) ? [{ budget, index }] : [];
    });
    if (covering.length === 0) {
      continue;
    }

    const share = Math.max(
      0,
      ...nearest(covering, row.categoryId, parentOf).map(({ budget, index }) =>
        shareWithin(row.inBudgetCurrency.get(budget.id), room.get(budget)?.[index] ?? 0),
      ),
    );

    for (const { budget, index } of covering) {
      const amount = row.inBudgetCurrency.get(budget.id);
      const periods = room.get(budget);
      if (amount != null && periods) {
        periods[index] -= amount;
      }
    }

    if (share > 0) {
      result.push({
        transactionId: row.transactionId,
        date: row.date,
        currency: row.currency,
        amount: share * row.amount,
      });
    }
  }
  return result;
}

/** How much of a row (0 to 1) fits in what a budget has left; none without a rate. */
function shareWithin(amount: number | null | undefined, left: number): number {
  if (amount == null || amount <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, left) / amount);
}

/** The covering budgets on the category closest to the row's, walking up the tree. */
function nearest<T extends { budget: WithinLimitBudget }>(
  covering: T[],
  categoryId: string,
  parentOf: ReadonlyMap<string, string | null>,
): T[] {
  let current: string | null | undefined = categoryId;
  // Bounded like the budgets' own subtree walk: a deeper tree is a mistake.
  for (let depth = 0; current && depth < 6; depth++) {
    const here = covering.filter(entry => entry.budget.categoryId === current);
    if (here.length > 0) return here;
    current = parentOf.get(current);
  }
  return covering;
}
