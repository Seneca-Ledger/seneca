import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch, User, WorkspaceMember } from '../../entities';
import { CategorizationRule } from '../../entities/categorization-rule.entity';
import { Category } from '../../entities/category.entity';
import { Payee } from '../../entities/payee.entity';
import { PayeeAlias } from '../../entities/payee-alias.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditModule } from '../audit/audit.module';
import { TaxModule } from '../tax/tax.module';
import { CategorizationRuleToolsController } from './categorization-rule-tools.controller';
import { CategorizationRulesController } from './categorization-rules.controller';
import { ClassificationController } from './classification.controller';
import { ClassificationService } from './services/classification.service';
import { RuleApplicationService } from './services/rule-application.service';
import { RuleOrderService } from './services/rule-order.service';
import { RuleSuggestionsService } from './services/rule-suggestions.service';
import { PayeeLearningService } from './suggestions/payee-learning.service';
import { PayeeLearningSubscriber } from './suggestions/payee-learning.subscriber';
import { StatementSuggestionsController } from './suggestions/statement-suggestions.controller';
import { StatementSuggestionsService } from './suggestions/statement-suggestions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Payee,
      PayeeAlias,
      Branch,
      Wallet,
      Transaction,
      Statement,
      Receipt,
      CategorizationRule,
      WorkspaceMember,
      Workspace,
      User,
    ]),
    AuditModule,
    TaxModule,
  ],
  // The tools controller first: its `/order` and `/suggestions` are not ids.
  controllers: [
    ClassificationController,
    CategorizationRuleToolsController,
    CategorizationRulesController,
    StatementSuggestionsController,
  ],
  providers: [
    ClassificationService,
    RuleApplicationService,
    RuleOrderService,
    RuleSuggestionsService,
    StatementSuggestionsService,
    PayeeLearningService,
    PayeeLearningSubscriber,
  ],
  exports: [ClassificationService],
})
export class ClassificationModule {}
