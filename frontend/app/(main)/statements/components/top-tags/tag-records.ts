import type { TopCategoryRecord } from '@/app/(main)/statements/components/top-categories.utils';

type TagLink = { transactionId: string; tagId: string };
type TaggedReceipt = { id: string; tags?: ReadonlyArray<{ id: string }> };
type TagName = { id: string; name: string };

/**
 * The category records again, once per tag each carries, with the tag's name
 * in `category`: the category leaderboard and drill-down then read them as
 * tags. A transaction's tags come from the server (its own, its statement's,
 * its receipt's); a receipt with no transaction behind it brings its own.
 * Untagged records drop out, and a record with two tags counts in both.
 */
export function expandRecordsByTag(
  records: readonly TopCategoryRecord[],
  links: readonly TagLink[],
  receipts: readonly TaggedReceipt[],
  tags: readonly TagName[],
): TopCategoryRecord[] {
  const nameOf = new Map(tags.map(tag => [tag.id, tag.name]));
  const byTransaction = new Map<string, Set<string>>();
  for (const link of links) {
    const set = byTransaction.get(link.transactionId) ?? new Set<string>();
    set.add(link.tagId);
    byTransaction.set(link.transactionId, set);
  }
  const byReceipt = new Map(receipts.map(receipt => [receipt.id, receipt.tags ?? []]));

  const tagIdsOf = (record: TopCategoryRecord): Set<string> => {
    const ids = new Set(record.transactionId ? byTransaction.get(record.transactionId) : []);
    if (record.sourceType === 'receipt') {
      for (const tag of byReceipt.get(record.id) ?? []) {
        ids.add(tag.id);
      }
    }
    return ids;
  };

  return records.flatMap(record =>
    [...tagIdsOf(record)].flatMap(tagId => {
      const name = nameOf.get(tagId);
      return name ? [{ ...record, category: name, color: null, icon: null }] : [];
    }),
  );
}
