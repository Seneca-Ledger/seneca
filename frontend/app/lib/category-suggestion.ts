import type { TransactionCategorySource } from '@/app/lib/contracts';

/** Sources whose category is only a guess until a person confirms the row. */
const SUGGESTED_SOURCES: ReadonlySet<TransactionCategorySource> = new Set([
  'history',
  'learned',
  'keyword',
  'kind',
  'brand',
  'receipt',
]);

/**
 * A suggested category: the import or the payee's history picked it and no one
 * has confirmed the row yet. Accepting confirms the row as it is; picking
 * another category makes it the person's own. A transfer between the owner's
 * accounts is never a suggestion: its category does not count anywhere.
 */
export function isSuggestion(row: {
  isVerified?: boolean;
  categorySource?: TransactionCategorySource | null;
  transferPairId?: string | null;
}): boolean {
  return (
    row.isVerified === false &&
    !row.transferPairId &&
    row.categorySource != null &&
    SUGGESTED_SOURCES.has(row.categorySource)
  );
}
