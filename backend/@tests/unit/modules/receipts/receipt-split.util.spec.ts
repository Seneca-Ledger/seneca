import { groupLineItemsIntoParts } from '../../../../src/modules/receipts/services/receipt-split.util';

describe('groupLineItemsIntoParts', () => {
  it('groups by category and spreads the uncovered rest (tax, tip) in proportion', () => {
    const parts = groupLineItemsIntoParts(
      [
        { description: 'Milk', amount: 2, categoryId: 'food' },
        { description: 'Bread', amount: 3, categoryId: 'food' },
        { description: 'Shampoo', amount: 4, categoryId: 'household' },
      ],
      10,
      'misc',
    );
    expect(parts).toEqual([
      { categoryId: 'food', amount: 5.56, items: ['Milk', 'Bread'] },
      { categoryId: 'household', amount: 4.44, items: ['Shampoo'] },
    ]);
  });

  it('scales down when the lines add up to more than the total', () => {
    const parts = groupLineItemsIntoParts(
      [
        { description: 'A', amount: 60, categoryId: 'a' },
        { description: 'B', amount: 60, categoryId: 'b' },
      ],
      100,
      null,
    );
    expect(parts.map(part => part.amount)).toEqual([50, 50]);
  });

  it('sends uncategorised lines to the fallback and sums to the cent', () => {
    const parts = groupLineItemsIntoParts(
      [
        { description: 'A', amount: 3.335, categoryId: 'a' },
        { description: 'B', amount: 3.335, categoryId: null },
        { description: 'C', amount: 3.33, categoryId: 'a' },
      ],
      10,
      'fallback',
    );
    expect(parts.reduce((sum, part) => sum + part.amount, 0)).toBeCloseTo(10, 2);
    expect(parts.find(part => part.categoryId === 'fallback')?.items).toEqual(['B']);
  });

  it('drops empty and non-positive lines', () => {
    expect(groupLineItemsIntoParts([{ description: 'x', amount: 0, categoryId: 'a' }], 10, null)).toEqual([]);
  });
});
