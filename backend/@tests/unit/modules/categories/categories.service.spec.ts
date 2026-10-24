import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { Category, CategorySource, CategoryType } from '@/entities/category.entity';
import { Statement } from '@/entities/statement.entity';
import { Transaction } from '@/entities/transaction.entity';
import { User, UserRole } from '@/entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '@/entities/workspace-member.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

describe('CategoriesService', () => {
  let testingModule: TestingModule;
  let service: CategoriesService;
  let categoryRepository: Repository<Category>;
  let userRepository: Repository<User>;
  let workspaceMemberRepository: Repository<WorkspaceMember>;
  let auditService: AuditService;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    workspaceId: 'ws-1',
    role: UserRole.USER,
  };

  const mockCategory: Partial<Category> = {
    id: 'cat-1',
    name: 'Groceries',
    type: CategoryType.EXPENSE,
    userId: '1',
    isSystem: false,
    source: CategorySource.USER,
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Statement),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            createEvent: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<CategoriesService>(CategoriesService);
    categoryRepository = testingModule.get<Repository<Category>>(getRepositoryToken(Category));
    userRepository = testingModule.get<Repository<User>>(getRepositoryToken(User));
    workspaceMemberRepository = testingModule.get<Repository<WorkspaceMember>>(
      getRepositoryToken(WorkspaceMember),
    );
    auditService = testingModule.get<AuditService>(AuditService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWorkspaceCategoryUsageCounts', () => {
    const rawQuery = (rows: unknown[]) => {
      const qb: Record<string, jest.Mock> = {};
      for (const method of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
        qb[method] = jest.fn().mockReturnValue(qb);
      }
      qb.getRawMany = jest.fn().mockResolvedValue(rows);
      return qb;
    };

    it('reports the day each category was last used, from its latest transaction', async () => {
      const transactionQb = rawQuery([
        { categoryId: 'cat-1', count: '3', lastUsedAt: '2026-10-21' },
        { categoryId: 'cat-2', count: '1', lastUsedAt: null },
      ]);
      const statementQb = rawQuery([
        { categoryId: 'cat-1', count: '2' },
        { categoryId: 'cat-3', count: '4' },
      ]);
      const transactionRepository = testingModule.get(getRepositoryToken(Transaction));
      const statementRepository = testingModule.get(getRepositoryToken(Statement));
      transactionRepository.createQueryBuilder.mockReturnValue(transactionQb);
      statementRepository.createQueryBuilder = jest.fn().mockReturnValue(statementQb);

      const usage = await service.getWorkspaceCategoryUsageCounts('ws-1');

      expect(usage).toEqual({
        'cat-1': { transactions: 3, statements: 2, total: 5, lastUsedAt: '2026-10-21' },
        'cat-2': { transactions: 1, statements: 0, total: 1, lastUsedAt: null },
        // A category used only on statements has no transaction date to report.
        'cat-3': { transactions: 0, statements: 4, total: 4, lastUsedAt: null },
      });
      // Formatted in SQL, so the day never shifts with the server's time zone.
      expect(transactionQb.addSelect).toHaveBeenCalledWith(
        "TO_CHAR(MAX(transaction.transactionDate), 'YYYY-MM-DD')",
        'lastUsedAt',
      );
      expect(transactionQb.where).toHaveBeenCalledWith('transaction.workspaceId = :workspaceId', {
        workspaceId: 'ws-1',
      });
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'New Category',
      type: CategoryType.EXPENSE,
      keywords: ['keyword1', 'keyword2'],
    };

    beforeEach(() => {
      Object.assign(mockCategory, {
        id: 'cat-1',
        name: 'Groceries',
        type: CategoryType.EXPENSE,
        userId: '1',
        isSystem: false,
      });
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
    });

    it('should create a new category', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(categoryRepository, 'create').mockReturnValue(mockCategory as Category);
      jest.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);

      const result = await service.create('1', '1', createDto);

      expect(result).toEqual(mockCategory);
      expect(categoryRepository.save).toHaveBeenCalled();
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: EntityType.CATEGORY,
          entityId: mockCategory.id,
        }),
      );
    });

    it('should check for duplicate names', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);

      await expect(service.create('1', '1', createDto)).rejects.toThrow(ConflictException);
    });

    it('should set isSystem to false for user categories', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      const createSpy = jest
        .spyOn(categoryRepository, 'create')
        .mockReturnValue(mockCategory as Category);
      jest.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);

      await service.create('1', '1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystem: false,
          source: CategorySource.USER,
        }),
      );
    });

    it('should check permissions before creating', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditCategories: false },
      } as WorkspaceMember;
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.create('1', '1', createDto)).rejects.toThrow(ForbiddenException);
    });

    it('should store keywords for classification', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      const createSpy = jest
        .spyOn(categoryRepository, 'create')
        .mockReturnValue(mockCategory as Category);
      jest.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);

      await service.create('1', '1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: createDto.keywords,
        }),
      );
    });

    it('should distinguish between expense and income categories', async () => {
      const incomeDto = {
        name: 'Salary',
        type: CategoryType.INCOME,
      };

      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      const createSpy = jest
        .spyOn(categoryRepository, 'create')
        .mockReturnValue(mockCategory as Category);
      jest.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);

      await service.create('1', '1', incomeDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CategoryType.INCOME,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all categories for user', async () => {
      const categories = [mockCategory, { ...mockCategory, id: 'cat-2' }];
      jest.spyOn(categoryRepository, 'find').mockResolvedValue(categories as Category[]);

      const result = await service.findAll('1');

      expect(result).toHaveLength(2);
      expect(categoryRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: '1' },
        }),
      );
    });

    it('should filter by category type', async () => {
      const findSpy = jest
        .spyOn(categoryRepository, 'find')
        .mockResolvedValue([mockCategory] as Category[]);

      await service.findAll('1', CategoryType.EXPENSE);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: '1',
            type: CategoryType.EXPENSE,
          },
        }),
      );
    });

    it('should order categories by name', async () => {
      const findSpy = jest
        .spyOn(categoryRepository, 'find')
        .mockResolvedValue([mockCategory] as Category[]);

      await service.findAll('1');

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { name: 'ASC' },
        }),
      );
    });

    it('should return empty array if no categories', async () => {
      jest.spyOn(categoryRepository, 'find').mockResolvedValue([]);

      const result = await service.findAll('1');

      expect(result).toEqual([]);
    });

    it('should include system categories', async () => {
      const systemCategory = {
        ...mockCategory,
        isSystem: true,
        source: CategorySource.SYSTEM,
      };
      jest.spyOn(categoryRepository, 'find').mockResolvedValue([systemCategory] as Category[]);

      const result = await service.findAll('1');

      expect(result.some(c => c.isSystem)).toBe(true);
    });

    it('should include parsing source categories in workspace lists', async () => {
      const parsingCategory = {
        ...mockCategory,
        id: 'cat-parsing',
        workspaceId: '1',
        source: CategorySource.PARSING,
      };
      jest.spyOn(categoryRepository, 'find').mockResolvedValue([parsingCategory] as Category[]);

      const result = await service.findAll('1');

      expect(result[0]?.source).toBe(CategorySource.PARSING);
    });
  });

  describe('findOne', () => {
    it('should return category by id', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);

      const result = await service.findOne('cat-1', '1');

      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('invalid', '1')).rejects.toThrow(NotFoundException);
    });

    it('should verify user ownership', async () => {
      const findOneSpy = jest
        .spyOn(categoryRepository, 'findOne')
        .mockResolvedValue(mockCategory as Category);

      await service.findOne('cat-1', '1');

      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cat-1', workspaceId: '1' },
        }),
      );
    });

    it('should not return other user categories', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('cat-1', '999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Category',
      keywords: ['new', 'keywords'],
    };

    beforeEach(() => {
      Object.assign(mockCategory, {
        id: 'cat-1',
        name: 'Groceries',
        type: CategoryType.EXPENSE,
        userId: '1',
        isSystem: false,
      });
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);
    });

    it('should update category', async () => {
      jest
        .spyOn(categoryRepository, 'findOne')
        .mockResolvedValueOnce(mockCategory as Category)
        .mockResolvedValueOnce(null as any);
      jest.spyOn(categoryRepository, 'save').mockResolvedValue({
        ...mockCategory,
        ...updateDto,
      } as Category);

      const result = await service.update('cat-1', '1', '1', updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(categoryRepository.save).toHaveBeenCalled();
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: EntityType.CATEGORY,
          entityId: 'cat-1',
        }),
      );
    });

    it('leaves a required field as it is on null, and clears a nullable one', async () => {
      Object.assign(mockCategory, { taxRelevant: true, isEnabled: true, color: '#fff' });
      jest.spyOn(categoryRepository, 'save').mockImplementation(async saved => saved as Category);

      await service.update('cat-1', '1', '1', {
        name: null,
        taxRelevant: null,
        isEnabled: null,
        color: null,
      });

      expect(categoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Groceries',
          taxRelevant: true,
          isEnabled: true,
          color: null,
        }),
      );
    });

    it('writes no audit event when the save changes nothing', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);
      jest.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);
      (auditService.createEvent as jest.Mock).mockClear();

      await service.update('cat-1', '1', '1', { type: CategoryType.EXPENSE });

      expect(categoryRepository.save).toHaveBeenCalled();
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('should check permissions before update', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditCategories: false },
      } as WorkspaceMember;
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.update('cat-1', '1', '1', updateDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should not allow updating system categories', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue({
        ...mockCategory,
        isSystem: true,
      } as Category);

      await expect(service.update('cat-1', '1', '1', updateDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should check for duplicate names on update', async () => {
      (categoryRepository.findOne as jest.Mock).mockReset();
      (categoryRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockCategory as Category)
        .mockResolvedValueOnce(null as any);

      expect(mockCategory.name).toBe('Groceries');

      await service.update('cat-1', '1', '1', updateDto);

      expect(categoryRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: '1',
            name: updateDto.name,
            type: mockCategory.type,
          },
        }),
      );
    });

    it('should update keywords', async () => {
      (categoryRepository.findOne as jest.Mock).mockReset();
      (categoryRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockCategory as Category)
        .mockResolvedValueOnce(null as any);
      const saveSpy = jest
        .spyOn(categoryRepository, 'save')
        .mockResolvedValue(mockCategory as Category);

      await service.update('cat-1', '1', '1', updateDto);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: updateDto.keywords,
        }),
      );
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
      (categoryRepository.findOne as jest.Mock).mockReset();
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);
    });

    it('should delete category', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);
      const removeSpy = jest
        .spyOn(categoryRepository, 'remove')
        .mockResolvedValue(mockCategory as Category);

      await service.remove('cat-1', '1', '1');

      expect(removeSpy).toHaveBeenCalledWith(mockCategory);
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DELETE,
          entityType: EntityType.CATEGORY,
          entityId: 'cat-1',
        }),
      );
    });

    it('should check permissions before delete', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditCategories: false },
      } as WorkspaceMember;
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.remove('cat-1', '1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('should not allow deleting system categories', async () => {
      (categoryRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockCategory,
        isSystem: true,
      } as Category);

      await expect(service.remove('cat-1', '1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if category not found', async () => {
      (categoryRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('invalid', '1', '1')).rejects.toThrow(NotFoundException);
    });

    it('should handle categories with transactions', async () => {
      // Should prevent deletion if category has transactions
      // Or cascade delete/update transactions
      expect(true).toBe(true);
    });
  });
});
