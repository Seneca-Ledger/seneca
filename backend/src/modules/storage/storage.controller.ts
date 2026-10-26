import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { HideInternalColumnsInterceptor } from '../../common/interceptors/hide-internal-columns.interceptor';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { pipeFileStreamResponse } from '../../common/utils/stream-response.util';
import {
  BulkFileActionBody,
  CreateFileVersionBody,
  CreateFolderBody,
  DeleteFolderQuery,
  FileCategoryUpdate,
  MoveFileBody,
  StorageFileDetails,
  StorageFileList,
  StorageFilesQuery,
  StorageFolder,
  StorageFolderList,
  StorageIdParams,
  StorageViewBody,
  StorageViewItem,
  StorageViewList,
  UpdateFileCategoryBody,
  UpdateFileTagsBody,
  UpdateFolderBody,
} from '../../contracts';
import {
  BulkFileDownloads,
  BulkFilesDeleted,
  BulkFilesRestored,
  FileDeleted,
  FileFolderMove,
  FileRestored,
  FileTagsUpdate,
  FileTrashed,
  FileUntrashed,
  FileVersionItem,
  FileVersionList,
  FolderDeleted,
  ViewDeleted,
} from '../../contracts/storage/storage-actions';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StorageService } from './storage.service';

/**
 * Storage controller for file management; sharing and permissions are in
 * `StorageSharingController`.
 */

/** The record's uuid in `:id`, for every route below that has one. */
const StorageId = () => SchemaParams(StorageIdParams);

