export interface SplitLineItem {
  description: string;
  amount: number;
  categoryId: string | null;
}

export interface SplitPart {
  categoryId: string | null;
  amount: number;
  items: string[];
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Groups receipt lines by category and scales them to the transaction's amount
 * in proportion, so tax, tips and rounding (what the lines do not add up to) are
 * shared by every group, and lines that add up to more are scaled down alike.
 * Items without a category join the fallback category.
 */
export function groupLineItemsIntoParts(
  items: SplitLineItem[],
  total: number,
  fallbackCategoryId: string | null,
): SplitPart[] {
  const groups = new Map<string | null, SplitPart>();
  for (const item of items) {
    if (!(item.amount > 0)) continue;
    const key = item.categoryId ?? fallbackCategoryId;
    const part = groups.get(key) ?? { categoryId: key, amount: 0, items: [] };
    part.amount += item.amount;
    part.items.push(item.description);
    groups.set(key, part);
  }
  const parts = [...groups.values()].sort((a, b) => b.amount - a.amount);
  if (parts.length === 0 || !(total > 0)) return [];

  const factor = total / parts.reduce((sum, part) => sum + part.amount, 0);
  for (const part of parts) part.amount = round2(part.amount * factor);
  // Rounding residue goes to the last part so the parts sum to the cent.
  const sum = parts.reduce((acc, part) => acc + part.amount, 0);
  parts[parts.length - 1].amount = round2(parts[parts.length - 1].amount + (total - sum));
  return parts.filter(part => part.amount > 0);
}
