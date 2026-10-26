import { UNCATEGORIZED_CATEGORY_NAME } from '../../categories/uncategorized-category';

type WhereChain<T> = {
  andWhere(where: string, parameters?: Record<string, unknown>): T;
};

/**
 * Which rows may teach a payee its category: the ones where a person decided.
 * That is a row they approved in Review, or one whose category they picked by
 * hand even if the row itself still waits for approval. A category the engine
 * filled in and nobody looked at must never become evidence for the next
 * guess, or one wrong guess reinforces itself.
 *
 * "Uncategorized" is not a decision about the payee: approving a statement
 * as is, or a fallback the importer put there, must not teach the payee to
 * stay uncategorized.
 *
 * Parts of a split are left out too: their categories describe the lines of
 * one purchase, not what the payee usually is.
 */
export function onlyPayeeEvidence<T extends WhereChain<T>>(query: T, alias: string): T {
  return query
    .andWhere(`${alias}.categoryId IS NOT NULL`)
    .andWhere(`(${alias}.isVerified = true OR ${alias}.categorySource = 'manual')`)
    .andWhere(`(${alias}.categorySource IS NULL OR ${alias}.categorySource <> 'default')`)
    .andWhere(`${alias}.isDuplicate = false`)
    .andWhere(`${alias}.splitGroupId IS NULL`)
    .andWhere(
      `NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = ${alias}.statementId AND trashed.deleted_at IS NOT NULL)`,
    )
    .andWhere(
      `NOT EXISTS (SELECT 1 FROM categories fallback WHERE fallback.id = ${alias}.categoryId AND LOWER(fallback.name) = LOWER(:uncategorizedName))`,
      { uncategorizedName: UNCATEGORIZED_CATEGORY_NAME },
    );
}