@Controller('storage')
@UseGuards(JwtAuthGuard)
@UseInterceptors(HideInternalColumnsInterceptor)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Get all files in storage for current user
   * GET /api/v1/storage/files
   */
  @Get('files')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageFileList)
  async getStorageFiles(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(StorageFilesQuery) query: StorageFilesQuery,
  ) {
    const { bank, tagIds, ...filters } = query;
    return await this.storageService.getStorageFiles(user.id, workspaceId, {
      ...filters,
      bankName: bank,
      tagIds: tagIds ? [...tagIds] : undefined,
    });
  }

  /**
   * Get file details with transactions
   * GET /api/v1/storage/files/:id
   */
  @Get('files/:id')
  @SchemaResponse(StorageFileDetails)
  async getFileDetails(@StorageId() { id }: StorageIdParams, @CurrentUser() user: User) {
    return await this.storageService.getFileDetails(id, user.id);
  }

  /**
   * Update category for a file
   * PATCH /api/v1/storage/files/:id/category
   */
  @Patch('files/:id/category')
  @SchemaResponse(FileCategoryUpdate)
  async updateFileCategory(
    @StorageId() { id: statementId }: StorageIdParams,
    @CurrentUser() user: User,
    @SchemaBody(UpdateFileCategoryBody) dto: UpdateFileCategoryBody,
  ) {
    return await this.storageService.updateFileCategory(
      statementId,
      user.id,
      dto.categoryId ?? null,
    );
  }

  /**
   * Update tags for a file
   * PATCH /api/v1/storage/files/:id/tags
   */
  @Patch('files/:id/tags')
  @SchemaResponse(FileTagsUpdate)
  async updateFileTags(
    @StorageId() { id: statementId }: StorageIdParams,
    @CurrentUser() user: User,
    @SchemaBody(UpdateFileTagsBody) dto: UpdateFileTagsBody,
  ) {
    return await this.storageService.updateFileTags(statementId, user.id, dto.tagIds || []);
  }

  /**
   * Move file to folder (or root if null)
   * PATCH /api/v1/storage/files/:id/folder
   */
  @Patch('files/:id/folder')
  @SchemaResponse(FileFolderMove)
  async moveFile(
    @StorageId() { id: statementId }: StorageIdParams,
    @CurrentUser() user: User,
    @SchemaBody(MoveFileBody) dto: MoveFileBody,
  ) {
    return await this.storageService.moveFileToFolder(statementId, user.id, dto.folderId ?? null);
  }

  /**
   * Move file to trash (soft delete)
   * POST /api/v1/storage/files/:id/trash
   */
  @Post('files/:id/trash')
  @SchemaResponse(FileTrashed)
  async moveFileToTrash(@StorageId() { id }: StorageIdParams, @CurrentUser() user: User) {
    return await this.storageService.moveFileToTrash(id, user.id);
  }

  /**
   * Restore file from trash
   * POST /api/v1/storage/files/:id/trash/restore
   */
  @Post('files/:id/trash/restore')
  @SchemaResponse(FileUntrashed)
  async restoreFileFromTrash(@StorageId() { id }: StorageIdParams, @CurrentUser() user: User) {
    return await this.storageService.restoreFileFromTrash(id, user.id);
  }

  /**
   * Permanently delete file from trash
   * DELETE /api/v1/storage/files/:id/trash
   */
  @Delete('files/:id/trash')
  @SchemaResponse(FileDeleted)
  async deleteFilePermanently(@StorageId() { id }: StorageIdParams, @CurrentUser() user: User) {
    return await this.storageService.deleteFilePermanently(id, user.id);
  }

  /**
   * Create folder
   * POST /api/v1/storage/folders
   */
  @Post('folders')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageFolder)
  async createFolder(
    @SchemaBody(CreateFolderBody) dto: CreateFolderBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.storageService.createFolder(dto, user.id, workspaceId);
  }

  /**
   * List folders
   * GET /api/v1/storage/folders
   */
  @Get('folders')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageFolderList)
  async listFolders(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return await this.storageService.listFolders(user.id, workspaceId);
  }

  /**
   * Update folder
   * PATCH /api/v1/storage/folders/:id
   */
  @Patch('folders/:id')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageFolder)
  async updateFolder(
    @StorageId() { id: folderId }: StorageIdParams,
    @SchemaBody(UpdateFolderBody) dto: UpdateFolderBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.storageService.updateFolder(folderId, dto, user.id, workspaceId);
  }

  /**
   * Delete folder (optionally with contents)
   * DELETE /api/v1/storage/folders/:id
   */
  @Delete('folders/:id')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(FolderDeleted)
  async deleteFolder(
    @StorageId() { id: folderId }: StorageIdParams,
    @SchemaQuery(DeleteFolderQuery) query: DeleteFolderQuery,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.storageService.deleteFolder(
      folderId,
      user.id,
      workspaceId,
      query.deleteFiles === true,
    );
  }

  /**
   * Create new file version (snapshot current file)
   * POST /api/v1/storage/files/:id/versions
   */
  @Post('files/:id/versions')
  @SchemaResponse(FileVersionItem)
  async createFileVersion(
    @StorageId() { id: statementId }: StorageIdParams,
    @CurrentUser() user: User,
    @SchemaBody(CreateFileVersionBody) _dto: CreateFileVersionBody,
  ) {
    return await this.storageService.createFileVersion(statementId, user.id);
  }

  /**
   * List file versions
   * GET /api/v1/storage/files/:id/versions
   */
  @Get('files/:id/versions')
  @SchemaResponse(FileVersionList)
  async listFileVersions(@StorageId() { id }: StorageIdParams, @CurrentUser() user: User) {
    return await this.storageService.listFileVersions(id, user.id);
  }

  /**
   * Create saved view
   * POST /api/v1/storage/views
   */
  @Post('views')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageViewItem)
  async createView(
    @SchemaBody(StorageViewBody) dto: StorageViewBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.storageService.createView(dto, user.id, workspaceId);
  }

  /**
   * List saved views
   * GET /api/v1/storage/views
   */
  @Get('views')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageViewList)
  async listViews(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return await this.storageService.listViews(workspaceId);
  }

  /**
   * Delete saved view
   * DELETE /api/v1/storage/views/:id
   */
  @Delete('views/:id')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(ViewDeleted)
  async deleteView(
    @StorageId() { id }: StorageIdParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.storageService.deleteView(id, workspaceId);
  }

  /**
   * Preview file inline
   * GET /api/v1/storage/files/:id/view
   */
  @Get('files/:id/view')
  async viewFile(
    @StorageId() { id: statementId }: StorageIdParams,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.storageService.getFilePreview(
      statementId,
      user.id,
    );

    pipeFileStreamResponse(res, stream, {
      disposition: 'inline',
      fileName,
      mimeType,
      errorMessage: 'Failed to read file',
    });
  }

  /**
   * Download file
   * GET /api/v1/storage/files/:id/download
   */
  @Get('files/:id/download')
  async downloadFile(
    @StorageId() { id: statementId }: StorageIdParams,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.storageService.downloadFile(
      statementId,
      user.id,
    );

    pipeFileStreamResponse(res, stream, {
      disposition: 'attachment',
      fileName,
      mimeType,
      errorMessage: 'Failed to download file',
    });
  }

  /**
   * Restore file from DB (or duplicates) to disk
   * POST /api/v1/storage/files/:id/restore
   */
  @Post('files/:id/restore')
  @SchemaResponse(FileRestored)
  async restoreFile(@StorageId() { id: statementId }: StorageIdParams, @CurrentUser() user: User) {
    return await this.storageService.restoreFile(statementId, user.id);
  }

  /**
   * Export transactions to CSV
   * GET /api/v1/storage/files/:id/transactions/export
   */
  @Get('files/:id/transactions/export')
  async exportTransactions(
    @StorageId() { id: statementId }: StorageIdParams,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const { csv, fileName } = await this.storageService.exportTransactionsCsv(statementId, user.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(csv);
  }

  /**
   * Bulk delete files (with permissions check)
   * POST /api/v1/storage/files/bulk/delete
   */
  @Post('files/bulk/delete')
  @SchemaResponse(BulkFilesDeleted)
  async bulkDelete(
    @SchemaBody(BulkFileActionBody) dto: BulkFileActionBody,
    @CurrentUser() user: User,
  ) {
    return await this.storageService.bulkDelete(dto.statementIds, user.id);
  }

  /**
   * Bulk restore files from trash
   * POST /api/v1/storage/files/trash/bulk/restore
   */
  @Post('files/trash/bulk/restore')
  @SchemaResponse(BulkFilesRestored)
  async bulkRestore(
    @SchemaBody(BulkFileActionBody) dto: BulkFileActionBody,
    @CurrentUser() user: User,
  ) {
    return await this.storageService.bulkRestoreFromTrash(dto.statementIds, user.id);
  }

  /**
   * Bulk delete files permanently from trash
   * POST /api/v1/storage/files/bulk/trash/delete
   */
  @Post('files/bulk/trash/delete')
  @SchemaResponse(BulkFilesDeleted)
  async bulkDeleteFromTrash(
    @SchemaBody(BulkFileActionBody) dto: BulkFileActionBody,
    @CurrentUser() user: User,
  ) {
    return await this.storageService.bulkDeleteFromTrash(dto.statementIds, user.id);
  }

  /**
   * Bulk download helper (returns download URLs for permitted files)
   * POST /api/v1/storage/files/bulk/download
   */
  @Post('files/bulk/download')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @SchemaResponse(BulkFileDownloads)
  async bulkDownload(
    @SchemaBody(BulkFileActionBody) dto: BulkFileActionBody,
    @CurrentUser() user: User,
  ) {
    return await this.storageService.bulkDownload(dto.statementIds, user.id);
  }
}
