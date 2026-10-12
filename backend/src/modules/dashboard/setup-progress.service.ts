import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { Budget } from '../../entities/budget.entity';
import { CategorizationRule } from '../../entities/categorization-rule.entity';
import { Category, CategorySource } from '../../entities/category.entity';
import { Goal } from '../../entities/goal.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';

/** Which first steps a workspace has taken; drives the dashboard's Getting Started checklist. */
export interface SetupProgress {
  hasUpload: boolean;
  hasCustomCategories: boolean;
  hasBudget: boolean;
  hasGoal: boolean;
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
  ) {}

  async getSetupProgress(workspaceId: string): Promise<SetupProgress> {
    // Receipts count too: a scan-only user never has a statement, and the
    // dashboard's lastUploadDate looks at statements alone.
    const [statement, receipt, userCategory, rule, budget, goal] = await Promise.all([
      this.statementRepo.exists({ where: { workspaceId, deletedAt: IsNull() } }),
      this.receiptRepo.exists({ where: { workspaceId } }),
      this.categoryRepo.exists({ where: { workspaceId, source: CategorySource.USER } }),
      this.ruleRepo.exists({ where: { workspaceId } }),
      this.budgetRepo.exists({ where: { workspaceId } }),
      this.goalRepo.exists({ where: { workspaceId } }),
    ]);
    return {
      hasUpload: statement || receipt,
      hasCustomCategories: userCategory || rule,
      hasBudget: budget,
      hasGoal: goal,
    };
  }
}
