import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageService } from '../../common/services/file-storage.service';
import {
  Category,
  FilePermission,
  FileVersion,
  Folder,
  SharedLink,
  Statement,
  StorageView,
  Tag,
  Transaction,
  User,
  WorkspaceMember,
} from '../../entities';
import { MetricsService } from '../observability/metrics.service';
import { ObservabilityModule } from '../observability/observability.module';
import { StatementsModule } from '../statements/statements.module';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { StorageTrashScheduler } from './storage-trash.scheduler';

/**
 * Storage module for file management, sharing, and permissions
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SharedLink,
      FilePermission,
      FileVersion,
      Folder,
      Statement,
      Tag,
      StorageView,
      Transaction,
      Category,
      User,
      WorkspaceMember,
    ]),
    ObservabilityModule,
    StatementsModule,
  ],
  controllers: [StorageController],
  providers: [StorageService, StorageTrashScheduler, FileStorageService, MetricsService],
  exports: [StorageService],
})
export class StorageModule {}
