import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { assertFound } from '../../common/utils/assert-found.util';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Budget, BudgetRolloverMode } from '../../entities/budget.entity';
import { Category } from '../../entities/category.entity';
import { Goal } from '../../entities/goal.entity';
import {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import {
  clampToWindow,
  computePeriodRange,
  overlapsWindow,
  parseDateOnly,
} from './budget-period.util';
import { percentOf, resolveAvailable } from './budget-rollover.util';
import type { BudgetImpactQueryDto } from './dto/budget-impact-query.dto';
import type { CreateBudgetDto } from './dto/create-budget.dto';
import type { UpdateBudgetDto } from './dto/update-budget.dto';

export interface BudgetWithSpending extends Budget {
  spentAmount: number;
  percentUsed: number;
  /** What the period has to spend once rollover is settled; equals the limit without rollover. */
  availableAmount: number;
  /** availableAmount minus the limit: positive = leftover carried in, negative = overspend carried in. */
  carriedAmount: number;
  /** Whether today falls inside the budget's window. Always true for open-ended ones. */
  isActive: boolean;
}

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    @Optional()
    @InjectRepository(Category)
    private readonly categoryRepository?: Repository<Category>,
    @Optional()
    @InjectRepository(Wallet)
    private readonly walletRepository?: Repository<Wallet>,
    @Optional()
    private readonly exchangeRatesService?: ExchangeRatesService,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreateBudgetDto): Promise<Budget> {
    const goalId = dto.goalId ?? null;

    // Scoped by goal as well as category: the household grocery limit and the
    // "food during the move" limit are different intents over the same
    // category, and only a second *unattached* budget is still a duplicate.
    const existing = await this.budgetRepository.findOne({
      where: {
        workspaceId,
        categoryId: dto.categoryId,
        periodType: dto.periodType,
        goalId,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Budget for this category with period "${dto.periodType}" already exists`,
      );
    }

    assertWindowOrdered(dto.startsOn, dto.endsOn);
    await this.assertGoalInWorkspace(dto.goalId, workspaceId);

    const { start } = computePeriodRange(dto.periodType, new Date());

    const budget = this.budgetRepository.create({
      workspaceId,
      createdById: userId,
      name: dto.name,
      categoryId: dto.categoryId,
      limitAmount: dto.limitAmount,
      currency: await this.workspaceCurrency.resolveFor(workspaceId, dto.currency),
      periodType: dto.periodType,
      rolloverMode: dto.rolloverMode ?? BudgetRolloverMode.NONE,
      currentPeriodStart: start,
      goalId,
      startsOn: dto.startsOn ?? null,
      endsOn: dto.endsOn ?? null,
    });

    const saved = await this.budgetRepository.save(budget);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.BUDGET,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: budgetSnapshot(saved) },
      meta: { categoryId: saved.categoryId, goalId: saved.goalId ?? null },
    });
    return saved;
  }

  async findAll(workspaceId: string): Promise<BudgetWithSpending[]> {
    const budgets = await this.budgetRepository.find({
      where: { workspaceId },
      relations: ['category'],
      order: { name: 'ASC' },
    });

    return Promise.all(budgets.map(budget => this.attachSpending(budget)));
  }

  async findOne(id: string, workspaceId: string): Promise<BudgetWithSpending> {
    const budget = await this.budgetRepository.findOne({
      where: { id, workspaceId },
      relations: ['category'],
    });
    assertFound(budget, 'Budget');
    return this.attachSpending(budget);
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    dto: UpdateBudgetDto,
  ): Promise<Budget> {
    const budget = await this.budgetRepository.findOne({
      where: { id, workspaceId },
    });
    assertFound(budget, 'Budget');
    assertWindowOrdered(
      dto.startsOn === undefined ? budget.startsOn : dto.startsOn,
      dto.endsOn === undefined ? budget.endsOn : dto.endsOn,
    );
    await this.assertGoalInWorkspace(dto.goalId, workspaceId);
    const before = budgetSnapshot(budget);
    Object.assign(budget, dto);
    const saved = await this.budgetRepository.save(budget);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.BUDGET,
      entityId: id,
      action: AuditAction.UPDATE,
      diff: { before, after: budgetSnapshot(saved) },
      meta: { name: saved.name },
    });
    return saved;
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const budget = await this.budgetRepository.findOne({
      where: { id, workspaceId },
    });
    assertFound(budget, 'Budget');
    const before = budgetSnapshot(budget);
    await this.budgetRepository.remove(budget);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.BUDGET,
      entityId: id,
      action: AuditAction.DELETE,
      diff: { before, after: null },
      meta: { categoryId: before.categoryId, goalId: before.goalId },
    });
  }

  async getTopBudgets(workspaceId: string, limit = 5): Promise<BudgetWithSpending[]> {
    const all = await this.findAll(workspaceId);
    return all.sort((a, b) => b.percentUsed - a.percentUsed).slice(0, limit);
  }

  async checkBudgetAlerts(workspaceId: string, categoryId?: string): Promise<void> {
    const where: Record<string, unknown> = { workspaceId };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const budgets = await this.budgetRepository.find({
      where: where as any,
      relations: ['category'],
    });

    for (const budget of budgets) {
      // A budget outside its window governs nothing right now, so it must not
      // warn: a project budget that ended in August should go quiet, not fire
      // every month afterwards on spending it no longer covers.
      const period = clampToWindow(computePeriodRange(budget.periodType, new Date()), budget);
      if (!period) {
        continue;
      }
      const { spentAmount, percentUsed } = await this.measure(budget, new Date());

      if (percentUsed >= 100 && !budget.alertAt100Sent) {
        budget.alertAt100Sent = true;
        await this.budgetRepository.save(budget);
        await this.notificationsService.createForWorkspaceMembers({
          workspaceId,
          type: NotificationType.BUDGET_EXCEEDED,
          category: NotificationCategory.WORKSPACE_ACTIVITY,
          severity: NotificationSeverity.ERROR,
          messageKey: 'budget.exceeded',
          messageParams: { budgetName: budget.name, percentUsed: Math.round(percentUsed) },
          entityType: 'budget',
          entityId: budget.id,
          meta: {
            budgetId: budget.id,
            categoryId: budget.categoryId,
            categoryName: budget.category?.name,
            limitAmount: budget.limitAmount,
            spentAmount,
            percentUsed: Math.round(percentUsed),
          },
        });
      } else if (percentUsed >= 80 && !budget.alertAt80Sent) {
        budget.alertAt80Sent = true;
        await this.budgetRepository.save(budget);
        await this.notificationsService.createForWorkspaceMembers({
          workspaceId,
          type: NotificationType.BUDGET_WARNING,
          category: NotificationCategory.WORKSPACE_ACTIVITY,
          severity: NotificationSeverity.WARN,
          messageKey: 'budget.warning',
          messageParams: { budgetName: budget.name, percentUsed: Math.round(percentUsed) },
          entityType: 'budget',
          entityId: budget.id,
          meta: {
            budgetId: budget.id,
            categoryId: budget.categoryId,
            categoryName: budget.category?.name,
            limitAmount: budget.limitAmount,
            spentAmount,
            percentUsed: Math.round(percentUsed),
          },
        });
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetPeriodAlertFlags(): Promise<void> {
    const budgets = await this.budgetRepository.find({
      where: [{ alertAt80Sent: true }, { alertAt100Sent: true }],
    });

    const now = new Date();
    let resetCount = 0;

    for (const budget of budgets) {
      const { start } = computePeriodRange(budget.periodType, now);
      const currentStart = new Date(budget.currentPeriodStart);

      if (start.getTime() > currentStart.getTime()) {
        budget.currentPeriodStart = start;
        budget.alertAt80Sent = false;
        budget.alertAt100Sent = false;
        await this.budgetRepository.save(budget);
        resetCount++;
      }
    }

    if (resetCount > 0) {
      this.logger.log(`Reset alert flags for ${resetCount} budgets (new period)`);
    }
  }

  /** The audit trail is a side record: failing to write it must not fail the budget change. */
  private async audit(event: CreateAuditEventDto): Promise<void> {
    try {
      await this.auditService.createEvent(event);
    } catch (error) {
      this.logger.warn(
        `Failed to record audit event ${event.action} for budget ${event.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * A budget may only point at a goal of its own workspace. Nothing else in
   * this module cross-checks a foreign id, and `update` assigns the DTO blindly,
   * so without this a crafted `goalId` would link across tenants.
   *
   * Soft-deleted goals are excluded by TypeORM's default scope, so an archived
   * goal cannot be attached either.
   */
  private async assertGoalInWorkspace(
    goalId: string | null | undefined,
    workspaceId: string,
  ): Promise<void> {
    if (!goalId) {
      return;
    }
    const goal = await this.goalRepository.findOne({ where: { id: goalId, workspaceId } });
    assertFound(goal, 'Goal');
  }

  private async attachSpending(budget: Budget): Promise<BudgetWithSpending> {
    const now = new Date();
    const measured = await this.measure(budget, now);
    return Object.assign(budget, {
      ...measured,
      isActive: overlapsWindow({ start: now, end: now }, budget),
    });
  }

  /**
   * Spending, the amount available and the percentage for the period `now`
   * falls in. Clamped rather than skipped: a budget that started on the 10th
   * reports the part of the month it actually governs, and one whose window
   * has closed reports nothing instead of the whole month's spending against a
   * limit that no longer applies. A budget on a parent category counts its
   * subcategories too.
   */
  private async measure(
    budget: Budget,
    now: Date,
  ): Promise<
    Pick<BudgetWithSpending, 'spentAmount' | 'percentUsed' | 'availableAmount' | 'carriedAmount'>
  > {
    const limitAmount = Number(budget.limitAmount);
    const range = computePeriodRange(budget.periodType, now);
    const period = clampToWindow(range, budget);
    if (!period) {
      return { spentAmount: 0, percentUsed: 0, availableAmount: limitAmount, carriedAmount: 0 };
    }
    const categoryIds = await this.categoryIdsFor(budget.workspaceId, budget.categoryId);
    const spentAmount = await this.computeSpending(
      budget.workspaceId,
      categoryIds,
      period.start,
      period.end,
    );
    const previousSpent =
      budget.rolloverMode && budget.rolloverMode !== BudgetRolloverMode.NONE
        ? await this.previousPeriodsSpent(budget, categoryIds, range.start)
        : [];
    const { carriedAmount, availableAmount } = resolveAvailable(
      limitAmount,
      budget.rolloverMode,
      previousSpent,
    );
    return {
      spentAmount: Math.round(spentAmount * 100) / 100,
      percentUsed: percentOf(spentAmount, availableAmount),
      availableAmount,
      carriedAmount,
    };
  }

  /** How many settled periods rollover looks back on; a year of months, a quarter of weeks. */
  private static readonly ROLLOVER_LOOKBACK = 12;

  /**
   * Spending per previous period, oldest first, since the budget began (its
   * window start, else its creation) and at most ROLLOVER_LOOKBACK periods back.
   */
  private async previousPeriodsSpent(
    budget: Budget,
    categoryIds: string[],
    currentStart: Date,
  ): Promise<number[]> {
    const began = budget.startsOn
      ? parseDateOnly(budget.startsOn)
      : budget.createdAt
        ? new Date(budget.createdAt)
        : currentStart;
    const periods: Array<{ start: Date; end: Date }> = [];
    let cursor = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth(),
      currentStart.getDate() - 1,
    );
    while (periods.length < BudgetsService.ROLLOVER_LOOKBACK) {
      const range = computePeriodRange(budget.periodType, cursor);
      if (range.end.getTime() < began.getTime()) break;
      const clamped = clampToWindow(range, budget);
      if (clamped) periods.unshift(clamped);
      cursor = new Date(
        range.start.getFullYear(),
        range.start.getMonth(),
        range.start.getDate() - 1,
      );
    }
    if (periods.length === 0) return [];
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.transaction_date', 'date')
      .addSelect('ABS(t.amount)', 'amount')
      .where('t.workspace_id = :workspaceId', { workspaceId: budget.workspaceId })
      .andWhere('t.category_id IN (:...categoryIds)', { categoryIds })
      .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
      .andWhere('t.transaction_date >= :start', { start: periods[0].start })
      .andWhere('t.transaction_date <= :end', { end: periods[periods.length - 1].end })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(countedSql('t'))
      .getRawMany<{ date: string | Date; amount: string }>();
    return periods.map(period =>
      rows.reduce((sum, row) => {
        const at = parseDateOnly(row.date).getTime();
        return at >= period.start.getTime() && at <= period.end.getTime()
          ? sum + Number.parseFloat(row.amount)
          : sum;
      }, 0),
    );
  }

  /** The category and every category under it; just the category when the tree is not available. */
  private async categoryIdsFor(workspaceId: string, categoryId: string): Promise<string[]> {
    if (!this.categoryRepository) return [categoryId];
    const ids = [categoryId];
    let frontier = [categoryId];
    // Bounded: a category tree deeper than this is a mistake, not a feature.
    for (let depth = 0; depth < 5 && frontier.length > 0; depth++) {
      const children = await this.categoryRepository.find({
        where: { workspaceId, parentId: In(frontier) },
        select: ['id'],
      });
      frontier = children.map(child => child.id).filter(id => !ids.includes(id));
      ids.push(...frontier);
    }
    return ids;
  }

  /** The category and its ancestors: the budgets a spend in this category counts against. */
  private async categoryChainFor(workspaceId: string, categoryId: string): Promise<string[]> {
    const ids = [categoryId];
    if (!this.categoryRepository) return ids;
    let current = await this.categoryRepository.findOne({ where: { id: categoryId, workspaceId } });
    for (let depth = 0; depth < 5 && current?.parentId; depth++) {
      if (ids.includes(current.parentId)) break;
      ids.push(current.parentId);
      current = await this.categoryRepository.findOne({
        where: { id: current.parentId, workspaceId },
      });
    }
    return ids;
  }

  /**
   * What booking an expense would do: which budgets it pushes over their
   * available amount, and whether it takes the default account below zero.
   * Advice, not a gate: the entry is still allowed.
   */
  async getImpact(workspaceId: string, dto: BudgetImpactQueryDto): Promise<BudgetImpact> {
    const now = dto.date ? parseDateOnly(dto.date) : new Date();
    const currency = (dto.currency || '').toUpperCase();
    const chain = await this.categoryChainFor(workspaceId, dto.categoryId);
    const budgets = await this.budgetRepository.find({
      where: { workspaceId, categoryId: In(chain) },
      relations: ['category'],
    });
    const affected: BudgetImpactRow[] = [];
    for (const budget of budgets) {
      if (!overlapsWindow({ start: now, end: now }, budget)) continue;
      const amount = await this.inCurrency(dto.amount, currency, budget.currency, workspaceId);
      if (amount === null) continue;
      const { spentAmount, availableAmount } = await this.measure(budget, now);
      const remainingAfter = Math.round((availableAmount - spentAmount - amount) * 100) / 100;
      affected.push({
        id: budget.id,
        name: budget.name,
        categoryName: budget.category?.name ?? null,
        currency: budget.currency,
        availableAmount,
        spentAmount,
        remainingAfter,
        exceeds: remainingAfter < 0,
      });
    }
    return {
      budgets: affected,
      account: await this.accountImpact(workspaceId, dto.amount, currency),
    };
  }

  /** The wallet a manual entry lands in (the oldest active one, as classification picks it). */
  private async accountImpact(
    workspaceId: string,
    amount: number,
    currency: string,
  ): Promise<BudgetImpact['account']> {
    if (!this.walletRepository) return null;
    const wallet = await this.walletRepository.findOne({
      where: { workspaceId, isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (!wallet) return null;
    const converted = await this.inCurrency(amount, currency, wallet.currency, workspaceId);
    if (converted === null) return null;
    const sums = await this.transactionRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.credit), 0)', 'credit')
      .addSelect('COALESCE(SUM(t.debit), 0)', 'debit')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.wallet_id = :walletId', { walletId: wallet.id })
      .andWhere('t.is_duplicate = false')
      .andWhere(countedSql('t'))
      .getRawOne<{ credit: string; debit: string }>();
    const balance =
      Number(wallet.initialBalance) +
      Number.parseFloat(sums?.credit ?? '0') -
      Number.parseFloat(sums?.debit ?? '0');
    const balanceAfter = Math.round((balance - converted) * 100) / 100;
    return {
      walletId: wallet.id,
      name: wallet.name,
      currency: wallet.currency,
      balance: Math.round(balance * 100) / 100,
      balanceAfter,
      overdraws: balanceAfter < 0,
    };
  }

  /** `amount` in `to`; null when the two currencies differ and no rate is at hand. */
  private async inCurrency(
    amount: number,
    from: string,
    to: string,
    workspaceId: string,
  ): Promise<number | null> {
    const source = from || to;
    if (source.toUpperCase() === to.toUpperCase()) return amount;
    if (!this.exchangeRatesService) return null;
    try {
      const result = await this.exchangeRatesService.convert(
        amount,
        source,
        to,
        new Date(),
        workspaceId,
      );
      return result.converted;
    } catch {
      return null;
    }
  }

  private async computeSpending(
    workspaceId: string,
    categoryIds: string[],
    start: Date,
    end: Date,
  ): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.category_id IN (:...categoryIds)', { categoryIds })
      .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
      .andWhere('t.transaction_date >= :start', { start })
      .andWhere('t.transaction_date <= :end', { end })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(countedSql('t'))
      .getRawOne();

    return Number.parseFloat(result?.total ?? '0');
  }
}

export interface BudgetImpactRow {
  id: string;
  name: string;
  categoryName: string | null;
  currency: string;
  availableAmount: number;
  spentAmount: number;
  remainingAfter: number;
  exceeds: boolean;
}

export interface BudgetImpact {
  budgets: BudgetImpactRow[];
  account: {
    walletId: string;
    name: string;
    currency: string;
    balance: number;
    balanceAfter: number;
    overdraws: boolean;
  } | null;
}

/** The fields a person edits, with decimals as numbers so an unchanged limit does not read as changed. */
function budgetSnapshot(budget: Budget) {
  return {
    name: budget.name,
    categoryId: budget.categoryId,
    limitAmount: Number(budget.limitAmount),
    currency: budget.currency,
    periodType: budget.periodType,
    rolloverMode: budget.rolloverMode ?? BudgetRolloverMode.NONE,
    goalId: budget.goalId ?? null,
    startsOn: budget.startsOn ?? null,
    endsOn: budget.endsOn ?? null,
  };
}

/**
 * A window that ends before it starts governs nothing, and the two dates are
 * set on different screens often enough that the mistake is easy to make.
 */
function assertWindowOrdered(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
): void {
  if (startsOn && endsOn && startsOn > endsOn) {
    throw new BadRequestException('Budget "endsOn" must not be earlier than "startsOn"');
  }
}
