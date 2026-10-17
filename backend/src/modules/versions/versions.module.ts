import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Workspace, WorkspaceMember, WorkspaceVersion } from '../../entities';
import { BackupsModule } from '../backups/backups.module';
import { VersionSchedulerService } from './version-scheduler.service';
import { VersionSnapshotService } from './version-snapshot.service';
import { VersionsController } from './versions.controller';
import { VersionsService } from './versions.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Workspace, WorkspaceMember, WorkspaceVersion]), BackupsModule],
  controllers: [VersionsController],
  providers: [VersionSchedulerService, VersionSnapshotService, VersionsService],
})
export class VersionsModule {}
