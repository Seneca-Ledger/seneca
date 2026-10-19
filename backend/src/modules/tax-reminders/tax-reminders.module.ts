import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncomeTaxProfile } from '../../entities/income-tax-profile.entity';
import { IncomeTaxReturn } from '../../entities/income-tax-return.entity';
import { TaxReturn } from '../../entities/tax-return.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceServiceSettings } from '../../entities/workspace-service-settings.entity';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { TaxModule } from '../tax/tax.module';
import { TaxDeadlinesController } from './tax-deadlines.controller';
import { TaxDeadlinesService } from './tax-deadlines.service';

/**
 * Due dates of VAT and income-tax returns, and the daily reminder sweep.
 * Its own module because it reads both the VAT returns (tax) and the income
 * tax returns, and income-tax already imports tax.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workspace,
      TaxReturn,
      IncomeTaxReturn,
      IncomeTaxProfile,
      WorkspaceServiceSettings,
    ]),
    TaxModule,
    ReferenceDataModule,
  ],
  controllers: [TaxDeadlinesController],
  providers: [TaxDeadlinesService],
  exports: [TaxDeadlinesService],
})
export class TaxRemindersModule {}
