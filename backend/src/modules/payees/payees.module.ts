import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity';
import { Payee } from '../../entities/payee.entity';
import { PayeeAlias } from '../../entities/payee-alias.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { ClassificationModule } from '../classification/classification.module';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { TaxModule } from '../tax/tax.module';
import { PayeesController } from './payees.controller';
import { PayeesService } from './payees.service';
import { TransactionPayeeSubscriber } from './transaction-payee.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payee, PayeeAlias, Category, Transaction, User, WorkspaceMember]),
    AuditModule,
    ClassificationModule,
    TaxModule,
    ReferenceDataModule,
  ],
  controllers: [PayeesController],
  providers: [PayeesService, TransactionPayeeSubscriber],
  exports: [PayeesService],
})
export class PayeesModule {}
