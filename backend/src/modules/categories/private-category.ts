import type { Repository } from 'typeorm';
import { Category, CategorySource, type CategoryType } from '../../entities/category.entity';

/**
 * Where a private row's money is counted.
 *
 * A private transaction is still the household's money, so it has to land in
 * some category or the totals stop adding up. It lands here — for everyone,
 * including the person who made it private. That is what keeps the feature
 * honest: no total anywhere depends on who is looking, so there is no sum to
 * subtract one view from another and recover the hidden row.
 *
 * Enabled like any other category: a row filed here is correctly categorised,
 * and a disabled one reads as "needs a category" in the lists. Keeping it out
 * of the pickers is the client's job — see `isPrivateCategoryName`.
 */
export const PRIVATE_CATEGORY_NAME = 'Private';

export function isPrivateCategoryName(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === PRIVATE_CATEGORY_NAME.toLowerCase();
}

/**
 * The workspace's `Private` category for this kind of money, created on first
 * use. Kept unique by `UQ_categories_private`, so two rows made private at the
 * same time cannot each create one.
 */
export async function ensurePrivateCategory(
  categoryRepository: Repository<Category>,
  workspaceId: string,
  type: CategoryType,
): Promise<Category> {
  const existing = await categoryRepository.findOne({
    where: { workspaceId, type, name: PRIVATE_CATEGORY_NAME, parentId: undefined },
  });
  if (existing) {
    return existing;
  }

  const category = categoryRepository.create({
    workspaceId,
    name: PRIVATE_CATEGORY_NAME,
    type,
    isSystem: true,
    source: CategorySource.SYSTEM,
    isEnabled: true,
  });

  try {
    return await categoryRepository.save(category);
  } catch (error) {
    // Lost the race against a parallel request; the other one's row is the one.
    if ((error as { code?: string }).code !== '23505') {
      throw error;
    }
    const created = await categoryRepository.findOne({
      where: { workspaceId, type, name: PRIVATE_CATEGORY_NAME },
    });
    if (!created) {
      throw error;
    }
    return created;
  }
}
