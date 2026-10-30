import type { Transaction } from '../../entities/transaction.entity';

/**
 * The category a row falls back to when nothing classifies it: one per
 * workspace and type, kept unique by UQ_categories_uncategorized. English like
 * the other default categories; it used to be the Russian 'Без категории'
 * (merged and renamed by migration 1786810000000).
 */
export const UNCATEGORIZED_CATEGORY_NAME = 'Uncategorized';

export function isUncategorizedName(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === UNCATEGORIZED_CATEGORY_NAME.toLowerCase();
}

/**
 * SQL true while the row under `alias` still waits for a category: it has none
 * (a receipt's) or sits in the Uncategorized fallback that statement processing
 * gives every row it cannot place by payee. Pass UNCATEGORIZED_SQL_PARAMS with it.
 */
export function awaitingCategorySql(alias: string): string {
  return `(${alias}.categoryId IS NULL OR EXISTS (SELECT 1 FROM categories fallback
    WHERE fallback.id = ${alias}.categoryId AND LOWER(TRIM(fallback.name)) = :uncategorizedName))`;
}

export const UNCATEGORIZED_SQL_PARAMS = {
  uncategorizedName: UNCATEGORIZED_CATEGORY_NAME.toLowerCase(),
};

/**
 * Rows just imported that have no category at all. Rows left in the
 * Uncategorized fallback do not count here: notifying about them would fire
 * after nearly every bank-statement import.
 */
export function countWithoutCategory(rows: Pick<Transaction, 'categoryId'>[]): number {
  return rows.filter(row => !row.categoryId).length;
}
