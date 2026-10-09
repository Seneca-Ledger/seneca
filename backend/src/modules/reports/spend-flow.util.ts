/**
 * The analytics sankey as a pure function over already-converted rows, in
 * one of three shapes:
 * - `category-merchant` (top spenders): total → root categories → merchants;
 * - `category-subcategory` (top categories): total → root categories → their
 *   direct subcategories;
 * - `merchant` (top merchants): total → merchants.
 * Deeper categories roll into their root (or first-level subcategory), and
 * each level keeps only its largest nodes so the sankey stays readable; the
 * tail becomes one "other" node.
 */

export type SpendFlowGroupBy = 'category-merchant' | 'category-subcategory' | 'merchant';

export interface SpendFlowRow {
  categoryId: string | null;
  /** Lower-cased merchant key; null when the row has no counterparty. */
  merchantKey: string | null;
  merchantName: string | null;
  /** Positive, already in the workspace currency. */
  amount: number;
}

export interface SpendFlowCategory {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
}

export type SpendFlowNodeKind = 'total' | 'category' | 'subcategory' | 'merchant' | 'other';

export interface SpendFlowNode {
  /** Unique: sankey links address nodes by name. */
  id: string;
  kind: SpendFlowNodeKind;
  /**
   * Null where the client supplies a localized label: the total, the
   * uncategorised bucket, a merchant without a name, spending booked on a
   * category itself rather than a subcategory, and rolled-up nodes.
   */
  name: string | null;
  amount: number;
  /** Fraction of the total, 0..1. */
  share: number;
  color: string | null;
  /** Set on rolled-up nodes only: how many merchants or categories they stand for. */
  mergedCount?: number;
}

export interface SpendFlow {
  total: number;
  nodes: SpendFlowNode[];
  links: Array<{ source: string; target: string; value: number }>;
}

export interface SpendFlowOptions {
  groupBy: SpendFlowGroupBy;
  /** Second-column nodes per category (merchants or subcategories). */
  merchantsPerCategory: number;
  maxCategories: number;
  /** Merchant nodes in the `merchant` shape. */
  maxMerchants: number;
  /**
   * Merchants below this fraction of the total join the category's "other"
   * node: a sliver of a node still needs a full two-line label's height.
   */
  minMerchantShare: number;
}

const NONE = '__none__';

interface Child {
  key: string;
  name: string | null;
  amount: number;
}

interface RootBucket {
  rootId: string;
  amount: number;
  children: Child[];
}

type ChildOf = (row: SpendFlowRow) => { key: string; name: string | null };

