import { type FindOptionsWhere, IsNull } from 'typeorm';
import type { Category } from '../../entities/category.entity';

export function buildStorageCategoryWhere(
  categoryId: string,
  statementUserId: string,
  statementWorkspaceId: string | null,
): FindOptionsWhere<Category>[] {
  if (statementWorkspaceId) {
    return [
      {
        id: categoryId,
        workspaceId: statementWorkspaceId,
      },
    ];
  }

  return [
    {
      id: categoryId,
      userId: statementUserId,
    },
    {
      id: categoryId,
      // A bare null in a find `where` is dropped and would match any owner.
      userId: IsNull(),
      workspaceId: IsNull(),
    },
  ];
}
