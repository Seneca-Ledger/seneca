import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from '../../entities/import-batch.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { ApplicationSettingsModule } from '../application-settings/application-settings.module';
import { AuditModule } from '../audit/audit.module';
import { ClassificationModule } from '../classification/classification.module';
import { InvestmentsModule } from '../investments/investments.module';
import { EntityImportService } from './entity-import.service';
import { EntityImportsController } from './entity-imports.controller';
import { ImportSuggestService } from './import-suggest.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportBatch, WorkspaceMember]),
    AuditModule,
    ClassificationModule,
    ApplicationSettingsModule,
    // For the metals target: the account its lots sit on, and their prices.
    InvestmentsModule,
  ],
  controllers: [EntityImportsController],
  providers: [EntityImportService, ImportSuggestService],
})
export class EntityImportsModule {}
