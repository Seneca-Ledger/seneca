import { decidePayeeCategory } from '@/modules/classification/engine/payee-category.matcher';

/** History is oldest first, the way the transactions were booked. */
const history = (...categoryIds: string[]) => categoryIds.map(categoryId => ({ categoryId }));

describe('decidePayeeCategory', () => {
  describe('with fewer than three transactions the last one decides', () => {
    it('answers nothing for a payee nobody has filed yet', () => {
      expect(decidePayeeCategory({ history: [] })).toBeNull();
    });

    it('takes the only category there is', () => {
      expect(decidePayeeCategory({ history: history('groceries') })).toEqual({
        categoryId: 'groceries',
        basis: 'payee-default',
      });
    });

    it('follows the second transaction when it disagrees with the first', () => {
      expect(decidePayeeCategory({ history: history('groceries', 'gifts') })).toEqual({
        categoryId: 'gifts',
        basis: 'payee-default',
      });
    });
  });

  describe("YNAB's rule: two of the three most recent have to agree", () => {
    it('keeps the established category when one odd purchase interrupts it', () => {
      // The grocery store where you once bought a gift card.
      const decision = decidePayeeCategory({
        history: history('groceries', 'groceries', 'groceries', 'gifts'),
      });

      expect(decision).toEqual({ categoryId: 'groceries', basis: 'payee-default' });
    });

    it('moves to the new category once a second recent transaction agrees', () => {
      const decision = decidePayeeCategory({
        history: history('groceries', 'groceries', 'groceries', 'gifts', 'gifts'),
      });

      expect(decision).toEqual({ categoryId: 'gifts', basis: 'payee-default' });
    });

    it('holds the established category when the three most recent all disagree', () => {
      const decision = decidePayeeCategory({
        history: history('groceries', 'groceries', 'gifts', 'fuel', 'dining'),
      });

      expect(decision).toEqual({ categoryId: 'groceries', basis: 'payee-default' });
    });

    it('comes back to the old category when it wins the window again', () => {
      const decision = decidePayeeCategory({
        history: history('groceries', 'gifts', 'gifts', 'groceries', 'groceries'),
      });

      expect(decision).toEqual({ categoryId: 'groceries', basis: 'payee-default' });
    });

    it('reads a long steady history as that one category', () => {
      const decision = decidePayeeCategory({ history: history(...Array(12).fill('fuel')) });

      expect(decision).toEqual({ categoryId: 'fuel', basis: 'payee-default' });
    });
  });

  describe('what the user pinned for this payee wins', () => {
    it('always uses the pinned category, whatever the history says', () => {
      const decision = decidePayeeCategory({
        history: history('groceries', 'groceries', 'groceries'),
        override: { mode: 'always', categoryId: 'dining' },
      });

      expect(decision).toEqual({ categoryId: 'dining', basis: 'payee-pinned' });
    });

    it('answers nothing when the user asked not to categorise this payee', () => {
      const decision = decidePayeeCategory({
        history: history('groceries', 'groceries', 'groceries'),
        override: { mode: 'never' },
      });

      expect(decision).toBeNull();
    });

    it('falls back to the history when the pinned category is gone', () => {
      const decision = decidePayeeCategory({
        history: history('groceries', 'groceries', 'groceries'),
        override: { mode: 'always', categoryId: null },
      });

      expect(decision).toEqual({ categoryId: 'groceries', basis: 'payee-default' });
    });

    it('leaves the history in charge on the explicit auto mode', () => {
      const decision = decidePayeeCategory({
        history: history('fuel', 'fuel'),
        override: { mode: 'auto' },
      });

      expect(decision).toEqual({ categoryId: 'fuel', basis: 'payee-default' });
    });
  });
});
