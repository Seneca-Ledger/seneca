/** One category's usage; `lastUsedAt` is the day of its latest transaction (YYYY-MM-DD). */
export type CategoryUsage = {
  transactions: number;
  statements: number;
  total: number;
  lastUsedAt: string | null;
};

type UsageRow = { categoryId: string; count: string | number; lastUsedAt?: string | null };

/** Transaction and statement counts per category, added up into one usage record each. */
export function mergeCategoryUsage(
  transactionsRaw: UsageRow[],
  statementsRaw: UsageRow[],
): Record<string, CategoryUsage> {
  const result: Record<string, CategoryUsage> = {};

  for (const row of transactionsRaw) {
    const catId = row.categoryId;
    result[catId] = {
      transactions: Number(row.count),
      statements: 0,
      total: Number(row.count),
      lastUsedAt: row.lastUsedAt ?? null,
    };
  }

  for (const row of statementsRaw) {
    const catId = row.categoryId;
    if (!result[catId]) {
      result[catId] = {
        transactions: 0,
        statements: Number(row.count),
        total: Number(row.count),
        lastUsedAt: null,
      };
    } else {
      result[catId].statements = Number(row.count);
      result[catId].total += Number(row.count);
    }
  }

  return result;
}
