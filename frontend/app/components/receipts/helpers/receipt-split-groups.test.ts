import { describe, expect, it } from 'vitest';
import { groupSplitItems } from './receipt-split-groups';

describe('groupSplitItems', () => {
  it('groups by category and spreads tax over the parts in proportion', () => {
    const parts = groupSplitItems(
      [
        { description: 'Milk', amount: 2, categoryId: 'food' },
        { description: 'Bread', amount: 3, categoryId: 'food' },
        { description: 'Shampoo', amount: 4, categoryId: 'home' },
      ],
      10,
    );

    expect(parts).toEqual([
      { categoryId: 'food', amount: 5.56, items: ['Milk', 'Bread'] },
      { categoryId: 'home', amount: 4.44, items: ['Shampoo'] },
    ]);
  });

  it('always sums to the transaction amount to the cent', () => {
    const parts = groupSplitItems(
      [
        { description: 'A', amount: 1, categoryId: 'a' },
        { description: 'B', amount: 1, categoryId: 'b' },
        { description: 'C', amount: 1, categoryId: 'c' },
      ],
      10,
    );

    expect(parts.reduce((sum, part) => sum + part.amount, 0)).toBeCloseTo(10, 2);
  });
});
