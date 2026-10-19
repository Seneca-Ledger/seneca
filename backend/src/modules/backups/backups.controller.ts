import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  BackupConfiguration,
  BackupImportBody,
  BackupImportPreview,
  BackupRestoreResult,
  BackupRunList,
  UpdateBackupConfigurationBody,
} from '../../contracts';
import { BackupDestinationKind, BackupRunTrigger } from '../../entities';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BackupImportService } from './backup-import.service';
import { BackupsService } from './backups.service';

type MulterFile = Express.Multer.File;

// FileInterceptor defaults to memory storage with no cap, so the whole body was
// buffered before any handler ran. Backups are larger than ordinary uploads
// (which cap at 10MB via multerConfig) but still need a ceiling.
const BACKUP_UPLOAD_OPTIONS = { limits: { fileSize: 200 * 1024 * 1024 } };
// Opening an archive unpacks and decrypts it in memory, and any signed-in
// account may upload one, workspace or not.
const BACKUP_IMPORT_THROTTLE = { default: { limit: 5, ttl: 60000 } };

@Controller('backups')
@UseGuards(JwtAuthGuard)
export class BackupsController {
  constructor(
    private readonly backupsService: BackupsService,
    private readonly importService: BackupImportService,
  ) {}

  @Get('config')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(BackupConfiguration)
  getConfiguration(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.backupsService.getConfiguration(user, workspaceId);
  }

  @Put('config')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(BackupConfiguration)
  configure(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateBackupConfigurationBody) body: UpdateBackupConfigurationBody,
  ) {
    return this.backupsService.configure(user, workspaceId, {
      ...body,
      destinationKind: toEnum(BackupDestinationKind, body.destinationKind),
    });
  }

  @Get('runs')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(BackupRunList)
  listRuns(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.backupsService.listRuns(user, workspaceId);
  }

  @Post('runs')
  @UseGuards(WorkspaceContextGuard)
  createRun(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.backupsService.createRun(user, workspaceId, BackupRunTrigger.MANUAL);
  }

  @Get('runs/:id/download')
  @UseGuards(WorkspaceContextGuard)
  async downloadRun(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Res() response: Response,
  ): Promise<void> {
    const { fileName, contents } = await this.backupsService.downloadRun(user, workspaceId, id);
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    response.send(contents);
  }

  @Post('import/preview')
  @Throttle(BACKUP_IMPORT_THROTTLE)
  @UseInterceptors(FileInterceptor('file', BACKUP_UPLOAD_OPTIONS))
  @SchemaResponse(BackupImportPreview)
  previewImport(
    @CurrentUser() user: User,
    @UploadedFile() file: MulterFile | undefined,
    @SchemaBody(BackupImportBody) body: BackupImportBody,
  ) {
    return this.importService.preview(user, this.requiredFile(file), body.password);
  }

  @Post('imports/:id/restore')
  @Throttle(BACKUP_IMPORT_THROTTLE)
  @UseInterceptors(FileInterceptor('file', BACKUP_UPLOAD_OPTIONS))
  @SchemaResponse(BackupRestoreResult)
  async restoreImport(
    @Param('id') importId: string,
    @CurrentUser() user: User,
    @UploadedFile() file: MulterFile | undefined,
    @SchemaBody(BackupImportBody) body: BackupImportBody,
  ) {
    const workspace = await this.importService.restore(
      importId,
      user,
      this.requiredFile(file),
      body.password,
      body.workspaceName ?? undefined,
    );
    return { workspaceId: workspace.id, workspaceName: workspace.name };
  }

  private requiredFile(file: MulterFile | undefined): Buffer {
    if (!file?.buffer?.length) throw new BadRequestException('Backup file is required');
    return file.buffer;
  }
}
