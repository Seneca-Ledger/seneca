import type { Mock } from 'vitest';
import { FileStorageService } from '@/common/services/file-storage.service';
import {
  Category,
  FilePermission,
  FilePermissionType,
  FileVersion,
  Folder,
  ShareLinkStatus,
  SharePermissionLevel,
  SharedLink,
  Statement,
  StorageView,
  Tag,
  Transaction,
  User,
  WorkspaceMember,
  WorkspaceRole,
} from '@/entities';
import { MetricsService } from '@/modules/observability/metrics.service';
import { StatementsService } from '@/modules/statements/statements.service';
import { StorageService } from '@/modules/storage/storage.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { CreateSharedLinkBody } from '../../../../src/contracts';

describe('StorageService', () => {
  let testingModule: TestingModule;
  let service: StorageService;
  let sharedLinkRepository: Repository<SharedLink>;
  let filePermissionRepository: Repository<FilePermission>;
  let statementRepository: Repository<Statement>;
  let userRepository: Repository<User>;
  let workspaceMemberRepository: Repository<WorkspaceMember>;
  let fileStorageService: FileStorageService;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    workspaceId: 'ws-1',
  };

  const mockStatement: Partial<Statement> = {
    id: 'stmt-1',
    userId: '1',
    fileName: 'statement.pdf',
  };

  const mockSharedLink: Partial<SharedLink> = {
    id: 'link-1',
    token: 'abc123',
    statementId: 'stmt-1',
    userId: '1',
    permission: SharePermissionLevel.VIEW,
    status: ShareLinkStatus.ACTIVE,
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: getRepositoryToken(SharedLink),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(FilePermission),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
            remove: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Statement),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            createQueryBuilder: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(FileVersion),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(StorageView),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Folder),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tag),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
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
            find: vi.fn(),
            findOne: vi.fn(),
            createQueryBuilder: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            createQueryBuilder: vi.fn(),
          },
        },
        {
          provide: FileStorageService,
          useValue: {
            getFileAvailability: vi.fn().mockResolvedValue({
              onDisk: true,
              inDb: false,
              status: 'disk',
            }),
            getFileUrl: vi.fn(),
          },
        },
        {
          provide: StatementsService,
          useValue: {
            remove: vi.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            observeStorageRead: vi.fn(),
            observeStorageWrite: vi.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<StorageService>(StorageService);
    sharedLinkRepository = testingModule.get<Repository<SharedLink>>(
      getRepositoryToken(SharedLink),
    );
    filePermissionRepository = testingModule.get<Repository<FilePermission>>(
      getRepositoryToken(FilePermission),
    );
    statementRepository = testingModule.get<Repository<Statement>>(getRepositoryToken(Statement));
    userRepository = testingModule.get<Repository<User>>(getRepositoryToken(User));
    workspaceMemberRepository = testingModule.get<Repository<WorkspaceMember>>(
      getRepositoryToken(WorkspaceMember),
    );
    fileStorageService = testingModule.get<FileStorageService>(FileStorageService);
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

  describe('getStorageFiles', () => {
    beforeEach(() => {
      vi.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      vi.spyOn(filePermissionRepository, 'find').mockResolvedValue([]);

      const mockQueryBuilder = {
        createQueryBuilder: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        distinct: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockStatement]),
      };

      vi
        .spyOn(statementRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);
    });

    it('should return all files for user', async () => {
      const result = await service.getStorageFiles('1', 'ws-open');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('lists the files of the workspace the caller has open', async () => {
      await service.getStorageFiles('1', 'ws-open');

      const queryBuilder = (statementRepository.createQueryBuilder as Mock).mock.results[0]
        .value;
      expect(queryBuilder.where).toHaveBeenCalledWith('statement.workspaceId = :workspaceId', {
        workspaceId: 'ws-open',
      });
    });

    it('leaves out files shared from other workspaces', async () => {
      vi.spyOn(filePermissionRepository, 'find').mockResolvedValue([
        { statement: { ...mockStatement, id: 'elsewhere', workspaceId: 'ws-other' } },
      ] as any);

      const result = await service.getStorageFiles('1', 'ws-open');

      expect(result.map(file => file.id)).not.toContain('elsewhere');
    });

    it('should include file metadata', async () => {
      vi.spyOn(fileStorageService, 'getFileAvailability').mockResolvedValue({
        onDisk: true,
        inDb: true,
        status: 'both',
      });

      const result = await service.getStorageFiles('1', 'ws-open');

      expect(result).toBeDefined();
    });
  });

  describe('accessSharedLink', () => {
    it('rejects public access when allowAnonymous is false', async () => {
      vi.spyOn(sharedLinkRepository, 'findOne').mockResolvedValue({
        ...mockSharedLink,
        allowAnonymous: false,
        status: ShareLinkStatus.ACTIVE,
      } as SharedLink);

      await expect(service.accessSharedLink('abc123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createSharedLink', () => {
    const createDto: CreateSharedLinkBody = {
      permission: SharePermissionLevel.VIEW,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    beforeEach(() => {
      vi.spyOn(statementRepository, 'findOne').mockResolvedValue(mockStatement as Statement);
      // The uploader shares from inside the workspace.
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.OWNER,
        permissions: null,
      } as WorkspaceMember);
    });

    it('refuses the uploader once they have left the workspace', async () => {
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(filePermissionRepository, 'findOne').mockResolvedValue(null);
      const saveSpy = vi.spyOn(sharedLinkRepository, 'save');

      await expect(service.createSharedLink('1', '1', createDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should create shared link', async () => {
      vi.spyOn(sharedLinkRepository, 'create').mockReturnValue(mockSharedLink as SharedLink);
      vi.spyOn(sharedLinkRepository, 'save').mockResolvedValue(mockSharedLink as SharedLink);

      const result = await service.createSharedLink('1', '1', createDto);

      expect(result).toEqual(mockSharedLink);
      expect(sharedLinkRepository.save).toHaveBeenCalled();
    });

    it('should generate unique token', async () => {
      const createSpy = vi
        .spyOn(sharedLinkRepository, 'create')
        .mockReturnValue(mockSharedLink as SharedLink);
      vi.spyOn(sharedLinkRepository, 'save').mockResolvedValue(mockSharedLink as SharedLink);

      await service.createSharedLink('1', '1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
        }),
      );
    });

    it('should set expiration date', async () => {
      const createSpy = vi
        .spyOn(sharedLinkRepository, 'create')
        .mockReturnValue(mockSharedLink as SharedLink);
      vi.spyOn(sharedLinkRepository, 'save').mockResolvedValue(mockSharedLink as SharedLink);

      await service.createSharedLink('1', '1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('should verify resource ownership', async () => {
      vi.spyOn(statementRepository, 'findOne').mockResolvedValue(null);

      await expect(service.createSharedLink('1', '1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow password protection', async () => {
      const dtoWithPassword = {
        ...createDto,
        password: 'secret123',
      };

      vi.spyOn(sharedLinkRepository, 'create').mockReturnValue(mockSharedLink as SharedLink);
      vi.spyOn(sharedLinkRepository, 'save').mockResolvedValue(mockSharedLink as SharedLink);

      await service.createSharedLink('1', '1', dtoWithPassword);

      expect(sharedLinkRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: expect.any(String),
        }),
      );
    });
  });

  describe('grantPermission', () => {
    const grantDto = {
      resourceType: 'statement' as const,
      resourceId: 'stmt-1',
      userId: '2',
      permissionType: FilePermissionType.VIEWER,
    };

    beforeEach(() => {
      vi.spyOn(statementRepository, 'findOne').mockResolvedValue(mockStatement as Statement);
      vi.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: '2',
      } as User);
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        userId: '2',
        workspaceId: mockStatement.workspaceId,
      } as WorkspaceMember);
      vi.spyOn(service as any, 'checkFileAccess').mockResolvedValue(undefined);
    });

    it('refuses to share with a user outside the file\'s workspace', async () => {
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(null);
      const saveSpy = vi.spyOn(filePermissionRepository, 'save');

      await expect(service.grantPermission('1', '1', grantDto)).rejects.toThrow(
        'User not found in this workspace',
      );
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should grant permission to user', async () => {
      vi.spyOn(filePermissionRepository, 'create').mockReturnValue({} as FilePermission);
      vi.spyOn(filePermissionRepository, 'save').mockResolvedValue({} as FilePermission);

      await service.grantPermission('1', '1', grantDto);

      expect(filePermissionRepository.save).toHaveBeenCalled();
    });

    it('shares with a member found by the email they sign in with', async () => {
      const findMember = vi.spyOn(workspaceMemberRepository, 'findOne');
      vi.spyOn(filePermissionRepository, 'create').mockImplementation(value => value as FilePermission);
      const saveSpy = vi
        .spyOn(filePermissionRepository, 'save')
        .mockImplementation(async value => value as FilePermission);

      await service.grantPermission('1', '1', { ...grantDto, userId: ' Member@Example.com ' });

      expect(findMember).toHaveBeenCalledWith({
        where: { workspaceId: mockStatement.workspaceId, user: { email: 'member@example.com' } },
      });
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: '2' }));
    });

    it('should verify resource ownership', async () => {
      (service as any).checkFileAccess.mockRejectedValue(new NotFoundException('File not found'));

      await expect(service.grantPermission('1', '1', grantDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle duplicate permissions', async () => {
      vi.spyOn(filePermissionRepository, 'findOne').mockResolvedValue({
        id: 'perm-1',
      } as FilePermission);

      await expect(service.grantPermission('1', '1', grantDto)).rejects.toThrow();
    });
  });

  describe('revokePermission', () => {
    beforeEach(() => {
      vi.spyOn(filePermissionRepository, 'findOne').mockResolvedValue({
        id: 'perm-1',
        grantedById: '1',
        userId: '2',
      } as FilePermission);
      vi.spyOn(service as any, 'checkFileAccess').mockResolvedValue(undefined);
    });

    it('should revoke permission', async () => {
      const removeSpy = vi.spyOn(filePermissionRepository, 'remove').mockResolvedValue({} as any);

      await service.revokePermission('perm-1', '1');

      expect(removeSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'perm-1' }));
    });

    it('should verify permission ownership', async () => {
      vi.spyOn(filePermissionRepository, 'findOne').mockResolvedValue({
        id: 'perm-1',
        grantedById: '999',
      } as FilePermission);
      (service as any).checkFileAccess.mockRejectedValue(new ForbiddenException(''));

      await expect(service.revokePermission('perm-1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw if permission not found', async () => {
      vi.spyOn(filePermissionRepository, 'findOne').mockResolvedValue(null);

      await expect(service.revokePermission('invalid', '1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('workspace-scoped tags and views', () => {
    it('lists tags only for current workspace', async () => {
      const tagRepository = testingModule.get(getRepositoryToken(Tag));
      vi.spyOn(tagRepository, 'find').mockResolvedValue([{ id: 'tag-1' }] as Tag[]);

      const result = await service.listTags('ws-1');

      expect(result).toEqual([{ id: 'tag-1' }]);
      expect(tagRepository.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        order: { name: 'ASC' },
      });
    });

    it('creates tags and views inside current workspace', async () => {
      const tagRepository = testingModule.get(getRepositoryToken(Tag));
      const viewRepository = testingModule.get(getRepositoryToken(StorageView));
      vi.spyOn(tagRepository, 'create').mockImplementation(data => data as Tag);
      vi
        .spyOn(tagRepository, 'save')
        .mockResolvedValue({ id: 'tag-1', workspaceId: 'ws-1' } as Tag);
      vi.spyOn(viewRepository, 'create').mockImplementation(data => data as StorageView);
      vi.spyOn(viewRepository, 'save').mockResolvedValue({
        id: 'view-1',
        workspaceId: 'ws-1',
      } as StorageView);

      await service.createTag({ name: 'A' } as any, 'ws-1');
      await service.createView({ name: 'View', filters: {} } as any, 'user-1', 'ws-1');

      expect(tagRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1' }),
      );
      // user_id is NOT NULL: a view without its author never saved.
      expect(viewRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', workspaceId: 'ws-1' }),
      );
    });
  });
});
