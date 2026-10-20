import { hasChosenCategory } from '@/app/components/categories/NoCategoryBadge';
import type { StatementsStatement } from './statementsViewTypes';

/** One category present among the listed documents; `id` null is "no category". */
export interface CategoryBucket {
  id: string | null;
  /** The stored (English for system categories) name; null for "no category". */
  name: string | null;
  documentIds: string[];
}

type CategoryCarrier = Pick<StatementsStatement, 'category' | 'parsedData'>;

/**
 * The category a document row shows, by the same rule as the row itself: the
 * resolved category first, then the receipt's parsed one. "Uncategorized" is
 * the workspace fallback and counts as none.
 */
export function documentCategory(row: CategoryCarrier): { id: string; name: string } | null {
  const name = row.category?.name ?? row.parsedData?.category ?? null;
  const id = row.category?.id ?? row.parsedData?.categoryId ?? null;
  if (!(id && hasChosenCategory(name))) {
    return null;
  }
  return { id, name };
}

/** Documents grouped by category, the largest group first, "no category" last. */
export function groupByCategory(rows: Array<CategoryCarrier & { id: string }>): CategoryBucket[] {
  const buckets = new Map<string | null, CategoryBucket>();
  for (const row of rows) {
    const category = documentCategory(row);
    const key = category?.id ?? null;
    const bucket = buckets.get(key) ?? { id: key, name: category?.name ?? null, documentIds: [] };
    bucket.documentIds.push(row.id);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => {
    if ((a.id === null) !== (b.id === null)) {
      return a.id === null ? 1 : -1;
    }
    return b.documentIds.length - a.documentIds.length;
  });
}

/**
 * The statements whose transactions a table built from these documents holds.
 * A bank statement is its own; a scan keeps its transaction on a hidden
 * statement of its own; a scan without one is skipped.
 */
export function tableStatementIds(
  rows: Array<Pick<StatementsStatement, 'id' | 'source' | 'statementId'>>,
): string[] {
  const ids = rows.flatMap(row => {
    if (row.source === 'scan') {
      return row.statementId ? [row.statementId] : [];
    }
    return [row.id];
  });
  return [...new Set(ids)];
}

interface BoundTable {
  sourceBinding: { kind: string; filters: Record<string, unknown> } | null;
}

/**
 * Only a table built from documents grows by more documents; on one bound to a
 * date range or picked records the backend refuses (SOURCE_NOT_DOCUMENTS).
 */
export function acceptsDocuments(table: BoundTable): boolean {
  const binding = table.sourceBinding;
  return (
    binding?.kind === 'transactions' &&
    Array.isArray(binding.filters.statementIds) &&
    binding.filters.ids === undefined
  );
}
