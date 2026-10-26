import {
  buildCashFlowMap,
  type CashFlowRow,
  cashFlowMapToCsv,
  previousPeriod,
} from '@/modules/reports/cash-flow-map.util';

const categories = [
  { id: 'food', name: 'Food', parentId: null },
  { id: 'groceries', name: 'Groceries', parentId: 'food' },
  { id: 'restaurants', name: 'Restaurants', parentId: 'food' },
  { id: 'rent', name: 'Rent', parentId: null },
];
const labels = {
  uncategorised: 'Uncategorised',
  otherSources: 'Other sources',
  total: 'Money flow',
  transfers: 'Transfers',
  fromBalance: 'From your balance',
  leftOver: 'Left over',
};
const row = (partial: Partial<CashFlowRow> & { amount: number }): CashFlowRow => ({
  type: 'expense',
  categoryId: null,
  counterpartyName: null,
  isTransfer: false,
  ...partial,
});

describe('buildCashFlowMap', () => {
  it('rolls subcategories up into their parent and draws sources → income → categories → subcategories', () => {
    const map = buildCashFlowMap(
      [
        row({ type: 'income', amount: 3000, counterpartyName: 'ACME' }),
        row({ type: 'income', amount: 200, counterpartyName: 'Refund' }),
        row({ amount: 400, categoryId: 'groceries' }),
        row({ amount: 100, categoryId: 'restaurants' }),
        row({ amount: 50, categoryId: 'food' }),
        row({ amount: 1000, categoryId: 'rent' }),
        row({ amount: 30, categoryId: null }),
      ],
      null,
      categories,
      { labels },
    );

    expect(map.income).toEqual({
      total: 3200,
      sources: [
        { name: 'ACME', amount: 3000 },
        { name: 'Refund', amount: 200 },
      ],
    });
    expect(map.expense.total).toBe(1580);
    expect(map.net).toBe(1620);
    expect(map.expense.categories.map(category => [category.name, category.amount])).toEqual([
      ['Rent', 1000],
      ['Food', 550],
      ['Uncategorised', 30],
    ]);
    const food = map.expense.categories.find(category => category.id === 'food');
    expect(food?.children.map(child => [child.name, child.amount])).toEqual([
      ['Groceries', 400],
      ['Restaurants', 100],
    ]);
    expect(map.sankey.links).toEqual(
      expect.arrayContaining([
        { source: 'source:ACME', target: 'total', value: 3000 },
        { source: 'total', target: 'cat:food', value: 550 },
        { source: 'cat:food', target: 'sub:groceries', value: 400 },
      ]),
    );
    expect(map.treemap.find(item => item.id === 'food')?.children).toHaveLength(2);
    expect(map.previous).toBeNull();
  });

  it('compares with the previous period and keeps categories that only had spending before', () => {
    const map = buildCashFlowMap(
      [row({ type: 'income', amount: 1000, counterpartyName: 'ACME' }), row({ amount: 300, categoryId: 'rent' })],
      [
        row({ type: 'income', amount: 900, counterpartyName: 'ACME' }),
        row({ amount: 250, categoryId: 'rent' }),
        row({ amount: 80, categoryId: 'groceries' }),
      ],
      categories,
      { labels },
    );
    expect(map.previous).toEqual({ income: 900, expense: 330, net: 570 });
    expect(map.expense.categories).toEqual([
      expect.objectContaining({ id: 'rent', amount: 300, previousAmount: 250 }),
      expect.objectContaining({ id: 'food', amount: 0, previousAmount: 80 }),
    ]);
  });

  it('shows transfers as their own flow only when they are included', () => {
    const map = buildCashFlowMap(
      [
        row({ type: 'income', amount: 1000, counterpartyName: 'ACME' }),
        row({ amount: 500, categoryId: 'rent', isTransfer: true }),
      ],
      null,
      categories,
      { labels },
    );
    expect(map.transfers).toBe(500);
    expect(map.expense.total).toBe(0);
    expect(map.sankey.links).toContainEqual({ source: 'total', target: 'transfers', value: 500 });
  });

  it('draws spending beyond income as coming from the balance', () => {
    const map = buildCashFlowMap([row({ amount: 300, categoryId: 'rent' })], null, categories, { labels });
    expect(map.sankey.nodes).toContainEqual({ id: 'balance', name: 'From your balance', kind: 'balance' });
    expect(map.sankey.links).toContainEqual({ source: 'balance', target: 'total', value: 300 });
    expect(map.sankey.nodes.find(node => node.id === 'saved')).toBeUndefined();
  });

  it('draws what income left unspent as left over', () => {
    const map = buildCashFlowMap(
      [
        row({ type: 'income', amount: 1000, counterpartyName: 'ACME' }),
        row({ amount: 300, categoryId: 'rent' }),
        row({ amount: 200, isTransfer: true }),
      ],
      null,
      categories,
      { labels },
    );
    expect(map.sankey.links).toContainEqual({ source: 'total', target: 'saved', value: 500 });
    expect(map.sankey.nodes.find(node => node.id === 'balance')).toBeUndefined();
  });

  it('rolls the long tail of payers into one node', () => {
    const rows = ['a', 'b', 'c', 'd'].map(name => row({ type: 'income', amount: 10, counterpartyName: name }));
    const map = buildCashFlowMap(rows, null, categories, { labels, maxSources: 2 });
    expect(map.income.sources).toEqual([
      { name: 'a', amount: 10 },
      { name: 'b', amount: 10 },
      { name: 'Other sources', amount: 20 },
    ]);
  });
});

