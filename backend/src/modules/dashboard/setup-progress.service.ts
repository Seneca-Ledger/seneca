import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { Budget } from '../../entities/budget.entity';
import { CategorizationRule } from '../../entities/categorization-rule.entity';
import { Category, CategorySource } from '../../entities/category.entity';
import { Goal } from '../../entities/goal.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import type { User } from '../../entities/user.entity';
import { ApplicationSettingsService } from '../application-settings/application-settings.service';
import { telegramConnectionOf } from '../telegram/telegram-connection.util';

/** Which first steps a workspace has taken; drives the dashboard's Getting Started checklist. */
export interface SetupProgress {
  hasUpload: boolean;
  hasCustomCategories: boolean;
  hasBudget: boolean;
  hasGoal: boolean;
  /** A bot serves this workspace (its own or the shared one), so connecting Telegram is a step. */
  telegramAvailable: boolean;
  /** The person's chat is connected to this workspace. */
  hasTelegram: boolean;
}

@Injectable()
export class SetupProgressService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepo: Repository<Statement>,
    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(CategorizationRule)
    private readonly ruleRepo: Repository<CategorizationRule>,
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
    @Optional()
    private readonly applicationSettingsService?: ApplicationSettingsService,
  ) {}

  async getSetupProgress(workspaceId: string, user: User): Promise<SetupProgress> {
    // Receipts count too: a scan-only user never has a statement, and the
    // dashboard's lastUploadDate looks at statements alone.
    const [statement, receipt, userCategory, rule, budget, goal, telegram] = await Promise.all([
      this.statementRepo.exists({ where: { workspaceId, deletedAt: IsNull() } }),
      this.receiptRepo.exists({ where: { workspaceId } }),
      this.categoryRepo.exists({ where: { workspaceId, source: CategorySource.USER } }),
      this.ruleRepo.exists({ where: { workspaceId } }),
      this.budgetRepo.exists({ where: { workspaceId } }),
      this.goalRepo.exists({ where: { workspaceId } }),
      this.applicationSettingsService?.getTelegramSettings(user, workspaceId),
    ]);
    return {
      hasUpload: statement || receipt,
      hasCustomCategories: userCategory || rule,
      hasBudget: budget,
      hasGoal: goal,
      telegramAvailable: Boolean(telegram?.botToken),
      hasTelegram: telegramConnectionOf(user, workspaceId).inThisWorkspace,
    };
  }
}
