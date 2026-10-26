import { TransactionCategorySource } from '../../entities/transaction.entity';

/**
 * Where a category nobody chose comes from: these rows follow a payee's
 * default when it changes; a manual pick or a rule is left alone.
 */
export const UNDECIDED_CATEGORY_SOURCES: readonly TransactionCategorySource[] = [
  TransactionCategorySource.DEFAULT,
  TransactionCategorySource.AI,
  TransactionCategorySource.HISTORY,
  TransactionCategorySource.LEARNED,
  TransactionCategorySource.KEYWORD,
];