describe('previousPeriod', () => {
  it('compares a whole month with the whole month before', () => {
    expect(previousPeriod('2026-09-01', '2026-09-30')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(previousPeriod('2026-10-01', '2026-10-31')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('compares a quarter with the quarter before', () => {
    expect(previousPeriod('2026-07-01', '2026-09-30')).toEqual({ from: '2026-04-01', to: '2026-06-30' });
  });

  it('compares part of a month with the same days of the month before', () => {
    expect(previousPeriod('2026-10-01', '2026-10-15')).toEqual({ from: '2026-09-01', to: '2026-09-15' });
    expect(previousPeriod('2026-03-01', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(previousPeriod('2026-03-01', '2026-03-30')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('compares year to date with last year to the same date', () => {
    expect(previousPeriod('2026-01-01', '2026-10-15')).toEqual({ from: '2025-01-01', to: '2025-10-15' });
  });

  it('falls back to the same number of days right before', () => {
    expect(previousPeriod('2026-03-01', '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-02-28' });
    expect(previousPeriod('2026-03-10', '2026-03-19')).toEqual({ from: '2026-02-28', to: '2026-03-09' });
  });
});

describe('cashFlowMapToCsv', () => {
  it('writes one row per category and subcategory with the delta', () => {
    const map = buildCashFlowMap(
      [row({ amount: 300, categoryId: 'groceries' })],
      [row({ amount: 200, categoryId: 'groceries' })],
      categories,
      { labels },
    );
    const csv = cashFlowMapToCsv(map, 'USD');
    expect(csv.split('\n')[0]).toBe('category,subcategory,amount_USD,previous_USD,delta');
    expect(csv).toContain('"Food","",300.00,200.00,100.00');
    expect(csv).toContain('"Food","Groceries",300.00,200.00,100.00');
  });
});

describe('refunds', () => {
  const PAYER = 'Example Corp';
  const SHOP = 'ACME Store';
  const shopping = [
    { id: 'clothes', name: 'Clothes', parentId: null, isExpenseCategory: true },
    { id: 'coats', name: 'Coats', parentId: 'clothes', isExpenseCategory: true },
    { id: 'salary', name: 'Salary', parentId: null, isExpenseCategory: false },
  ];
  const netted = { labels, netRefunds: true };

  it('takes money back out of the category it was spent from, not into income', () => {
    const map = buildCashFlowMap(
      [
        row({ type: 'income', amount: 2000, categoryId: 'salary', counterpartyName: PAYER }),
        row({ amount: 300, categoryId: 'coats' }),
        row({ type: 'income', amount: 100, categoryId: 'coats', counterpartyName: SHOP }),
      ],
      null,
      shopping,
      netted,
    );

    expect(map.income.total).toBe(2000);
    expect(map.income.sources.map(source => source.name)).toEqual([PAYER]);
    expect(map.expense.total).toBe(200);
    expect(map.expense.categories[0].children[0]).toMatchObject({ id: 'coats', amount: 200 });
  });

  it('counts a refund as income unless asked to net it, so the default matches the dashboard', () => {
    const map = buildCashFlowMap(
      [
        row({ amount: 300, categoryId: 'coats' }),
        row({ type: 'income', amount: 100, categoryId: 'coats', counterpartyName: SHOP }),
      ],
      null,
      shopping,
      { labels },
    );

    expect(map.income.total).toBe(100);
    expect(map.expense.total).toBe(300);
  });

  it('leaves income filed under an income category alone', () => {
    const map = buildCashFlowMap(
      [row({ type: 'income', amount: 2000, categoryId: 'salary', counterpartyName: PAYER })],
      null,
      shopping,
      netted,
    );

    expect(map.income.total).toBe(2000);
    expect(map.expense.total).toBe(0);
  });

  it('nets the period before on the same terms, so the comparison is like for like', () => {
    const map = buildCashFlowMap(
      [row({ amount: 300, categoryId: 'coats' })],
      [
        row({ amount: 500, categoryId: 'coats' }),
        row({ type: 'income', amount: 200, categoryId: 'coats', counterpartyName: SHOP }),
      ],
      shopping,
      netted,
    );

    expect(map.previous).toEqual({ income: 0, expense: 300, net: -300 });
  });

  it('keeps a category that refunded more than it spent out of the diagrams but in the table', () => {
    const map = buildCashFlowMap(
      [
        row({ amount: 50, categoryId: 'coats' }),
        row({ type: 'income', amount: 200, categoryId: 'coats', counterpartyName: SHOP }),
      ],
      null,
      shopping,
      netted,
    );

    expect(map.expense.categories[0].amount).toBe(-150);
    expect(map.treemap).toEqual([]);
    expect(map.sankey.links.some(link => link.target === 'cat:clothes')).toBe(false);
  });
});