function categoryTree(categories: SpendFlowCategory[]) {
  const byId = new Map(categories.map(category => [category.id, category]));
  /** The chain from the category up to its root, the root last. */
  const pathOf = (id: string | null): SpendFlowCategory[] => {
    const path: SpendFlowCategory[] = [];
    let current = id ? byId.get(id) : undefined;
    while (current && path.length < 10) {
      path.push(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return path;
  };
  return { byId, pathOf };
}

const sortByAmount = <T extends { amount: number }>(items: T[]): T[] =>
  items.sort((a, b) => b.amount - a.amount);

/** Rows grouped by root category and a second-level key, both sorted by amount. */
function groupByRoot(
  rows: SpendFlowRow[],
  pathOf: (id: string | null) => SpendFlowCategory[],
  childOf: ChildOf,
): RootBucket[] {
  const byRoot = new Map<string, Map<string, Child>>();
  for (const row of rows) {
    if (!(row.amount > 0)) {
      continue;
    }
    const path = pathOf(row.categoryId);
    const rootId = path.at(-1)?.id ?? NONE;
    const { key, name } = childOf(row);
    const bucket = byRoot.get(rootId) ?? new Map<string, Child>();
    const entry = bucket.get(key) ?? { key, name, amount: 0 };
    entry.amount += row.amount;
    bucket.set(key, entry);
    byRoot.set(rootId, bucket);
  }

  return sortByAmount(
    [...byRoot.entries()].map(([rootId, children]) => ({
      rootId,
      children: sortByAmount([...children.values()]),
      amount: [...children.values()].reduce((sum, child) => sum + child.amount, 0),
    })),
  );
}

/** The largest items above the share floor; a tail of one is kept by name. */
function splitTop<T extends { amount: number }>(
  items: T[],
  limit: number,
  minAmount: number,
): { top: T[]; rest: T[] } {
  const top = items.slice(0, limit).filter(item => item.amount >= minAmount);
  // "Other (1)" hides a name for nothing.
  if (items.length === top.length + 1) {
    top.push(items[top.length]);
  }
  return { top, rest: items.slice(top.length) };
}

export function buildSpendFlow(
  rows: SpendFlowRow[],
  categories: SpendFlowCategory[],
  options: SpendFlowOptions,
): SpendFlow {
  const tree = categoryTree(categories);
  if (options.groupBy === 'merchant') {
    return buildMerchantFlow(rows, options);
  }
  const childOf: ChildOf =
    options.groupBy === 'category-subcategory'
      ? row => {
          // The first-level subcategory on the way to the root; spending booked
          // on the root itself becomes the NONE child.
          const path = tree.pathOf(row.categoryId);
          const sub = path.length >= 2 ? path[path.length - 2] : null;
          return { key: sub?.id ?? NONE, name: sub?.name ?? null };
        }
      : row => ({
          key: row.merchantKey?.trim() || NONE,
          name: row.merchantName?.trim() || null,
        });
  return buildCategoryFlow(groupByRoot(rows, tree.pathOf, childOf), tree.byId, options);
}

function emptyFlow(): SpendFlow {
  return { total: 0, nodes: [], links: [] };
}

function shareOf(total: number) {
  return (amount: number) => Math.round((amount / total) * 10000) / 10000;
}

function buildMerchantFlow(rows: SpendFlowRow[], options: SpendFlowOptions): SpendFlow {
  const byKey = new Map<string, Child>();
  for (const row of rows) {
    if (!(row.amount > 0)) {
      continue;
    }
    const key = row.merchantKey?.trim() || NONE;
    const entry = byKey.get(key) ?? { key, name: row.merchantName?.trim() || null, amount: 0 };
    entry.amount += row.amount;
    byKey.set(key, entry);
  }
  const merchants = sortByAmount([...byKey.values()]);
  const total = round2(merchants.reduce((sum, merchant) => sum + merchant.amount, 0));
  if (total <= 0) {
    return emptyFlow();
  }
  const share = shareOf(total);
  const nodes: SpendFlowNode[] = [
    { id: 'total', kind: 'total', name: null, amount: total, share: 1, color: null },
  ];
  const links: SpendFlow['links'] = [];
  const { top, rest } = splitTop(merchants, options.maxMerchants, total * options.minMerchantShare);
  for (const merchant of top) {
    const id = `m:${merchant.key}`;
    const amount = round2(merchant.amount);
    nodes.push({
      id,
      kind: 'merchant',
      name: merchant.name,
      amount,
      share: share(amount),
      color: null,
    });
    links.push({ source: 'total', target: id, value: amount });
  }
  if (rest.length > 0) {
    const amount = round2(rest.reduce((sum, merchant) => sum + merchant.amount, 0));
    nodes.push({
      id: 'other:merchants',
      kind: 'other',
      name: null,
      amount,
      share: share(amount),
      color: null,
      mergedCount: rest.length,
    });
    links.push({ source: 'total', target: 'other:merchants', value: amount });
  }
  return { total, nodes, links };
}

function buildCategoryFlow(
  roots: RootBucket[],
  byId: Map<string, SpendFlowCategory>,
  options: SpendFlowOptions,
): SpendFlow {
  const total = round2(roots.reduce((sum, root) => sum + root.amount, 0));
  if (total <= 0) {
    return emptyFlow();
  }

  const share = shareOf(total);
  const childKind: SpendFlowNodeKind =
    options.groupBy === 'category-subcategory' ? 'subcategory' : 'merchant';
  const childPrefix = childKind === 'subcategory' ? 'sub' : 'm';
  const nodes: SpendFlowNode[] = [
    { id: 'total', kind: 'total', name: null, amount: total, share: 1, color: null },
  ];
  const links: SpendFlow['links'] = [];

  const kept = roots.slice(0, options.maxCategories);
  const tail = roots.slice(options.maxCategories);

  for (const root of kept) {
    const category = byId.get(root.rootId);
    const categoryNodeId = `cat:${root.rootId}`;
    const amount = round2(root.amount);
    nodes.push({
      id: categoryNodeId,
      kind: 'category',
      name: category?.name ?? null,
      amount,
      share: share(amount),
      color: category?.color ?? null,
    });
    links.push({ source: 'total', target: categoryNodeId, value: amount });

    // A category with no subcategories at all has nothing to break down into:
    // it ends at the category column instead of repeating itself.
    if (childKind === 'subcategory' && root.children.every(child => child.key === NONE)) {
      continue;
    }

    const { top, rest } = splitTop(
      root.children,
      options.merchantsPerCategory,
      total * options.minMerchantShare,
    );
    for (const child of top) {
      const childNodeId = `${childPrefix}:${root.rootId}:${child.key}`;
      const childAmount = round2(child.amount);
      nodes.push({
        id: childNodeId,
        kind: childKind,
        name: child.name,
        amount: childAmount,
        share: share(childAmount),
        color: category?.color ?? null,
      });
      links.push({ source: categoryNodeId, target: childNodeId, value: childAmount });
    }
    if (rest.length > 0) {
      const restAmount = round2(rest.reduce((sum, child) => sum + child.amount, 0));
      const otherId = `other:${root.rootId}`;
      nodes.push({
        id: otherId,
        kind: 'other',
        name: null,
        amount: restAmount,
        share: share(restAmount),
        color: category?.color ?? null,
        mergedCount: rest.length,
      });
      links.push({ source: categoryNodeId, target: otherId, value: restAmount });
    }
  }

  // The category tail stops at the category column: a second column under
  // "other categories" would mix children of unrelated categories.
  if (tail.length > 0) {
    const tailAmount = round2(tail.reduce((sum, root) => sum + root.amount, 0));
    nodes.push({
      id: 'cat:__other__',
      kind: 'other',
      name: null,
      amount: tailAmount,
      share: share(tailAmount),
      color: null,
      mergedCount: tail.length,
    });
    links.push({ source: 'total', target: 'cat:__other__', value: tailAmount });
  }

  return { total, nodes, links };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
