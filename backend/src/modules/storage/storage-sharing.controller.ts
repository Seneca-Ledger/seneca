import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Post,
  Put,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HideInternalColumnsInterceptor } from '../../common/interceptors/hide-internal-columns.interceptor';
import { deletedResponse } from '../../common/utils/responses.util';
import { pipeFileStreamResponse } from '../../common/utils/stream-response.util';
import {
  CreateSharedLinkBody,
  GrantPermissionBody,
  MessageResult,
  SharedFileAccess,
  SharedLinkItem,
  SharedLinkTokenParams,
  StorageIdParams,
  UpdatePermissionBody,
  UpdateSharedLinkBody,
} from '../../contracts';
import {
  CreatedSharedLink,
  FilePermissionList,
  FilePermissionRecord,
  SharedLinkList,
} from '../../contracts/storage/storage-actions';
import type { SharedLink } from '../../entities/shared-link.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { StorageService } from './storage.service';

/** Lowercase: Nest matches @Headers() names case-insensitively, but this is the wire name. */
export const SHARED_LINK_PASSWORD_HEADER = 'x-share-password';

/** The record's uuid in `:id`, for every route below that has one. */
const StorageId = () => SchemaParams(StorageIdParams);

/** A link as the owner reads it: the password masked, never its hash, and every column there. */
const answerLink = (link: SharedLink) => ({
  ...link,
  password: link.password ? '******' : null,
  description: link.description ?? null,
  lastAccessedAt: link.lastAccessedAt ?? null,
});

/**
 * Shared links and per-member permissions of stored files: who may see a
 * file, and the public page a link opens.
 */
@Controller('storage')
@UseGuards(JwtAuthGuard)
@UseInterceptors(HideInternalColumnsInterceptor)
export class StorageSharingController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Create shared link for a file
   * POST /api/v1/storage/files/:id/share
   */
  @Post('files/:id/share')
  @SchemaResponse(CreatedSharedLink)
  async createSharedLink(
    @StorageId() { id: statementId }: StorageIdParams,
    @CurrentUser() user: User,
    @SchemaBody(CreateSharedLinkBody) dto: CreateSharedLinkBody,
  ) {
    const link = await this.storageService.createSharedLink(statementId, user.id, dto);

    // Generate full URL for the shared link
    const shareUrl = `${process.env.FRONTEND_URL}/shared/${link.token}`;

    return { ...answerLink(link), shareUrl };
  }

  /**
   * Get shared links for a file
   * GET /api/v1/storage/files/:id/shares
   */
  @Get('files/:id/shares')
  @SchemaResponse(SharedLinkList)
  async getSharedLinks(@StorageId() { id }: StorageIdParams, @CurrentUser() user: User) {
    return await this.storageService.getSharedLinks(id, user.id);
  }

  /**
   * Update shared link
   * PUT /api/v1/storage/shares/:id
   */
  @Put('shares/:id')
  @SchemaResponse(SharedLinkItem)
  async updateSharedLink(
    @StorageId() { id: linkId }: StorageIdParams,
    @CurrentUser() user: User,
    @SchemaBody(UpdateSharedLinkBody) dto: UpdateSharedLinkBody,
  ) {
    // Masked like every other answer about a link: the row holds the password's hash.
    return answerLink(await this.storageService.updateSharedLink(linkId, user.id, dto));
  }

  /**
   * Delete shared link
   * DELETE /api/v1/storage/shares/:id
   */
  @Delete('shares/:id')
  @SchemaResponse(MessageResult)
  async deleteSharedLink(@StorageId() { id: linkId }: StorageIdParams, @CurrentUser() user: User) {
    await this.storageService.deleteSharedLink(linkId, user.id);
    return deletedResponse('Shared link');
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
    @SchemaParams(SharedLinkTokenParams) { token }: SharedLinkTokenParams,
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
    @SchemaParams(SharedLinkTokenParams) { token }: SharedLinkTokenParams,
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
  @SchemaResponse(FilePermissionRecord)
  async grantPermission(
    @StorageId() { id: statementId }: StorageIdParams,
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
  @SchemaResponse(FilePermissionList)
  async getFilePermissions(@StorageId() { id }: StorageIdParams, @CurrentUser() user: User) {
    return await this.storageService.getFilePermissions(id, user.id);
  }

  /**
   * Update permission
   * PUT /api/v1/storage/permissions/:id
   */
  @Put('permissions/:id')
  @SchemaResponse(FilePermissionRecord)
  async updatePermission(
    @StorageId() { id: permissionId }: StorageIdParams,
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
  @SchemaResponse(MessageResult)
  async revokePermission(@StorageId() { id }: StorageIdParams, @CurrentUser() user: User) {
    await this.storageService.revokePermission(id, user.id);
    return { message: 'Permission revoked successfully' };
  }
}
