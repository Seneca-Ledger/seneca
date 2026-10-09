import { buildSpendFlow, type SpendFlowRow } from '@/modules/reports/spend-flow.util';

const categories = [
  { id: 'food', name: 'Food', parentId: null, color: '#f00' },
  { id: 'groceries', name: 'Groceries', parentId: 'food', color: null },
  { id: 'travel', name: 'Travel', parentId: null, color: '#00f' },
  { id: 'organic', name: 'Organic', parentId: 'groceries', color: null },
  { id: 'bakery', name: 'Bakery', parentId: 'food', color: null },
];
const options = {
  groupBy: 'category-merchant' as const,
  merchantsPerCategory: 2,
  maxCategories: 8,
  maxMerchants: 10,
  minMerchantShare: 0,
};
const row = (categoryId: string | null, merchant: string | null, amount: number): SpendFlowRow => ({
  categoryId,
  merchantKey: merchant?.toLowerCase() ?? null,
  merchantName: merchant,
  amount,
});

describe('buildSpendFlow', () => {
  it('rolls subcategories into their root category', () => {
    const flow = buildSpendFlow(
      [row('groceries', 'Rewe', 40), row('food', 'Rewe', 10), row('travel', 'DB', 50)],
      categories,
      options,
    );

    expect(flow.total).toBe(100);
    expect(flow.nodes.find(node => node.id === 'cat:food')).toMatchObject({
      name: 'Food',
      amount: 50,
      share: 0.5,
      color: '#f00',
    });
    expect(flow.nodes.find(node => node.id === 'm:food:rewe')).toMatchObject({
      kind: 'merchant',
      name: 'Rewe',
      amount: 50,
      color: '#f00',
    });
    expect(flow.nodes.some(node => node.id === 'cat:groceries')).toBe(false);
  });

  it('keeps the largest merchants and rolls the rest into one node per category', () => {
    const flow = buildSpendFlow(
      [row('travel', 'DB', 50), row('travel', 'Lufthansa', 30), row('travel', 'Uber', 15), row('travel', 'Bolt', 5)],
      categories,
      options,
    );

    const merchants = flow.nodes.filter(node => node.kind === 'merchant').map(node => node.name);
    expect(merchants).toEqual(['DB', 'Lufthansa']);
    expect(flow.nodes.find(node => node.id === 'other:travel')).toMatchObject({
      kind: 'other',
      name: null,
      amount: 20,
      mergedCount: 2,
    });
    expect(flow.links).toContainEqual({ source: 'cat:travel', target: 'other:travel', value: 20 });
  });

  it('rolls merchants too small to label into the category tail', () => {
    const flow = buildSpendFlow(
      [row('travel', 'DB', 95), row('travel', 'Bolt', 3), row('travel', 'Uber', 2)],
      categories,
      { ...options, minMerchantShare: 0.05 },
    );

    expect(flow.nodes.filter(node => node.kind === 'merchant').map(node => node.name)).toEqual([
      'DB',
    ]);
    expect(flow.nodes.find(node => node.id === 'other:travel')).toMatchObject({
      amount: 5,
      mergedCount: 2,
    });
  });

  it('names a lone small merchant instead of an "other (1)" node', () => {
    const flow = buildSpendFlow([row('travel', 'DB', 99), row('travel', 'Bolt', 1)], categories, {
      ...options,
      minMerchantShare: 0.05,
    });

    expect(flow.nodes.some(node => node.kind === 'other')).toBe(false);
    expect(flow.nodes.find(node => node.name === 'Bolt')).toMatchObject({ kind: 'merchant' });
  });

  it('balances every column against the total', () => {
    const flow = buildSpendFlow(
      [row('food', 'Rewe', 12.34), row('travel', 'DB', 7.66), row(null, null, 5)],
      categories,
      options,
    );

    const fromTotal = flow.links.filter(link => link.source === 'total');
    expect(fromTotal.reduce((sum, link) => sum + link.value, 0)).toBeCloseTo(flow.total, 2);
    const categoryShares = flow.nodes.filter(node => node.id.startsWith('cat:'));
    expect(categoryShares.reduce((sum, node) => sum + node.share, 0)).toBeCloseTo(1, 3);
  });

  it('labels uncategorised and nameless rows for the client to localize', () => {
    const flow = buildSpendFlow([row(null, null, 5), row('ghost', 'X', 5)], categories, options);

    expect(flow.nodes.find(node => node.id === 'cat:__none__')).toMatchObject({ name: null, amount: 10 });
    expect(flow.nodes.find(node => node.id === 'm:__none__:__none__')).toMatchObject({ name: null });
    expect(flow.nodes.find(node => node.id === 'total')).toMatchObject({ name: null, share: 1 });
  });

  it('rolls categories beyond the limit into one node without a merchant column', () => {
    const flow = buildSpendFlow(
      [row('food', 'Rewe', 50), row('travel', 'DB', 30), row(null, 'Kiosk', 20)],
      categories,
      { ...options, maxCategories: 1 },
    );

    expect(flow.nodes.find(node => node.id === 'cat:__other__')).toMatchObject({
      amount: 50,
      mergedCount: 2,
    });
    expect(flow.links.some(link => link.source === 'cat:__other__')).toBe(false);
  });

  it('returns an empty flow when nothing was spent', () => {
    expect(buildSpendFlow([], categories, options)).toEqual({ total: 0, nodes: [], links: [] });
    expect(buildSpendFlow([row('food', 'Rewe', 0)], categories, options).nodes).toEqual([]);
  });

  describe('category-subcategory', () => {
    const bySub = { ...options, groupBy: 'category-subcategory' as const };

    it('breaks a category into its first-level subcategories', () => {
      const flow = buildSpendFlow(
        [row('organic', 'A', 30), row('groceries', 'B', 20), row('bakery', 'C', 10), row('food', 'D', 5)],
        categories,
        { ...bySub, merchantsPerCategory: 5 },
      );

      expect(flow.nodes.find(node => node.id === 'cat:food')).toMatchObject({ amount: 65 });
      // Deeper "organic" rolls into "groceries"; spending on Food itself is the null-named child.
      expect(flow.nodes.find(node => node.id === 'sub:food:groceries')).toMatchObject({
        kind: 'subcategory',
        name: 'Groceries',
        amount: 50,
      });
      expect(flow.nodes.find(node => node.id === 'sub:food:bakery')).toMatchObject({ amount: 10 });
      expect(flow.nodes.find(node => node.id === 'sub:food:__none__')).toMatchObject({
        kind: 'subcategory',
        name: null,
        amount: 5,
      });
      expect(flow.nodes.some(node => node.kind === 'merchant')).toBe(false);
    });

    it('ends a category without subcategories at the category column', () => {
      const flow = buildSpendFlow([row('travel', 'DB', 50)], categories, bySub);

      expect(flow.nodes.map(node => node.id)).toEqual(['total', 'cat:travel']);
    });
  });

  describe('merchant', () => {
    it('lists merchants straight under the total, across categories', () => {
      const flow = buildSpendFlow(
        [row('food', 'Rewe', 30), row('groceries', 'Rewe', 20), row('travel', 'DB', 40), row('travel', 'Bolt', 5), row('food', 'Kiosk', 5)],
        categories,
        { ...options, groupBy: 'merchant', maxMerchants: 2 },
      );

      expect(flow.nodes.map(node => node.id)).toEqual(['total', 'm:rewe', 'm:db', 'other:merchants']);
      expect(flow.nodes.find(node => node.id === 'm:rewe')).toMatchObject({ amount: 50, share: 0.5 });
      expect(flow.nodes.find(node => node.id === 'other:merchants')).toMatchObject({
        amount: 10,
        mergedCount: 2,
      });
      expect(flow.links.every(link => link.source === 'total')).toBe(true);
    });
  });
});
