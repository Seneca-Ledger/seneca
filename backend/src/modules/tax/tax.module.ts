import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity';
import { TaxJurisdiction } from '../../entities/tax-jurisdiction.entity';
import { TaxJurisdictionRate } from '../../entities/tax-jurisdiction-rate.entity';
import { TaxRate } from '../../entities/tax-rate.entity';
import { TaxReturn } from '../../entities/tax-return.entity';
import { TaxRule } from '../../entities/tax-rule.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceServiceSettings } from '../../entities/workspace-service-settings.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { JurisdictionAdoptionService } from './jurisdiction-adoption.service';
import { JurisdictionsController } from './jurisdictions.controller';
import { JurisdictionsService } from './jurisdictions.service';
import { OfficialVatRatesService } from './official-vat-rates.service';
import { TaxAssignmentService } from './tax-assignment.service';
import { TaxRatesController } from './tax-rates.controller';
import { TaxRatesService } from './tax-rates.service';
import { TaxReserveService } from './tax-reserve.service';
import { TaxReturnsController } from './tax-returns.controller';
import { TaxReturnsService } from './tax-returns.service';
import { TaxRulesController } from './tax-rules.controller';
import { TaxRulesService } from './tax-rules.service';
import { TaxThresholdService } from './tax-threshold.service';
import { TransactionTaxSubscriber } from './transaction-tax.subscriber';
import { UstvaService } from './ustva/ustva.service';
import { WorkspaceTaxController } from './workspace-tax.controller';
import { WorkspaceTaxSettingsService } from './workspace-tax-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxRate,
      TaxJurisdiction,
      TaxJurisdictionRate,
      TaxRule,
      TaxReturn,
      Transaction,
      Workspace,
      WorkspaceServiceSettings,
      Category,
    ]),
    ExchangeRatesModule,
    AuditModule,
    ReferenceDataModule,
  ],
  controllers: [
    TaxRatesController,
    JurisdictionsController,
    WorkspaceTaxController,
    TaxRulesController,
    TaxReturnsController,
  ],
  providers: [
    TaxRatesService,
    JurisdictionsService,
    JurisdictionAdoptionService,
    TaxRulesService,
    TaxAssignmentService,
    TaxReturnsService,
    TaxThresholdService,
    TransactionTaxSubscriber,
    WorkspaceTaxSettingsService,
    TaxReserveService,
    OfficialVatRatesService,
    UstvaService,
  ],
  exports: [
    TaxRatesService,
    JurisdictionsService,
    JurisdictionAdoptionService,
    TaxRulesService,
    TaxAssignmentService,
    TaxReturnsService,
    TaxThresholdService,
    WorkspaceTaxSettingsService,
    TaxReserveService,
  ],
})
export class TaxModule {}
