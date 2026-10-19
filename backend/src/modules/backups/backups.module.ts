import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageService } from '../../common/services/file-storage.service';
import {
  BackupConfiguration,
  BackupRun,
  Integration,
  Statement,
  Workspace,
  WorkspaceMember,
} from '../../entities';
import { AuditModule } from '../audit/audit.module';
import { BackupArchiveService } from './backup-archive.service';
import { BackupDataService } from './backup-data.service';
import { BackupDestinationService } from './backup-destination.service';
import { BackupImportService } from './backup-import.service';
import { BackupKeyService } from './backup-key.service';
import { BackupRestoreService } from './backup-restore.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BackupConfiguration,
      BackupRun,
      Integration,
      Statement,
      Workspace,
      WorkspaceMember,
    ]),
    AuditModule,
  ],
  controllers: [BackupsController],
  providers: [
    { provide: 'BACKUP_LOCAL_ROOT', useFactory: () => process.env.BACKUP_LOCAL_ROOT },
    BackupArchiveService,
    BackupDataService,
    BackupDestinationService,
    {
      provide: BackupKeyService,
      useFactory: () => new BackupKeyService(),
    },
    BackupImportService,
    BackupRestoreService,
    BackupSchedulerService,
    BackupsService,
    FileStorageService,
  ],
  // Workspace versions are taken and opened with the same collect and restore.
  exports: [BackupDataService, BackupKeyService, BackupRestoreService],
})
export class BackupsModule {}
