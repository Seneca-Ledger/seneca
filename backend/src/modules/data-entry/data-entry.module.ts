import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { User, WorkspaceMember } from '../../entities';
import { DataEntry } from '../../entities/data-entry.entity';
import { DataEntryCustomField } from '../../entities/data-entry-custom-field.entity';
import { IdempotencyKey } from '../../entities/idempotency-key.entity';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { DataEntryController } from './data-entry.controller';
import { DataEntryService } from './data-entry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataEntry,
      DataEntryCustomField,
      User,
      WorkspaceMember,
      IdempotencyKey,
    ]),
    WorkspaceCurrencyModule,
  ],
  controllers: [DataEntryController],
  providers: [DataEntryService, IdempotencyService],
  exports: [DataEntryService],
})
export class DataEntryModule {}
