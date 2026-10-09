import { IsNull } from 'typeorm';

/**
 * Which transactions count in any number Lumio shows (balances, totals,
 * budgets, goals, forecasts, reports, tax, insights): rows a person confirmed
 * (an imported, synced or scanned row waits in Review until approved), that
 * are not suspected duplicates and are not on a statement in the trash.
 *
 * Transfers between the user's own accounts are NOT excluded here: a wallet
 * balance needs them, an income/expense figure does not, so each caller that
 * sums income or spending adds `transferPairId IS NULL` itself.
 *
 * Every aggregate over transactions goes through one of these, so the rule can
 * be found (and audited) by searching for this file's names.
 */

/** For query builders, by property path: `onlyCounted(query, 't')`. */
export function onlyCounted<T extends { andWhere(where: string): T }>(query: T, alias: string): T {
  return query
    .andWhere(`${alias}.isVerified = true`)
    .andWhere(`${alias}.isDuplicate = false`)
    .andWhere(
      `NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = ${alias}.statementId AND trashed.deleted_at IS NOT NULL)`,
    );
}

/** For raw SQL over the `transactions` table, by column name: `AND ${countedSql('t')}`. */
export function countedSql(alias: string): string {
  return `(${alias}.is_verified = true AND ${alias}.is_duplicate = false AND NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = ${alias}.statement_id AND trashed.deleted_at IS NOT NULL))`;
}

/**
 * For `find()` options: `where: countedWhere({ workspaceId })`. Two
 * alternatives, since "no statement, or a statement not in the trash" needs
 * an OR: rows without a statement, and rows whose statement is not trashed.
 */
export function countedWhere<W extends object>(where: W) {
  const base = { ...where, isVerified: true, isDuplicate: false };
  return [
    { ...base, statementId: IsNull() },
    { ...base, statement: { deletedAt: IsNull() } },
  ];
}
