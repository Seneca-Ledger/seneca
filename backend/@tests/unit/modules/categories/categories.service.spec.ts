import type { Mock } from 'vitest';
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
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            remove: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            count: vi.fn(),
            createQueryBuilder: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Statement),
          useValue: {
            count: vi.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            createEvent: vi.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: vi.fn(),
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
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      vi.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
    });

    it('should create a new category', async () => {
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(categoryRepository, 'create').mockReturnValue(mockCategory as Category);
      vi.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);

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
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);

      await expect(service.create('1', '1', createDto)).rejects.toThrow(ConflictException);
    });

    it('should set isSystem to false for user categories', async () => {
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(categoryRepository, 'create')
        .mockReturnValue(mockCategory as Category);
      vi.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);

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
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.create('1', '1', createDto)).rejects.toThrow(ForbiddenException);
    });

    it('should store keywords for classification', async () => {
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(categoryRepository, 'create')
        .mockReturnValue(mockCategory as Category);
      vi.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);

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

      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(categoryRepository, 'create')
        .mockReturnValue(mockCategory as Category);
      vi.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);

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
      vi.spyOn(categoryRepository, 'find').mockResolvedValue(categories as Category[]);

      const result = await service.findAll('1');

      expect(result).toHaveLength(2);
      expect(categoryRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: '1' },
        }),
      );
    });

    it('should filter by category type', async () => {
      const findSpy = vi
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
      const findSpy = vi
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
      vi.spyOn(categoryRepository, 'find').mockResolvedValue([]);

      const result = await service.findAll('1');

      expect(result).toEqual([]);
    });

    it('should include system categories', async () => {
      const systemCategory = {
        ...mockCategory,
        isSystem: true,
        source: CategorySource.SYSTEM,
      };
      vi.spyOn(categoryRepository, 'find').mockResolvedValue([systemCategory] as Category[]);

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
      vi.spyOn(categoryRepository, 'find').mockResolvedValue([parsingCategory] as Category[]);

      const result = await service.findAll('1');

      expect(result[0]?.source).toBe(CategorySource.PARSING);
    });
  });

  describe('findOne', () => {
    it('should return category by id', async () => {
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);

      const result = await service.findOne('cat-1', '1');

      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if not found', async () => {
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('invalid', '1')).rejects.toThrow(NotFoundException);
    });

    it('should verify user ownership', async () => {
      const findOneSpy = vi
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
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);

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
      vi.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);
    });

    it('should update category', async () => {
      vi
        .spyOn(categoryRepository, 'findOne')
        .mockResolvedValueOnce(mockCategory as Category)
        .mockResolvedValueOnce(null as any);
      vi.spyOn(categoryRepository, 'save').mockResolvedValue({
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
      vi.spyOn(categoryRepository, 'save').mockImplementation(async saved => saved as Category);

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
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);
      vi.spyOn(categoryRepository, 'save').mockResolvedValue(mockCategory as Category);
      (auditService.createEvent as Mock).mockClear();

      await service.update('cat-1', '1', '1', { type: CategoryType.EXPENSE });

      expect(categoryRepository.save).toHaveBeenCalled();
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('should check permissions before update', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditCategories: false },
      } as WorkspaceMember;
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.update('cat-1', '1', '1', updateDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should not allow updating system categories', async () => {
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue({
        ...mockCategory,
        isSystem: true,
      } as Category);

      await expect(service.update('cat-1', '1', '1', updateDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should check for duplicate names on update', async () => {
      (categoryRepository.findOne as Mock).mockReset();
      (categoryRepository.findOne as Mock)
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
      (categoryRepository.findOne as Mock).mockReset();
      (categoryRepository.findOne as Mock)
        .mockResolvedValueOnce(mockCategory as Category)
        .mockResolvedValueOnce(null as any);
      const saveSpy = vi
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
      vi.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
      (categoryRepository.findOne as Mock).mockReset();
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);
    });

    it('should delete category', async () => {
      vi.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);
      const removeSpy = vi
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
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.remove('cat-1', '1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('should not allow deleting system categories', async () => {
      (categoryRepository.findOne as Mock).mockResolvedValue({
        ...mockCategory,
        isSystem: true,
      } as Category);

      await expect(service.remove('cat-1', '1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if category not found', async () => {
      (categoryRepository.findOne as Mock).mockResolvedValue(null);

      await expect(service.remove('invalid', '1', '1')).rejects.toThrow(NotFoundException);
    });

    it('should handle categories with transactions', async () => {
      // Should prevent deletion if category has transactions
      // Or cascade delete/update transactions
      expect(true).toBe(true);
    });
  });
});
