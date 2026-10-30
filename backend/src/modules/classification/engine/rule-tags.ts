import { type EntityManager, In } from 'typeorm';
import { Tag } from '../../../entities/tag.entity';

/**
 * The rule's tags that still exist in the workspace. A tag deleted after the
 * rule was saved is dropped rather than failing the import on the foreign key,
 * and the rest of the rule (its category) still applies.
 */
export async function ownedTagIds(
  manager: EntityManager,
  workspaceId: string | null,
  tagIds: readonly string[] | undefined,
): Promise<string[]> {
  const unique = [...new Set(tagIds ?? [])];
  if (!workspaceId || unique.length === 0) {
    return [];
  }
  const tags = await manager.getRepository(Tag).find({
    select: { id: true },
    where: { id: In(unique), workspaceId },
  });
  return tags.map(tag => tag.id);
}

/**
 * The rule's surviving tags as the relation a new row is saved with, or
 * undefined when there are none, so the classification carries no tags key.
 */
export async function ruleTags(
  manager: EntityManager,
  workspaceId: string | null,
  tagIds: readonly string[] | undefined,
): Promise<Tag[] | undefined> {
  const ids = await ownedTagIds(manager, workspaceId, tagIds);
  return ids.length > 0 ? ids.map(id => ({ id }) as Tag) : undefined;
}

/**
 * Adds tags to rows of the workspace; a pair already there is kept as it is.
 * Never replaces a row's tags: a rule adds a label, it does not take any away.
 * Only rows and tags of `workspaceId` are paired, whatever the caller passes.
 */
export async function addTransactionTags(
  manager: EntityManager,
  workspaceId: string,
  transactionIds: readonly string[],
  tagIds: readonly string[],
): Promise<void> {
  if (transactionIds.length === 0 || tagIds.length === 0) {
    return;
  }
  await manager.query(
    `INSERT INTO transaction_tags (transaction_id, tag_id)
     SELECT tx.id, tg.id
       FROM transactions tx
       JOIN tags tg ON tg.workspace_id = tx.workspace_id
      WHERE tx.workspace_id = $1
        AND tx.id = ANY($2::uuid[])
        AND tg.id = ANY($3::uuid[])
     ON CONFLICT DO NOTHING`,
    [workspaceId, [...transactionIds], [...tagIds]],
  );
}
