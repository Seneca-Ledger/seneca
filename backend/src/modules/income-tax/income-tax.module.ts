import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity';
import { IncomeTaxDisclaimerAcceptance } from '../../entities/income-tax-disclaimer-acceptance.entity';
import { IncomeTaxLineMapping } from '../../entities/income-tax-line-mapping.entity';
import { IncomeTaxProfile } from '../../entities/income-tax-profile.entity';
import { IncomeTaxReturn } from '../../entities/income-tax-return.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { TaxModule } from '../tax/tax.module';
import { BdiRatesService } from './bdi-rates.service';
import { IncomeTaxController } from './income-tax.controller';
import { IncomeTaxCompletenessService } from './income-tax-completeness.service';
import { IncomeTaxDisclaimerService } from './income-tax-disclaimer.service';
import { IncomeTaxDraftService } from './income-tax-draft.service';
import { IncomeTaxReturnsService } from './income-tax-returns.service';
import { NbpRatesService } from './nbp-rates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IncomeTaxProfile,
      IncomeTaxLineMapping,
      IncomeTaxReturn,
      IncomeTaxDisclaimerAcceptance,
      Category,
      Transaction,
      Statement,
      Receipt,
    ]),
    TaxModule,
    ExchangeRatesModule,
    AuditModule,
    ReferenceDataModule,
  ],
  controllers: [IncomeTaxController],
  providers: [
    IncomeTaxDraftService,
    IncomeTaxCompletenessService,
    IncomeTaxReturnsService,
    IncomeTaxDisclaimerService,
    NbpRatesService,
    BdiRatesService,
  ],
})
export class IncomeTaxModule {}
