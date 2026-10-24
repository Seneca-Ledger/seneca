import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { HideInternalColumnsInterceptor } from '../../common/interceptors/hide-internal-columns.interceptor';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { deletedResponse } from '../../common/utils/responses.util';
import { pipeFileStreamResponse } from '../../common/utils/stream-response.util';
import {
  BulkFileActionBody,
  CreateFileVersionBody,
  CreateFolderBody,
  CreateSharedLinkBody,
  CreateTagBody,
  FileCategoryUpdate,
  GrantPermissionBody,
  MoveFileBody,
  SharedFileAccess,
  StorageFileDetails,
  StorageFileList,
  StorageFolder,
  StorageFolderList,
  StorageTag,
  StorageTagList,
  StorageViewBody,
  StorageViewItem,
  StorageViewList,
  UpdateFileCategoryBody,
  UpdateFileTagsBody,
  UpdateFolderBody,
  UpdatePermissionBody,
  UpdateSharedLinkBody,
  UpdateTagBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { TagsService } from '../tags/tags.service';
import { StorageService } from './storage.service';

/**
 * Storage controller for file management, sharing, and permissions
 */
/** Lowercase: Nest matches @Headers() names case-insensitively, but this is the wire name. */
export const SHARED_LINK_PASSWORD_HEADER = 'x-share-password';

@Controller('storage')
@UseGuards(JwtAuthGuard)
@UseInterceptors(HideInternalColumnsInterceptor)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly tagsService: TagsService,
  ) {}

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
    @Query('search') search?: string,
    @Query('bank') bankName?: string,
    @Query('availability') availability?: 'disk' | 'db' | 'both' | 'missing',
    @Query('scope') scope?: 'mine' | 'shared' | 'all',
    @Query('folderId') folderId?: string,
    @Query('tagIds') tagIds?: string | string[],
    @Query('deleted') deleted?: 'only' | 'include',
  ) {
    const parsedTagIds = Array.isArray(tagIds)
      ? tagIds
      : tagIds
        ? tagIds
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
        : undefined;
    return await this.storageService.getStorageFiles(user.id, workspaceId, {
      search,
      bankName,
      availability,
      scope,
      folderId,
      tagIds: parsedTagIds,
      deleted,
    });
  }

  /**
   * Get file details with transactions
   * GET /api/v1/storage/files/:id
   */
  @Get('files/:id')
  @SchemaResponse(StorageFileDetails)
  async getFileDetails(@Param('id') statementId: string, @CurrentUser() user: User) {
    return await this.storageService.getFileDetails(statementId, user.id);
  }

  /**
   * Update category for a file
   * PATCH /api/v1/storage/files/:id/category
   */
  @Patch('files/:id/category')
  @SchemaResponse(FileCategoryUpdate)
  async updateFileCategory(
    @Param('id') statementId: string,
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
  async updateFileTags(
    @Param('id') statementId: string,
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
  async moveFile(
    @Param('id') statementId: string,
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
  async moveFileToTrash(@Param('id') statementId: string, @CurrentUser() user: User) {
    return await this.storageService.moveFileToTrash(statementId, user.id);
  }

  /**
   * Restore file from trash
   * POST /api/v1/storage/files/:id/trash/restore
   */
  @Post('files/:id/trash/restore')
  async restoreFileFromTrash(@Param('id') statementId: string, @CurrentUser() user: User) {
    return await this.storageService.restoreFileFromTrash(statementId, user.id);
  }

  /**
   * Permanently delete file from trash
   * DELETE /api/v1/storage/files/:id/trash
   */
  @Delete('files/:id/trash')
  async deleteFilePermanently(@Param('id') statementId: string, @CurrentUser() user: User) {
    return await this.storageService.deleteFilePermanently(statementId, user.id);
  }

  /**
   * Create tag
   * POST /api/v1/storage/tags
   */
  @Post('tags')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageTag)
  async createTag(
    @SchemaBody(CreateTagBody) dto: CreateTagBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.tagsService.create(dto, workspaceId);
  }

  /**
   * List tags
   * GET /api/v1/storage/tags
   */
  @Get('tags')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageTagList)
  async listTags(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return await this.tagsService.list(workspaceId);
  }

  /**
   * Update tag
   * PATCH /api/v1/storage/tags/:id
   */
  @Patch('tags/:id')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageTag)
  async updateTag(
    @Param('id') tagId: string,
    @SchemaBody(UpdateTagBody) dto: UpdateTagBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.tagsService.update(tagId, dto, workspaceId);
  }

  /**
   * Delete tag
   * DELETE /api/v1/storage/tags/:id
   */
  @Delete('tags/:id')
  @UseGuards(WorkspaceContextGuard)
  async deleteTag(
    @Param('id') tagId: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.tagsService.remove(tagId, workspaceId);
    return deletedResponse('Tag');
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
    @Param('id') folderId: string,
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
  async deleteFolder(
    @Param('id') folderId: string,
    @Query('deleteFiles') deleteFiles: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.storageService.deleteFolder(
      folderId,
      user.id,
      workspaceId,
      deleteFiles === 'true',
    );
  }

  /**
   * Create new file version (snapshot current file)
   * POST /api/v1/storage/files/:id/versions
   */
  @Post('files/:id/versions')
  async createFileVersion(
    @Param('id') statementId: string,
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
  async listFileVersions(@Param('id') statementId: string, @CurrentUser() user: User) {
    return await this.storageService.listFileVersions(statementId, user.id);
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
  async deleteView(
    @Param('id') id: string,
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
    @Param('id') statementId: string,
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
    @Param('id') statementId: string,
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
   * Create shared link for a file
   * POST /api/v1/storage/files/:id/share
   */
  @Post('files/:id/share')
  async createSharedLink(
    @Param('id') statementId: string,
    @CurrentUser() user: User,
    @SchemaBody(CreateSharedLinkBody) dto: CreateSharedLinkBody,
  ) {
    const link = await this.storageService.createSharedLink(statementId, user.id, dto);

    // Generate full URL for the shared link
    const shareUrl = `${process.env.FRONTEND_URL}/shared/${link.token}`;

    return {
      ...link,
      shareUrl,
      // Don't expose password hash
      password: link.password ? '******' : null,
    };
  }

  /**
   * Get shared links for a file
   * GET /api/v1/storage/files/:id/shares
   */
  @Get('files/:id/shares')
  async getSharedLinks(@Param('id') statementId: string, @CurrentUser() user: User) {
    return await this.storageService.getSharedLinks(statementId, user.id);
  }

  /**
   * Update shared link
   * PUT /api/v1/storage/shares/:id
   */
  @Put('shares/:id')
  async updateSharedLink(
    @Param('id') linkId: string,
    @CurrentUser() user: User,
    @SchemaBody(UpdateSharedLinkBody) dto: UpdateSharedLinkBody,
  ) {
    return await this.storageService.updateSharedLink(linkId, user.id, dto);
  }

  /**
   * Delete shared link
   * DELETE /api/v1/storage/shares/:id
   */
  @Delete('shares/:id')
  async deleteSharedLink(@Param('id') linkId: string, @CurrentUser() user: User) {
    await this.storageService.deleteSharedLink(linkId, user.id);
    return deletedResponse('Shared link');
  }

  /**
   * Restore file from DB (or duplicates) to disk
   * POST /api/v1/storage/files/:id/restore
   */
  @Post('files/:id/restore')
  async restoreFile(@Param('id') statementId: string, @CurrentUser() user: User) {
    return await this.storageService.restoreFile(statementId, user.id);
  }

  /**
   * Export transactions to CSV
   * GET /api/v1/storage/files/:id/transactions/export
   */
  @Get('files/:id/transactions/export')
  async exportTransactions(
    @Param('id') statementId: string,
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
  async bulkDownload(
    @SchemaBody(BulkFileActionBody) dto: BulkFileActionBody,
    @CurrentUser() user: User,
  ) {
    return await this.storageService.bulkDownload(dto.statementIds, user.id);
  }

  /**
   * Access shared link (public endpoint)
   * GET /api/v1/storage/shared/:token
   *
   * The password travels in a header, not a query parameter: query strings are
   * written to proxy and server access logs and leak through the Referer of any
   * resource the page loads afterwards.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('shared/:token')
  @SchemaResponse(SharedFileAccess)
  async accessSharedLink(
    @Param('token') token: string,
    @Headers(SHARED_LINK_PASSWORD_HEADER) password?: string,
  ) {
    const access = await this.storageService.accessSharedLink(token, password);
    const { fileName, bankName, fileSize, accountNumber } = access.statement;
    // A public answer: only what the shared page shows of the file.
    return { ...access, statement: { fileName, bankName, fileSize, accountNumber } };
  }

  /**
   * Download file via shared link (public endpoint)
   * GET /api/v1/storage/shared/:token/download
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('shared/:token/download')
  async downloadSharedFile(
    @Param('token') token: string,
    @Res() res: Response,
    @Headers(SHARED_LINK_PASSWORD_HEADER) password?: string,
  ) {
    const { statement, canDownload } = await this.storageService.accessSharedLink(token, password);

    if (!canDownload) {
      res.status(HttpStatus.FORBIDDEN).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to download this file',
        },
      });
      return;
    }

    const { stream, fileName, mimeType } = await this.storageService.getSharedDownloadStream(
      statement.id,
    );

    pipeFileStreamResponse(res, stream, {
      disposition: 'attachment',
      fileName,
      mimeType,
      errorMessage: 'Failed to download file',
    });
  }

  /**
   * Grant permission to user
   * POST /api/v1/storage/files/:id/permissions
   */
  @Post('files/:id/permissions')
  async grantPermission(
    @Param('id') statementId: string,
    @CurrentUser() user: User,
    @SchemaBody(GrantPermissionBody) dto: GrantPermissionBody,
  ) {
    return await this.storageService.grantPermission(statementId, user.id, dto);
  }

  /**
   * Get permissions for a file
   * GET /api/v1/storage/files/:id/permissions
   */
  @Get('files/:id/permissions')
  async getFilePermissions(@Param('id') statementId: string, @CurrentUser() user: User) {
    return await this.storageService.getFilePermissions(statementId, user.id);
  }

  /**
   * Update permission
   * PUT /api/v1/storage/permissions/:id
   */
  @Put('permissions/:id')
  async updatePermission(
    @Param('id') permissionId: string,
    @CurrentUser() user: User,
    @SchemaBody(UpdatePermissionBody) dto: UpdatePermissionBody,
  ) {
    return await this.storageService.updatePermission(permissionId, user.id, dto);
  }

  /**
   * Revoke permission
   * DELETE /api/v1/storage/permissions/:id
   */
  @Delete('permissions/:id')
  async revokePermission(@Param('id') permissionId: string, @CurrentUser() user: User) {
    await this.storageService.revokePermission(permissionId, user.id);
    return { message: 'Permission revoked successfully' };
  }
}
