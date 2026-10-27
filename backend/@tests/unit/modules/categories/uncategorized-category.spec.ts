import { TransactionCategorySource } from '../../../../src/entities/transaction.entity';
import { countAwaitingCategory } from '../../../../src/modules/categories/uncategorized-category';

describe('countAwaitingCategory', () => {
  it('counts rows with no category and rows left in the fallback, not placed ones', () => {
    const placed = { categoryId: 'category-1', categorySource: TransactionCategorySource.HISTORY };
    const fallback = { categoryId: 'fallback-1', categorySource: TransactionCategorySource.DEFAULT };
    const none = { categoryId: null, categorySource: null };

    expect(countAwaitingCategory([placed, fallback, none])).toBe(2);
  });
});
