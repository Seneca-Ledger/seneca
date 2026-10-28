import { countWithoutCategory } from '../../../../src/modules/categories/uncategorized-category';

describe('countWithoutCategory', () => {
  it('counts only rows with no category, not rows left in the fallback', () => {
    const placed = { categoryId: 'category-1' };
    const fallback = { categoryId: 'fallback-1' };
    const none = { categoryId: null };

    expect(countWithoutCategory([placed, fallback, none])).toBe(1);
  });
});
