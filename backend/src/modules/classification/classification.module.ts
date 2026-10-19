import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch, User, WorkspaceMember } from '../../entities';
import { CategorizationRule } from '../../entities/categorization-rule.entity';
import { Category } from '../../entities/category.entity';
import { Payee } from '../../entities/payee.entity';
import { PayeeAlias } from '../../entities/payee-alias.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditModule } from '../audit/audit.module';
import { CategorizationRulesController } from './categorization-rules.controller';
import { ClassificationController } from './classification.controller';
import { ClassificationService } from './services/classification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Payee,
      PayeeAlias,
      Branch,
      Wallet,
      Transaction,
      CategorizationRule,
      WorkspaceMember,
      Workspace,
      User,
    ]),
    AuditModule,
  ],
  controllers: [ClassificationController, CategorizationRulesController],
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
