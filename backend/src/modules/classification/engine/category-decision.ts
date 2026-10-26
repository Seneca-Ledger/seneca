import { type Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';

/**
 * Whether a person stands behind the row's category: they picked it, or a rule
 * they wrote put it there. A category with no recorded source predates source
 * tracking and is treated as decided too, since nobody can tell otherwise.
 * Anything else (the importer's fallback, the model, a payee default) may be
 * replaced by better information.
 */
export function hasDecidedCategory(
  transaction: Pick<Transaction, 'categoryId' | 'categorySource'>,
): boolean {
  if (!transaction.categoryId) {
    return false;
  }
  return (
    transaction.categorySource === null ||
    transaction.categorySource === undefined ||
    transaction.categorySource === TransactionCategorySource.MANUAL ||
    transaction.categorySource === TransactionCategorySource.RULE
  );
}
