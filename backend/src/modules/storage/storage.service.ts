import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { In, IsNull, type Repository } from 'typeorm';
import { workspaceMemberCanEdit } from '../../common/authz/workspace-permissions';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { hashPassword } from '../../common/utils/password-hash.util';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';
import {
  Category,
  FilePermission,
  FilePermissionType,
  FileVersion,
  Folder,
  SharedLink,
  ShareLinkStatus,
  SharePermissionLevel,
  Statement,
  StorageView,
  Tag,
  Transaction,
  WorkspaceMember,
  WorkspaceRole,
} from '../../entities';
import { MetricsService } from '../observability/metrics.service';
import { StatementsService } from '../statements/statements.service';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { CreateSharedLinkDto } from './dto/create-shared-link.dto';
import type { CreateTagDto } from './dto/create-tag.dto';
import type { GrantPermissionDto } from './dto/grant-permission.dto';
import type { StorageViewDto } from './dto/storage-view.dto';
import type { UpdateFolderDto } from './dto/update-folder.dto';
import type { UpdatePermissionDto } from './dto/update-permission.dto';
import type { UpdateSharedLinkDto } from './dto/update-shared-link.dto';
import type { UpdateTagDto } from './dto/update-tag.dto';
import type { StorageViewFilters } from './interfaces/storage-view-filters.interface';
import { buildStorageCategoryWhere } from './storage-category-scope.util';

type FileAvailability = {
  onDisk: boolean;
  inDb: boolean;
  status: 'disk' | 'db' | 'both' | 'missing' | 'unknown';
};

