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
