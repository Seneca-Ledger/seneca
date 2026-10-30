import type { Mock } from 'vitest';
import {
  type Category,
  CategoryType,
  type Statement,
  type Transaction,
  type User,
  type WorkspaceMember,
  WorkspaceRole,
} from '@/entities';
import { AuditService } from '@/modules/audit/audit.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

function createRepoMock<T extends object>() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn((data: Partial<T>) => data as T),
    save: vi.fn(async (data: Partial<T>) => data as T),
    remove: vi.fn(async () => undefined),
  } as unknown as Repository<T> & Record<string, any>;
}

describe('CategoriesService', () => {
  const categoryRepository = createRepoMock<Category>();
  const userRepository = createRepoMock<User>();
  const workspaceMemberRepository = createRepoMock<WorkspaceMember>();
  const transactionRepository = createRepoMock<Transaction>();
  const statementRepository = createRepoMock<Statement>();
  const cacheManager = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
  const auditService = { createEvent: vi.fn() } as unknown as AuditService;

  let service: CategoriesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CategoriesService(
      categoryRepository as any,
      userRepository as any,
      workspaceMemberRepository as any,
      transactionRepository as any,
      statementRepository as any,
      cacheManager as any,
      auditService as any,
    );
  });

  it('create throws ConflictException for duplicate name in workspace', async () => {
    categoryRepository.findOne = vi.fn(async () => ({ id: 'c1' }) as any);

    await expect(
      service.create('w1', 'u1', { name: 'Food', type: CategoryType.EXPENSE } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('update throws ConflictException when changing name to existing one', async () => {
    categoryRepository.findOne = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'c1',
        workspaceId: 'w1',
        userId: 'u1',
        name: 'Old',
        type: CategoryType.EXPENSE,
        isSystem: false,
      } as any)
      .mockResolvedValueOnce({
        id: 'c2',
        workspaceId: 'w1',
        userId: 'u1',
        name: 'New',
        type: CategoryType.EXPENSE,
      } as any);

    await expect(service.update('c1', 'w1', 'u1', { name: 'New' } as any)).rejects.toThrow(
      ConflictException,
    );
  });

  it('remove throws NotFoundException when category does not exist', async () => {
    categoryRepository.findOne = vi.fn(async () => null);

    await expect(service.remove('missing', 'w1', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('createSystemCategories skips a default the workspace already has under its key', async () => {
    categoryRepository.findOne = vi.fn(async ({ where }: any) =>
      where?.systemKey === 'sales' ? ({ id: 'exists', systemKey: 'sales' } as any) : null,
    );

    await service.createSystemCategories('w1');

    expect(categoryRepository.save).toHaveBeenCalled();
    expect(categoryRepository.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sales' }),
    );
  });

  it('createSystemCategories gives the role to a same-named category instead of a twin', async () => {
    categoryRepository.update = vi.fn(async () => ({ affected: 1 }));
    categoryRepository.findOne = vi.fn(async ({ where }: any) =>
      where?.name === 'Groceries' ? ({ id: 'own-groceries', systemKey: null } as any) : null,
    );

    await service.createSystemCategories('w1');

    expect(categoryRepository.update).toHaveBeenCalledWith(
      { id: 'own-groceries', workspaceId: 'w1' },
      { systemKey: 'groceries' },
    );
    expect(categoryRepository.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Groceries' }),
    );
  });

  it('createSystemCategories seeds English default names under their keys', async () => {
    categoryRepository.findOne = vi.fn(async () => null);

    await service.createSystemCategories('w1');

    expect(categoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sales', systemKey: 'sales', isSystem: true }),
    );
    expect(categoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Transfers to people', systemKey: 'transfers_people' }),
    );
  });

  it('allows toggling isEnabled for system categories', async () => {
    categoryRepository.findOne = vi.fn(async () => ({
      id: 'c1',
      workspaceId: 'w1',
      userId: 'u1',
      name: 'Advertising',
      type: CategoryType.EXPENSE,
      isSystem: true,
      isEnabled: true,
    }));
    categoryRepository.save = vi.fn(async (category: any) => category);

    const result = await service.update('c1', 'w1', 'u1', { isEnabled: false } as any);

    expect(result.isEnabled).toBe(false);
    expect(categoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ isEnabled: false }),
    );
  });

  it('does not fail update when audit event creation throws', async () => {
    const relationHeavyCategory = {
      id: 'c1',
      workspaceId: 'w1',
      userId: 'u1',
      name: 'Advertising',
      type: CategoryType.EXPENSE,
      isSystem: false,
      isEnabled: true,
      parentId: null,
      parent: null,
      children: [],
      color: null,
      icon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    categoryRepository.findOne = vi.fn(async () => relationHeavyCategory as any);
    categoryRepository.save = vi.fn(async (category: any) => ({ ...category, isEnabled: false }));
    (auditService.createEvent as Mock).mockRejectedValueOnce(new Error('Circular JSON'));

    await expect(service.update('c1', 'w1', 'u1', { isEnabled: false } as any)).resolves.toEqual(
      expect.objectContaining({ isEnabled: false }),
    );
  });

  it('returns usage count for category in workspace', async () => {
    (transactionRepository as any).createQueryBuilder = vi.fn(() => ({
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(15),
    }));
    statementRepository.count = vi.fn().mockResolvedValue(3);

    await expect(service.getCategoryUsageCount('c1', 'w1')).resolves.toEqual({
      transactions: 15,
      statements: 3,
      total: 18,
    });
  });

  it('denies non-toggle updates for system categories', async () => {
    categoryRepository.findOne = vi.fn(async () => ({
      id: 'c1',
      workspaceId: 'w1',
      userId: 'u1',
      name: 'Advertising',
      type: CategoryType.EXPENSE,
      isSystem: true,
      isEnabled: true,
    }));

    await expect(service.update('c1', 'w1', 'u1', { name: 'Changed' } as any)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('denies create when member has canEditCategories=false', async () => {
    workspaceMemberRepository.findOne = vi.fn(async () => ({
      role: WorkspaceRole.MEMBER,
      permissions: { canEditCategories: false },
    }));

    await expect(
      service.create('w1', 'u1', { name: 'Food', type: CategoryType.EXPENSE } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
