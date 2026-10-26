import { In, Repository } from 'typeorm';
import { Category, Receipt } from '../../../entities';

/**
 * The category a user picks on a receipt is stored inside `parsedData` as a
 * bare id, so every reader would otherwise have to resolve the name itself.
 * Lists render the name with the category's icon, so the id is resolved once here.
 */
export type ReceiptWithCategory = Receipt & {
  category: { id: string; name: string; color: string | null; icon: string | null } | null;
};

export async function attachReceiptCategories(
  receipts: Receipt[],
  categoryRepository: Repository<Category>,
  workspaceId: string,
): Promise<ReceiptWithCategory[]> {
  const categoryIds = [
    ...new Set(
      receipts
        .map(receipt => receipt.parsedData?.categoryId)
        .filter((categoryId): categoryId is string => Boolean(categoryId)),
    ),
  ];

  const categories = categoryIds.length
    ? await categoryRepository.find({
        where: { id: In(categoryIds), workspaceId },
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
        },
      })
    : [];
  const byId = new Map(categories.map(category => [category.id, category]));

  return receipts.map(receipt => {
    const category = receipt.parsedData?.categoryId
      ? byId.get(receipt.parsedData.categoryId)
      : undefined;
    return {
      ...receipt,
      category: category
        ? {
            id: category.id,
            name: category.name,
            color: category.color ?? null,
            icon: category.icon ?? null,
          }
        : null,
    };
  });
}