type StorageStatement = Statement & {
  isOwner: boolean;
  permissionType: FilePermissionType | null | undefined;
  canReshare: boolean;
  sharedLinksCount: number;
  fileAvailability: FileAvailability;
  hasFileOnDisk: boolean;
  hasFileInDb: boolean;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Storage service for managing file storage, sharing, and permissions
 */
@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(SharedLink)
    private readonly sharedLinkRepository: Repository<SharedLink>,
    @InjectRepository(FilePermission)
    private readonly filePermissionRepository: Repository<FilePermission>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(FileVersion)
    private readonly fileVersionRepository: Repository<FileVersion>,
    @InjectRepository(StorageView)
    private readonly storageViewRepository: Repository<StorageView>,
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly fileStorageService: FileStorageService,
    private readonly statementsService: StatementsService,
    @Optional()
    @InjectRepository(Transaction)
    private readonly transactionRepository?: Repository<Transaction>,
    @Optional()
    @InjectRepository(Category)
    private readonly categoryRepository?: Repository<Category>,
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  /** The caller's membership in a file's own workspace, the anchor for access to it. */
  private findMembership(workspaceId: string, userId: string) {
    return this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
      select: ['role', 'permissions'],
    });
  }

  /**
   * Get all files (statements) of the current workspace
   */
  async getStorageFiles(userId: string, workspaceId: string, filters?: StorageViewFilters) {
    try {
      // Scoped on the workspace the caller has open (the request header), not on
      // the user's own `workspaceId`: that is only the workspace they registered
      // with, so it showed the same files in every workspace they switched to.
      const ownedStatements = await this.statementRepository
        .createQueryBuilder('statement')
        .leftJoinAndSelect('statement.category', 'category')
        .leftJoinAndSelect('statement.user', 'owner')
        .leftJoinAndSelect('statement.folder', 'folder')
        .leftJoinAndSelect('statement.tags', 'tags')
        .where('statement.workspaceId = :workspaceId', { workspaceId })
        .orderBy('statement.createdAt', 'DESC')
        .distinct(true)
        .getMany();

      // Get all statements shared with user (if permissions table exists)
      let sharedPermissions = [];
      try {
        sharedPermissions = await this.filePermissionRepository.find({
          where: {
            userId,
            isActive: true,
          },
          relations: [
            'statement',
            'statement.category',
            'statement.user',
            'statement.folder',
            'statement.tags',
          ],
        });
      } catch (error) {
        // If permissions table doesn't exist yet, just use empty array
        console.warn('File permissions table may not exist yet:', getErrorMessage(error));
      }

      // A file is only ever shared with members of its own workspace, so the
      // ones from other workspaces belong to those workspaces' lists.
      const sharedStatements = sharedPermissions
        .map(perm => perm.statement)
        .filter(stmt => stmt !== null && stmt.workspaceId === workspaceId);

      // Combine and deduplicate
      const allStatements = [...ownedStatements];
      const ownedIds = new Set(ownedStatements.map(s => s.id));

      for (const sharedStmt of sharedStatements) {
        if (!ownedIds.has(sharedStmt.id)) {
          allStatements.push(sharedStmt);
        }
      }

      // Enrich with permissions info
      const workspaceRole = await this.findMembership(workspaceId, userId);

      const statementsWithFileData = this.fileStorageService.getStatementsWithFileData
        ? await this.fileStorageService.getStatementsWithFileData(allStatements.map(s => s.id))
        : new Set<string>();

      const enrichedStatements = await Promise.all(
        allStatements.map(async statement => {
          const isOwner = statement.userId === userId;
          const isWorkspacePeer = statement.workspaceId === workspaceId;
          let permission = null;
          let sharedLinks = 0;

          try {
            permission = await this.getUserPermissionForStatement(userId, statement.id);
            sharedLinks = await this.sharedLinkRepository.count({
              where: { statementId: statement.id },
            });
          } catch (error) {
            console.warn('Storage tables may not exist yet:', getErrorMessage(error));
          }

          const permissionType = isOwner
            ? FilePermissionType.OWNER
            : isWorkspacePeer
              ? FilePermissionType.VIEWER
              : permission?.permissionType;

          const canReshare =
            isOwner ||
            (isWorkspacePeer &&
              workspaceRole &&
              [WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(workspaceRole.role)) ||
            permission?.canReshare;

          const fileAvailability = this.fileStorageService.buildAvailability
            ? this.fileStorageService.buildAvailability(
                this.fileStorageService.isOnDisk(statement.filePath),
                statementsWithFileData.has(statement.id),
              )
            : this.fileStorageService.getFileAvailability
              ? await this.fileStorageService.getFileAvailability({
                  id: statement.id,
                  filePath: statement.filePath,
                })
              : { onDisk: false, inDb: false, status: 'unknown' };

          return {
            ...statement,
            isOwner,
            permissionType,
            canReshare,
            sharedLinksCount: sharedLinks,
            fileAvailability,
            hasFileOnDisk: fileAvailability.onDisk,
            hasFileInDb: fileAvailability.inDb,
          };
        }),
      );

      let filtered = enrichedStatements;
      const deletedFilter = filters?.deleted ?? 'exclude';
      if (deletedFilter === 'only') {
        filtered = filtered.filter(s => Boolean(s.deletedAt));
      } else if (deletedFilter !== 'include') {
        filtered = filtered.filter(s => !s.deletedAt);
      }

      if (filters?.scope === 'mine') {
        filtered = filtered.filter(s => s.userId === userId);
      } else if (filters?.scope === 'shared') {
        filtered = filtered.filter(s => s.userId !== userId);
      }

      if (filters?.bankName) {
        filtered = filtered.filter(s => s.bankName && s.bankName === filters.bankName);
      }

      if (filters?.folderId !== undefined) {
        filtered = filtered.filter(s => (s.folderId || null) === (filters.folderId || null));
      }

      if (filters?.availability) {
        filtered = filtered.filter(s => {
          const status = s.fileAvailability?.status || s.fileAvailability;
          if (filters.availability === 'both') {
            return status === 'both';
          }
          return status === filters.availability;
        });
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(
          s =>
            (s.fileName || '').toLowerCase().includes(q) ||
            (s.accountNumber || '').toLowerCase().includes(q),
        );
      }

      if (filters?.tagIds?.length) {
        const tagSet = new Set(filters.tagIds);
        filtered = filtered.filter(
          s => Array.isArray(s.tags) && s.tags.some((t: Tag) => t && tagSet.has(t.id)),
        );
      }

      return filtered;
    } catch (error) {
      console.error('Error in getStorageFiles:', error);
      throw error;
    }
  }

  /**
   * Get file details with transactions
   */
  async getFileDetails(statementId: string, userId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: ['category', 'user', 'folder', 'tags'],
    });

    if (!statement) {
      throw new NotFoundException('File not found');
    }

    // Check if user has access
    await this.checkFileAccess(userId, statementId, 'view');

    // Get transactions
    const transactions = await this.transactionRepository.find({
      where: { statementId },
      order: { transactionDate: 'DESC' },
      relations: ['category', 'branch', 'wallet'],
    });

    // Get shared links
    const sharedLinks = await this.sharedLinkRepository.find({
      where: { statementId },
      order: { createdAt: 'DESC' },
    });

    // Get permissions
    const permissions = await this.filePermissionRepository.find({
      where: { statementId },
      relations: ['user', 'grantedBy'],
    });

    const isOwner = statement.userId === userId;
    const userPermission = await this.getUserPermissionForStatement(userId, statementId);
    const isWorkspacePeer = Boolean(await this.findMembership(statement.workspaceId, userId));

    const fileAvailability = await this.fileStorageService.getFileAvailability(statement);

    return {
      statement,
      transactions,
      sharedLinks: sharedLinks.map(link => ({
        ...link,
        // Don't expose password hash
        password: link.password ? '******' : null,
      })),
      permissions,
      tags: statement.tags || [],
      isOwner,
      userPermission: isOwner
        ? FilePermissionType.OWNER
        : isWorkspacePeer
          ? FilePermissionType.VIEWER
          : userPermission?.permissionType,
      fileAvailability,
      hasFileOnDisk: fileAvailability.onDisk,
      hasFileInDb: fileAvailability.inDb,
    };
  }

  /**
   * Update category for a statement (file)
   */
  async updateFileCategory(statementId: string, userId: string, categoryId: string | null) {
    await this.checkFileAccess(userId, statementId, 'edit');

    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: ['category'],
    });

    if (!statement) {
      throw new NotFoundException('File not found');
    }

    let category: Category | null = null;
    if (categoryId) {
      category = await this.categoryRepository.findOne({
        where: buildStorageCategoryWhere(categoryId, statement.userId, statement.workspaceId),
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    statement.categoryId = category ? category.id : null;
    statement.category = category;

    const saved = await this.statementRepository.save(statement);

    return {
      ...saved,
      category,
    };
  }

  async updateFileTags(statementId: string, userId: string, tagIds: string[]) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: ['tags'],
    });
    if (!statement) {
      throw new NotFoundException('File not found');
    }

    const tags = await this.tagRepository.findByIds(tagIds || []);
    statement.tags = tags;
    const saved = await this.statementRepository.save(statement);
    return { ...saved, tags };
  }

  async createTag(dto: CreateTagDto, workspaceId: string) {
    const tag = this.tagRepository.create({
      name: dto.name,
      color: dto.color ?? null,
      workspaceId,
    });
    return await this.tagRepository.save(tag);
  }

  async listTags(workspaceId: string) {
    return await this.tagRepository.find({
      where: { workspaceId },
      order: { name: 'ASC' },
    });
  }

  async updateTag(tagId: string, dto: UpdateTagDto, workspaceId: string) {
    const tag = await this.tagRepository.findOne({
      where: { id: tagId, workspaceId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    if (dto.name !== undefined) {
      tag.name = dto.name.trim();
    }
    if (dto.color !== undefined) {
      tag.color = dto.color ?? null;
    }

    return await this.tagRepository.save(tag);
  }

  async deleteTag(tagId: string, workspaceId: string) {
    const tag = await this.tagRepository.findOne({
      where: { id: tagId, workspaceId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Remove tag from folders
    await this.folderRepository.update({ tagId }, { tagId: null, tag: null });

    return await this.tagRepository.remove(tag);
  }

  // Folders are the caller's own plus the workspace-wide ones (no owner), matched
  // with IsNull(): TypeORM drops a plain `null` from `where`, so `{ userId: null }`
  // never listed the workspace-wide folders, and `{ id, userId: null }` matched
  // any tenant's folder by id alone.
  private folderScope(workspaceId: string, userId: string, id?: string) {
    const byId = id ? { id } : {};
    return [
      { ...byId, workspaceId, userId },
      { ...byId, workspaceId, userId: IsNull() },
    ];
  }

  async createFolder(dto: CreateFolderDto, userId: string, workspaceId: string) {
    let tag = null;
    const tagId = dto.tagId === '' ? null : dto.tagId;
    if (tagId) {
      // Tags are shared across the workspace (see listTags).
      tag = await this.tagRepository.findOne({ where: { id: tagId, workspaceId } });
      if (!tag) {
        throw new NotFoundException('Tag not found');
      }
    }
    const folder = this.folderRepository.create({
      name: dto.name,
      userId,
      workspaceId,
      tagId: tag?.id ?? null,
      tag,
    });
    return await this.folderRepository.save(folder);
  }

  async listFolders(userId: string, workspaceId: string) {
    return await this.folderRepository.find({
      where: this.folderScope(workspaceId, userId),
      order: { name: 'ASC' },
      relations: ['tag'],
    });
  }

  async updateFolder(folderId: string, dto: UpdateFolderDto, userId: string, workspaceId: string) {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId, workspaceId },
    });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (dto.name !== undefined) {
      folder.name = dto.name.trim();
    }
    if (dto.tagId !== undefined) {
      const tagId = dto.tagId === '' ? null : dto.tagId;
      if (tagId) {
        const tag = await this.tagRepository.findOne({ where: { id: tagId, workspaceId } });
        if (!tag) {
          throw new NotFoundException('Tag not found');
        }
        folder.tagId = tag.id;
        folder.tag = tag;
      } else {
        folder.tagId = null;
        folder.tag = null;
      }
    }

    return await this.folderRepository.save(folder);
  }

  async deleteFolder(folderId: string, userId: string, workspaceId: string, deleteFiles: boolean) {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId, workspaceId },
    });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const statements = await this.statementRepository.find({
      where: { folderId: folder.id },
    });

    for (const statement of statements) {
      await this.checkFileAccess(userId, statement.id, 'edit');
    }

    if (deleteFiles) {
      for (const statement of statements) {
        await this.statementsService.remove(statement.id, userId, statement.workspaceId);
      }
    } else if (statements.length > 0) {
      await this.statementRepository.update({ folderId: folder.id }, { folderId: null });
    }

    await this.folderRepository.remove(folder);
    return {
      deleted: true,
      filesDeleted: deleteFiles ? statements.length : 0,
    };
  }

  async moveFileToFolder(statementId: string, userId: string, folderId: string | null) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException('File not found');
    }

    let folder: Folder | null = null;
    if (folderId) {
      // Same scoping as listFolders, in the file's own workspace. An unscoped
      // lookup let a file be moved into another tenant's folder.
      folder = await this.folderRepository.findOne({
        where: this.folderScope(statement.workspaceId, userId, folderId),
      });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
    }

    statement.folderId = folder ? folder.id : null;
    statement.folder = folder;
    await this.statementRepository.save(statement);
    return { folderId: statement.folderId };
  }

  async moveFileToTrash(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException('File not found');
    }
    if (statement.deletedAt) {
      return { status: 'already_trashed', deletedAt: statement.deletedAt };
    }
    statement.deletedAt = new Date();
    await this.statementRepository.save(statement);
    return { status: 'trashed', deletedAt: statement.deletedAt };
  }

  async restoreFileFromTrash(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException('File not found');
    }
    if (!statement.deletedAt) {
      return { status: 'active' };
    }
    statement.deletedAt = null;
    await this.statementRepository.save(statement);
    return { status: 'restored' };
  }

  async deleteFilePermanently(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException('File not found');
    }
    if (!statement.deletedAt) {
      throw new BadRequestException('File is not in trash');
    }
    await this.statementsService.remove(statementId, userId, statement.workspaceId);
    return { status: 'deleted' };
  }

  async createView(dto: StorageViewDto, workspaceId: string) {
    const view = this.storageViewRepository.create({
      name: dto.name,
      workspaceId,
      filters: dto.filters || {},
    });
    return await this.storageViewRepository.save(view);
  }

  async listViews(workspaceId: string) {
    return await this.storageViewRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteView(id: string, workspaceId: string) {
    const view = await this.storageViewRepository.findOne({
      where: { id, workspaceId },
    });
    if (!view) {
      throw new NotFoundException('View not found');
    }
    await this.storageViewRepository.remove(view);
    return { deleted: true };
  }

  async createFileVersion(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');

    const statement = await this.statementRepository
      .createQueryBuilder('statement')
      .addSelect('statement.fileData')
      .where('statement.id = :id', { id: statementId })
      .getOne();

    if (!statement) {
      throw new NotFoundException('File not found');
    }

    let fileData = statement.fileData ?? null;

    if (!fileData) {
      const resolved = this.fileStorageService.resolveFilePath(statement.filePath);
      if (resolved) {
        try {
          fileData = await fs.promises.readFile(resolved);
        } catch {
          fileData = null;
        }
      }
    }

    if (!fileData && statement.fileHash && statement.userId) {
      const other = await this.statementRepository
        .createQueryBuilder('statement')
        .addSelect('statement.fileData')
        .where('statement.userId = :userId', { userId: statement.userId })
        .andWhere('statement.fileHash = :fileHash', {
          fileHash: statement.fileHash,
        })
        .andWhere('statement.fileData IS NOT NULL')
        .andWhere('statement.id <> :id', { id: statement.id })
        .orderBy('statement.createdAt', 'DESC')
        .getOne();

      fileData = other?.fileData ?? null;
    }

    if (!fileData) {
      throw new NotFoundException('File data is unavailable for versioning');
    }

    const actualHash = crypto.createHash('sha256').update(fileData).digest('hex');
    if (actualHash !== statement.fileHash) {
      throw new BadRequestException('File hash mismatch');
    }

    const version = this.fileVersionRepository.create({
      statementId: statement.id,
      createdBy: userId,
      fileHash: statement.fileHash,
      fileName: statement.fileName,
      fileType: statement.fileType,
      fileSize: statement.fileSize,
      fileData,
    });

    const saved = await this.fileVersionRepository.save(version);

    return {
      id: saved.id,
      statementId: saved.statementId,
      createdBy: saved.createdBy,
      fileHash: saved.fileHash,
      fileName: saved.fileName,
      fileType: saved.fileType,
      fileSize: saved.fileSize,
      createdAt: saved.createdAt,
    };
  }

  async listFileVersions(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'view');

    return await this.fileVersionRepository.find({
      where: { statementId },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'statementId',
        'createdBy',
        'fileHash',
        'fileName',
        'fileType',
        'fileSize',
        'createdAt',
      ],
    });
  }

  /**
   * Download file
   */
  async downloadFile(statementId: string, userId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException('File not found');
    }

    const { stream, fileName, mimeType } = await this.getFileStream(statement, userId, 'download');
    return { stream, fileName, mimeType };
  }

  async restoreFile(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException('File not found');
    }
    const restored = await this.fileStorageService.restoreFile(statement);
    if (!restored) {
      throw new NotFoundException('File data is unavailable for restore');
    }
    return { status: 'restored', source: restored.source };
  }

  async exportTransactionsCsv(statementId: string, userId: string) {
    await this.checkFileAccess(userId, statementId, 'view');
    const transactions = await this.transactionRepository.find({
      where: { statementId },
      order: { transactionDate: 'DESC' },
    });

    const header = [
      'date',
      'documentNumber',
      'counterpartyName',
      'counterpartyBin',
      'debit',
      'credit',
      'currency',
      'paymentPurpose',
    ];
    const rows = transactions.map(t => [
      t.transactionDate ? t.transactionDate.toISOString().split('T')[0] : '',
      t.documentNumber ?? '',
      t.counterpartyName ?? '',
      t.counterpartyBin ?? '',
      t.debit ?? '',
      t.credit ?? '',
      t.currency ?? '',
      (t.paymentPurpose || '').replace(/\n/g, ' '),
    ]);
    const csv = [header, ...rows]
      .map(r =>
        r
          .map(v => `"${String(neutralizeSpreadsheetFormulaCell(v)).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const fileName = `transactions-${statementId}.csv`;
    return { csv, fileName };
  }

  async bulkDelete(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });

    if (!statements.length) {
      return { deleted: 0, missing: uniqueIds.length };
    }

    for (const st of statements) {
      await this.checkFileAccess(userId, st.id, 'edit');
    }

    await this.statementRepository.delete(uniqueIds);
    return {
      deleted: statements.length,
      missing: uniqueIds.length - statements.length,
    };
  }

  async bulkRestoreFromTrash(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });

    if (!statements.length) {
      return { restored: 0, missing: uniqueIds.length };
    }

    for (const st of statements) {
      await this.checkFileAccess(userId, st.id, 'edit');
    }

    const restoreIds = statements.filter(st => st.deletedAt).map(st => st.id);

    if (restoreIds.length) {
      await this.statementRepository.update({ id: In(restoreIds) }, { deletedAt: null });
    }

    return {
      restored: restoreIds.length,
      missing: uniqueIds.length - statements.length,
      skipped: statements.length - restoreIds.length,
    };
  }

  async bulkDeleteFromTrash(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });

    if (!statements.length) {
      return { deleted: 0, missing: uniqueIds.length };
    }

    for (const st of statements) {
      await this.checkFileAccess(userId, st.id, 'edit');
    }

    const deletable = statements.filter(st => st.deletedAt);
    for (const st of deletable) {
      await this.statementsService.remove(st.id, userId, st.workspaceId);
    }

    return {
      deleted: deletable.length,
      missing: uniqueIds.length - statements.length,
      skipped: statements.length - deletable.length,
    };
  }

  async bulkDownload(statementIds: string[], userId: string) {
    const uniqueIds = Array.from(new Set(statementIds));
    const statements = await this.statementRepository.findBy({
      id: In(uniqueIds),
    });
    const allowed: { id: string; downloadUrl: string }[] = [];
    for (const st of statements) {
      try {
        await this.checkFileAccess(userId, st.id, 'download');
        const base =
          process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3001/api/v1';
        allowed.push({
          id: st.id,
          downloadUrl: `${base}/storage/files/${st.id}/download`,
        });
      } catch {
        // skip not allowed
      }
    }
    return {
      files: allowed,
      requested: uniqueIds.length,
      allowed: allowed.length,
    };
  }

  /**
   * Get file info for inline preview
   */
  async getFilePreview(statementId: string, userId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException('File not found');
    }

    const started = Date.now();
    try {
      const { stream, fileName, mimeType } = await this.getFileStream(statement, userId, 'view');
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess('view', 'error', started);
      throw error;
    }
  }

  async getSharedDownloadStream(statementId: string): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException('File not found');
    }

    const started = Date.now();
    try {
      const { stream, fileName, mimeType, source } =
        await this.fileStorageService.getStatementFileStream(statement);
      this.observeFileAccess('shared-download', 'ok', started, source);
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess('shared-download', 'error', started);
      throw error;
    }
  }

  private async getFileStream(
    statement: Statement,
    userId: string,
    action: 'view' | 'download',
  ): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    await this.checkFileAccess(userId, statement.id, action);

    const started = Date.now();
    try {
      const { stream, fileName, mimeType, source } =
        await this.fileStorageService.getStatementFileStream(statement);
      this.observeFileAccess(action, 'ok', started, source);
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess(action, 'error', started);
      throw error;
    }
  }

  private observeFileAccess(
    action: 'view' | 'download' | 'shared-download',
    result: 'ok' | 'error',
    startedAt: number,
    source: 'disk' | 'db' | 'restored' | 'unknown' = 'unknown',
  ) {
    if (!this.metricsService?.storageFileAccessDurationSeconds) {
      return;
    }
    const duration = (Date.now() - startedAt) / 1000;
    this.metricsService.storageFileAccessDurationSeconds.observe(
      { action, source, result },
      duration,
    );
    if (result === 'error' && this.metricsService.storageFileAccessErrorsTotal) {
      this.metricsService.storageFileAccessErrorsTotal.inc({
        action,
        reason: 'access_failed',
      });
    }
  }

  /**
   * Create shared link
   */
  async createSharedLink(
    statementId: string,
    userId: string,
    dto: CreateSharedLinkDto,
  ): Promise<SharedLink> {
    // Check if user has permission to share
    await this.checkFileAccess(userId, statementId, 'share');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      select: ['id', 'deletedAt'],
    });
    if (!statement) {
      throw new NotFoundException('File not found');
    }
    if (statement.deletedAt) {
      throw new BadRequestException('File is in trash');
    }

    // Generate unique token
    const token = this.generateShareToken();

    // Hash password if provided
    const hashedPassword = dto.password ? await hashPassword(dto.password) : null;

    const sharedLink = this.sharedLinkRepository.create({
      statementId,
      userId,
      token,
      permission: dto.permission,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      password: hashedPassword,
      allowAnonymous: dto.allowAnonymous ?? true,
      description: dto.description,
      status: ShareLinkStatus.ACTIVE,
    });

    return await this.sharedLinkRepository.save(sharedLink);
  }

  /**
   * Get shared links for a statement
   */
  async getSharedLinks(statementId: string, userId: string) {
    // Check if user has access to view shared links
    await this.checkFileAccess(userId, statementId, 'view');

    const links = await this.sharedLinkRepository.find({
      where: { statementId },
      order: { createdAt: 'DESC' },
    });

    return links.map(link => ({
      ...link,
      // Don't expose password hash
      password: link.password ? '******' : null,
    }));
  }

  /**
   * Update shared link
   */
  async updateSharedLink(
    linkId: string,
    userId: string,
    dto: UpdateSharedLinkDto,
  ): Promise<SharedLink> {
    const link = await this.sharedLinkRepository.findOne({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException('Shared link not found');
    }

    // Check if user is owner
    await this.checkFileAccess(userId, link.statementId, 'share');

    // Update fields
    if (dto.permission !== undefined) {
      link.permission = dto.permission;
    }
    if (dto.expiresAt !== undefined) {
      link.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.password !== undefined) {
      link.password = dto.password ? await hashPassword(dto.password) : null;
    }
    if (dto.status !== undefined) {
      link.status = dto.status;
    }
    if (dto.allowAnonymous !== undefined) {
      link.allowAnonymous = dto.allowAnonymous;
    }
    if (dto.description !== undefined) {
      link.description = dto.description;
    }

    return await this.sharedLinkRepository.save(link);
  }

  /**
   * Delete shared link
   */
  async deleteSharedLink(linkId: string, userId: string): Promise<void> {
    const link = await this.sharedLinkRepository.findOne({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException('Shared link not found');
    }

    // Check if user is owner
    await this.checkFileAccess(userId, link.statementId, 'share');

    await this.sharedLinkRepository.remove(link);
  }

  /**
   * Access shared link (public endpoint)
   */
  async accessSharedLink(token: string, password?: string) {
    const link = await this.sharedLinkRepository.findOne({
      where: { token },
      relations: ['statement', 'statement.category'],
    });

    if (!link) {
      throw new NotFoundException('Shared link not found');
    }

    // Check if link is active
    if (link.status !== ShareLinkStatus.ACTIVE) {
      throw new ForbiddenException('Shared link is not active');
    }

    // Check if link is expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      // Auto-expire the link
      link.status = ShareLinkStatus.EXPIRED;
      await this.sharedLinkRepository.save(link);
      throw new ForbiddenException('Shared link has expired');
    }

    if (link.allowAnonymous === false) {
      throw new ForbiddenException('Shared link requires authenticated access');
    }

    // Check password if required
    if (link.password) {
      if (!password) {
        throw new UnauthorizedException('Password required');
      }
      const isValid = await bcrypt.compare(password, link.password);
      if (!isValid) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    // Update access count and last accessed
    link.accessCount += 1;
    link.lastAccessedAt = new Date();
    await this.sharedLinkRepository.save(link);

    // Get transactions if permission allows
    let transactions = [];
    if (link.permission !== SharePermissionLevel.VIEW) {
      transactions = await this.transactionRepository.find({
        where: { statementId: link.statement.id },
        order: { transactionDate: 'DESC' },
        relations: ['category', 'branch', 'wallet'],
      });
    }

    return {
      statement: link.statement,
      transactions,
      permission: link.permission,
      canDownload: [SharePermissionLevel.DOWNLOAD, SharePermissionLevel.EDIT].includes(
        link.permission,
      ),
    };
  }

  /**
   * Grant permission to user
   */
  async grantPermission(
    statementId: string,
    grantedById: string,
    dto: GrantPermissionDto,
  ): Promise<FilePermission> {
    // Check if granter has permission to share
    await this.checkFileAccess(grantedById, statementId, 'share');

    // dto.userId is an arbitrary id from the request body: without this the
    // file could be shared with any account in the system, in any tenant.
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      select: ['id', 'workspaceId'],
    });
    if (!statement) {
      throw new NotFoundException('File not found');
    }

    const granteeMembership = await this.workspaceMemberRepository.findOne({
      where: { userId: dto.userId, workspaceId: statement.workspaceId },
    });
    if (!granteeMembership) {
      throw new NotFoundException('User not found in this workspace');
    }

    // Check if permission already exists
    const existing = await this.filePermissionRepository.findOne({
      where: { statementId, userId: dto.userId },
    });

    if (existing) {
      throw new BadRequestException('Permission already exists for this user');
    }

    const permission = this.filePermissionRepository.create({
      statementId,
      userId: dto.userId,
      grantedById,
      permissionType: dto.permissionType,
      canReshare: dto.canReshare ?? false,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
    });

    return await this.filePermissionRepository.save(permission);
  }

  /**
   * Get permissions for a statement
   */
  async getFilePermissions(statementId: string, userId: string) {
    // Check if user has access
    await this.checkFileAccess(userId, statementId, 'view');

    return await this.filePermissionRepository.find({
      where: { statementId },
      relations: ['user', 'grantedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update permission
   */
  async updatePermission(
    permissionId: string,
    userId: string,
    dto: UpdatePermissionDto,
  ): Promise<FilePermission> {
    const permission = await this.filePermissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if user is owner or granted the permission
    await this.checkFileAccess(userId, permission.statementId, 'share');

    // Update fields
    if (dto.permissionType !== undefined) {
      permission.permissionType = dto.permissionType;
    }
    if (dto.canReshare !== undefined) {
      permission.canReshare = dto.canReshare;
    }
    if (dto.expiresAt !== undefined) {
      permission.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.isActive !== undefined) {
      permission.isActive = dto.isActive;
    }

    return await this.filePermissionRepository.save(permission);
  }

  /**
   * Revoke permission
   */
  async revokePermission(permissionId: string, userId: string): Promise<void> {
    const permission = await this.filePermissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if user is owner or granted the permission
    await this.checkFileAccess(userId, permission.statementId, 'share');

    await this.filePermissionRepository.remove(permission);
  }

  /**
   * Check if user has specific access to a file
   */
  private async checkFileAccess(
    userId: string,
    statementId: string,
    requiredAction: 'view' | 'download' | 'edit' | 'share',
  ): Promise<void> {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: ['user'],
    });

    if (!statement) {
      throw new NotFoundException('File not found');
    }

    // Access follows membership in the file's own workspace, whichever
    // workspace the caller registered with.
    const membership = await this.findMembership(statement.workspaceId, userId);

    // Uploading the file does not outrank the role: a viewer who dropped a
    // statement in still only reads it.
    if (statement.userId === userId) {
      if (membership) {
        if (
          requiredAction === 'edit' &&
          !workspaceMemberCanEdit(membership.role, 'canEditStatements', membership.permissions)
        ) {
          throw new ForbiddenException(appError('STATEMENTS_EDIT_FORBIDDEN'));
        }
        if (
          requiredAction === 'share' &&
          !workspaceMemberCanEdit(membership.role, 'canShareFiles', membership.permissions)
        ) {
          throw new ForbiddenException(appError('SHARING_FORBIDDEN'));
        }
      }
      return;
    }

    // Workspace members: allow view/download; admins/owners can edit/share
    if (membership) {
      if (requiredAction === 'view' || requiredAction === 'download') {
        return;
      }

      const canManage =
        membership && [WorkspaceRole.ADMIN, WorkspaceRole.OWNER].includes(membership.role);

      if (requiredAction === 'edit' && canManage) {
        return;
      }

      if (requiredAction === 'share' && canManage) {
        return;
      }
    }

    // Check file permissions
    const permission = await this.getUserPermissionForStatement(userId, statementId);

    if (!permission?.isActive) {
      throw new ForbiddenException('You do not have access to this file');
    }

    // Check if permission is expired
    if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
      throw new ForbiddenException('Your permission has expired');
    }

    // Check action permission
    const hasPermission = this.checkActionPermission(
      permission.permissionType,
      requiredAction,
      permission.canReshare,
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to ${requiredAction} this file`);
    }
  }

  /**
   * Get user permission for a statement
   */
  private async getUserPermissionForStatement(
    userId: string,
    statementId: string,
  ): Promise<FilePermission | null> {
    return await this.filePermissionRepository.findOne({
      where: {
        userId,
        statementId,
        isActive: true,
      },
    });
  }

  /**
   * Check if permission type allows specific action
   */
  private checkActionPermission(
    permissionType: FilePermissionType,
    action: 'view' | 'download' | 'edit' | 'share',
    canReshare: boolean,
  ): boolean {
    switch (action) {
      case 'view':
        return [
          FilePermissionType.OWNER,
          FilePermissionType.EDITOR,
          FilePermissionType.VIEWER,
          FilePermissionType.DOWNLOADER,
        ].includes(permissionType);
      case 'download':
        return [
          FilePermissionType.OWNER,
          FilePermissionType.EDITOR,
          FilePermissionType.DOWNLOADER,
        ].includes(permissionType);
      case 'edit':
        return [FilePermissionType.OWNER, FilePermissionType.EDITOR].includes(permissionType);
      case 'share':
        return permissionType === FilePermissionType.OWNER || canReshare;
      default:
        return false;
    }
  }

  /**
   * Generate unique share token
   */
  private generateShareToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
