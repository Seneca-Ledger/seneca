import { Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  BrowseOptionList,
  ImportFilesBody,
  IntegrationConnection,
  IntegrationDisconnected,
  ListImapFoldersBody,
  ProtocolFileList,
  ProtocolImportResult,
  ProtocolSyncResult,
  SaveImapSettingsBody,
  SaveS3SettingsBody,
  SaveWebdavSettingsBody,
} from '../../contracts';
import { IntegrationProvider } from '../../entities';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OpenProtocolIntegrationsService } from './open-protocol-integrations.service';

@Controller('integrations')
export class OpenProtocolIntegrationsController {
  constructor(private readonly openProtocolIntegrationsService: OpenProtocolIntegrationsService) {}

  @Get('s3-compatible/status')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(IntegrationConnection)
  s3Status(@WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.s3Status(workspaceId);
  }

  @Post('s3-compatible/settings')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(IntegrationConnection)
  saveS3Settings(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveS3SettingsBody) body: SaveS3SettingsBody,
  ) {
    return this.openProtocolIntegrationsService.saveS3Settings(user, workspaceId, {
      endpoint: this.stringValue(body.endpoint),
      region: this.stringValue(body.region),
      bucket: this.stringValue(body.bucket),
      prefix: this.stringValue(body.prefix),
      accessKeyId: this.stringValue(body.accessKeyId),
      secretAccessKey: this.stringValue(body.secretAccessKey),
      forcePathStyle: this.booleanValue(body.forcePathStyle),
      autoBackup: this.booleanValue(body.autoBackup),
    });
  }

  @Get('s3-compatible/files')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(ProtocolFileList)
  listS3Files(@WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.listS3Files(workspaceId);
  }

  @Post('s3-compatible/import')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(ProtocolImportResult)
  importS3Files(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ImportFilesBody) body: ImportFilesBody,
  ) {
    return this.openProtocolIntegrationsService.importS3Files(
      user,
      workspaceId,
      this.getFileIds(body),
    );
  }

  @Post('s3-compatible/sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(ProtocolSyncResult)
  syncS3(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.syncS3(user, workspaceId);
  }

  @Delete('s3-compatible')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(IntegrationDisconnected)
  disconnectS3(@WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.disconnect(
      workspaceId,
      IntegrationProvider.S3_COMPATIBLE,
    );
  }

  @Get('webdav/status')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(IntegrationConnection)
  webdavStatus(@WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.webdavStatus(workspaceId);
  }

  @Post('webdav/settings')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(IntegrationConnection)
  saveWebdavSettings(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveWebdavSettingsBody) body: SaveWebdavSettingsBody,
  ) {
    return this.openProtocolIntegrationsService.saveWebdavSettings(user, workspaceId, {
      url: this.stringValue(body.url),
      rootPath: this.stringValue(body.rootPath),
      username: this.stringValue(body.username),
      password: this.stringValue(body.password),
    });
  }

  @Get('webdav/files')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(ProtocolFileList)
  listWebdavFiles(@WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.listWebdavFiles(workspaceId);
  }

  @Post('webdav/import')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(ProtocolImportResult)
  importWebdavFiles(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ImportFilesBody) body: ImportFilesBody,
  ) {
    return this.openProtocolIntegrationsService.importWebdavFiles(
      user,
      workspaceId,
      this.getFileIds(body),
    );
  }

  @Post('webdav/sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(ProtocolSyncResult)
  syncWebdav(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.syncWebdav(user, workspaceId);
  }

  @Delete('webdav')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(IntegrationDisconnected)
  disconnectWebdav(@WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.disconnect(workspaceId, IntegrationProvider.WEBDAV);
  }

  @Get('imap/status')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(IntegrationConnection)
  imapStatus(@WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.imapStatus(workspaceId);
  }

  @Post('imap/settings')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(IntegrationConnection)
  saveImapSettings(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveImapSettingsBody) body: SaveImapSettingsBody,
  ) {
    return this.openProtocolIntegrationsService.saveImapSettings(user, workspaceId, {
      host: this.stringValue(body.host),
      port: this.numberValue(body.port),
      secure: this.booleanValue(body.secure),
      mailbox: this.stringValue(body.mailbox),
      user: this.stringValue(body.user),
      pass: this.stringValue(body.pass),
    });
  }

  @Post('imap/folders')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BrowseOptionList)
  listImapFolders(@SchemaBody(ListImapFoldersBody) body: ListImapFoldersBody) {
    return this.openProtocolIntegrationsService.listImapFolders({
      host: this.stringValue(body.host) ?? '',
      port: this.numberValue(body.port) ?? 993,
      secure: this.booleanValue(body.secure) ?? true,
      user: this.stringValue(body.user) ?? '',
      pass: this.stringValue(body.pass) ?? '',
    });
  }

  @Post('imap/sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(ProtocolSyncResult)
  syncImap(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.syncImap(user, workspaceId);
  }

  @Delete('imap')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(IntegrationDisconnected)
  disconnectImap(@WorkspaceId() workspaceId: string) {
    return this.openProtocolIntegrationsService.disconnect(workspaceId, IntegrationProvider.IMAP);
  }

  private getFileIds(body: { fileIds?: string[] | null }): string[] {
    return Array.isArray(body?.fileIds) ? body.fileIds.filter(Boolean) : [];
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private booleanValue(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }

  private numberValue(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
}
