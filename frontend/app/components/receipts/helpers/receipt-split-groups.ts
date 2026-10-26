export interface SplitPreviewItem {
  description: string;
  amount: number;
  categoryId: string | null;
}

export interface SplitPreviewPart {
  categoryId: string | null;
  amount: number;
  items: string[];
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * What applying the split will book, recomputed as the user moves items between
 * categories. Mirrors the backend's groupLineItemsIntoParts: group by category,
 * scale to the transaction's amount in proportion (tax and tips shared by every
 * part), rounding residue on the last part.
 */
export function groupSplitItems(items: SplitPreviewItem[], total: number): SplitPreviewPart[] {
  const groups = new Map<string | null, SplitPreviewPart>();
  for (const item of items) {
    if (!(item.amount > 0)) continue;
    const part = groups.get(item.categoryId) ?? {
      categoryId: item.categoryId,
      amount: 0,
      items: [],
    };
    part.amount += item.amount;
    part.items.push(item.description);
    groups.set(item.categoryId, part);
  }
  const parts = [...groups.values()].sort((a, b) => b.amount - a.amount);
  if (parts.length === 0 || !(total > 0)) return [];

  const factor = total / parts.reduce((sum, part) => sum + part.amount, 0);
  for (const part of parts) part.amount = round2(part.amount * factor);
  const sum = parts.reduce((acc, part) => acc + part.amount, 0);
  parts[parts.length - 1].amount = round2(parts[parts.length - 1].amount + (total - sum));
  return parts.filter(part => part.amount > 0);
}
