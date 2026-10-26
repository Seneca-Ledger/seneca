import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from '../../entities/import-batch.entity';
import { ImportMappingProfile } from '../../entities/import-mapping-profile.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { ClassificationModule } from '../classification/classification.module';
import { InvestmentsModule } from '../investments/investments.module';
import { EntityImportService } from './entity-import.service';
import { EntityImportsController } from './entity-imports.controller';
import { ImportMappingProfilesController } from './import-mapping-profiles.controller';
import { ImportMappingProfilesService } from './import-mapping-profiles.service';
import { ImportSuggestService } from './import-suggest.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportBatch, ImportMappingProfile, WorkspaceMember]),
    AuditModule,
    ClassificationModule,
    // For the metals target: the account its lots sit on, and their prices.
    InvestmentsModule,
  ],
  controllers: [EntityImportsController, ImportMappingProfilesController],
  providers: [EntityImportService, ImportMappingProfilesService, ImportSuggestService],
})
export class EntityImportsModule {}
