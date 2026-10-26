/**
 * The category private rows are counted under.
 *
 * Kept out of the pickers: choosing it by hand would file a row as private
 * without making it private, and only the row's owner may do that — the server
 * refuses it from anyone else.
 */
export const PRIVATE_CATEGORY_NAME = 'Private';

export function isPrivateCategory(category: { name?: string | null }): boolean {
  return (category.name ?? '').trim().toLowerCase() === PRIVATE_CATEGORY_NAME.toLowerCase();
}

/** The categories a person may pick from: enabled, and not the private bucket. */
export function pickableCategories<T extends { name?: string | null; isEnabled?: boolean }>(
  categories: T[],
): T[] {
  return categories.filter(
    category => category.isEnabled !== false && !isPrivateCategory(category),
  );
}
