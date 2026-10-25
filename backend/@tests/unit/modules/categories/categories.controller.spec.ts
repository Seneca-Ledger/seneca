import { CategoryType } from '@/entities/category.entity';
import { CategoriesController } from '@/modules/categories/categories.controller';

describe('CategoriesController', () => {
  it('proxies calls to CategoriesService', async () => {
    const categoriesService = {
      create: vi.fn(async () => ({ id: 'c1' })),
      findAll: vi.fn(async () => [{ id: 'c1' }]),
      getCategoryUsageCount: vi.fn(async () => ({ transactions: 1, statements: 2, total: 3 })),
      findOne: vi.fn(async () => ({ id: 'c1' })),
      update: vi.fn(async () => ({ id: 'c1', name: 'X' })),
      remove: vi.fn(async () => undefined),
    };
    const controller = new CategoriesController(categoriesService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'w1';

    expect(
      await controller.create({ name: 'A', type: CategoryType.EXPENSE } as any, user, workspaceId),
    ).toEqual({ id: 'c1' });
    expect(await controller.findAll(user, workspaceId, { type: 'expense' })).toEqual([
      { id: 'c1' },
    ]);
    expect(await controller.getUsageCount({ id: 'c1' }, workspaceId)).toEqual({
      transactions: 1,
      statements: 2,
      total: 3,
    });
    expect(await controller.findOne({ id: 'c1' }, user, workspaceId)).toEqual({ id: 'c1' });
    expect(await controller.update({ id: 'c1' }, { name: 'X' } as any, user, workspaceId)).toEqual({
      id: 'c1',
      name: 'X',
    });
    expect(await controller.remove({ id: 'c1' }, user, workspaceId)).toEqual({
      message: 'Category deleted successfully',
    });
  });
});
