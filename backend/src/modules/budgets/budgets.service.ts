import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { assertFound } from '../../common/utils/assert-found.util';
import { countedSql, flowsSql } from '../../common/utils/counted-transactions.util';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import type { BudgetImpactQuery, CreateBudgetBody, UpdateBudgetBody } from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Budget, BudgetPeriodType, BudgetRolloverMode } from '../../entities/budget.entity';
import { Category } from '../../entities/category.entity';
import { Goal } from '../../entities/goal.entity';
import {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import { Subscription, SubscriptionStatus } from '../../entities/subscription.entity';
import { SubscriptionCharge } from '../../entities/subscription-charge.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import type { BudgetExceededEvent } from '../notifications/events/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import { countChargesBetween } from '../subscriptions/charge-calendar.util';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import {
  clampToWindow,
  computePeriodRange,
  overlapsWindow,
  parseDateOnly,
} from './budget-period.util';
import { percentOf, resolveAvailable } from './budget-rollover.util';

export interface BudgetWithSpending extends Budget {
  spentAmount: number;
  percentUsed: number;
  /** What the period has to spend once rollover is settled; equals the limit without rollover. */
  availableAmount: number;
  /** availableAmount minus the limit: positive = leftover carried in, negative = overspend carried in. */
  carriedAmount: number;
  /** Whether today falls inside the budget's window. Always true for open-ended ones. */
  isActive: boolean;
  /** Spending in currencies with no rate to the budget's, left out of spentAmount. */
  unconvertedSpending: UnconvertedSpending[];
  /**
   * The category's spending earlier in the current period than the budget's
   * start date, per currency as booked: not counted, and said so on the card.
   */
  beforeStartSpending: UnconvertedSpending[];
  /** Charges of active subscriptions paid from it still to come this period, in its currency. */
  subscriptionReserve: SubscriptionReserve;
}

export interface SubscriptionReserve {
  amount: number;
  items: Array<{ subscriptionId: string; vendorName: string; amount: number }>;
}

/** Subscriptions paid from a set of budgets, with the charge days already paid ahead. */
interface LinkedSubscriptions {
  subscriptions: Subscription[];
  paidAhead: Map<string, Set<string>>;
}

/** Spending left out of a budget's figure: no rate from its currency to the budget's. */
export interface UnconvertedSpending {
  currency: string;
  amount: number;
}

/** One row a budget covers, as read: its own amount, currency and day. */
interface SpendingRow {
  date: string | Date;
  currency: string | null;
  amount: string;
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
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    @InjectRepository(Subscription)
    private readonly subscriptionRepository?: Repository<Subscription>,
    @Optional()
    @InjectRepository(SubscriptionCharge)
    private readonly subscriptionChargeRepository?: Repository<SubscriptionCharge>,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreateBudgetBody): Promise<Budget> {
    const goalId = dto.goalId ?? null;
    const periodType = toEnum(BudgetPeriodType, dto.periodType);

    // Scoped by goal as well as category: the household grocery limit and the
    // "food during the move" limit are different intents over the same
    // category, and only a second *unattached* budget is still a duplicate.
    const existing = await this.budgetRepository.findOne({
      where: {
        workspaceId,
        categoryId: dto.categoryId,
        periodType,
        goalId: goalId ?? IsNull(),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Budget for this category with period "${dto.periodType}" already exists`,
      );
    }

    assertWindowOrdered(dto.startsOn, dto.endsOn);
    await this.assertCategoryInWorkspace(dto.categoryId, workspaceId);
    await this.assertGoalInWorkspace(dto.goalId, workspaceId);

    const { start } = computePeriodRange(periodType, new Date());

    const budget = this.budgetRepository.create({
      workspaceId,
      createdById: userId,
      name: dto.name,
      categoryId: dto.categoryId,
      limitAmount: dto.limitAmount,
      currency: await this.workspaceCurrency.resolveFor(workspaceId, dto.currency),
      periodType,
      rolloverMode: toEnum(BudgetRolloverMode, dto.rolloverMode) ?? BudgetRolloverMode.NONE,
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

  /** Every budget with its spending in the period `at` falls in: today unless asked for another day. */
  async findAll(workspaceId: string, at: Date = new Date()): Promise<BudgetWithSpending[]> {
    const budgets = await this.budgetRepository.find({
      where: { workspaceId },
      relations: {
        category: true,
      },
      order: { name: 'ASC' },
    });

    const linked = await this.linkedSubscriptions(workspaceId, budgets);
    return Promise.all(budgets.map(budget => this.attachSpending(budget, at, linked)));
  }

  async findOne(id: string, workspaceId: string): Promise<BudgetWithSpending> {
    const budget = await this.budgetRepository.findOne({
      where: { id, workspaceId },
      relations: {
        category: true,
      },
    });
    assertFound(budget, 'Budget');
    const linked = await this.linkedSubscriptions(workspaceId, [budget]);
    return this.attachSpending(budget, new Date(), linked);
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    dto: UpdateBudgetBody,
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
      relations: {
        category: true,
      },
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
        this.eventEmitter?.emit('budget.exceeded', {
          workspaceId,
          budgetId: budget.id,
          name: budget.name,
          categoryId: budget.categoryId ?? null,
          limitAmount: Number(budget.limitAmount),
          spentAmount: Number(spentAmount),
          percentUsed: Math.round(percentUsed),
          currency: budget.currency,
        } satisfies BudgetExceededEvent);
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
      where: [
        { alertAt80Sent: true, workspace: STANDARD_WORKSPACE },
        { alertAt100Sent: true, workspace: STANDARD_WORKSPACE },
      ],
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
  /** The id came from the request: another workspace's category is "not found". */
  private async assertCategoryInWorkspace(categoryId: string, workspaceId: string): Promise<void> {
    const category = await this.categoryRepository?.findOne({
      where: { id: categoryId, workspaceId },
    });
    assertFound(category, 'Category');
  }

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

  private async attachSpending(
    budget: Budget,
    now: Date,
    linked: LinkedSubscriptions,
  ): Promise<BudgetWithSpending> {
    const measured = await this.measure(budget, now);
    return Object.assign(budget, {
      ...measured,
      isActive: overlapsWindow({ start: now, end: now }, budget),
      subscriptionReserve: await this.subscriptionReserve(budget, now, linked),
    });
  }

  /**
   * The active subscriptions paid from any of these budgets, and the charge
   * days from today on that a payment made ahead of them already covers: a
   * payment before its date leaves the next charge where it was.
   */
  private async linkedSubscriptions(
    workspaceId: string,
    budgets: Budget[],
  ): Promise<LinkedSubscriptions> {
    const linked: LinkedSubscriptions = { subscriptions: [], paidAhead: new Map() };
    if (!this.subscriptionRepository || budgets.length === 0) return linked;
    linked.subscriptions = await this.subscriptionRepository.find({
      where: {
        workspaceId,
        status: SubscriptionStatus.ACTIVE,
        budgetId: In(budgets.map(budget => budget.id)),
      },
      select: {
        id: true,
        budgetId: true,
        vendorName: true,
        amount: true,
        currency: true,
        frequency: true,
        nextChargeDate: true,
      },
      order: { vendorName: 'ASC' },
    });
    if (!this.subscriptionChargeRepository || linked.subscriptions.length === 0) return linked;
    const today = new Date();
    const charges = await this.subscriptionChargeRepository.find({
      where: {
        workspaceId,
        subscriptionId: In(linked.subscriptions.map(subscription => subscription.id)),
        expectedDate: MoreThanOrEqual(localDay(today) as unknown as Date),
      },
      select: { subscriptionId: true, expectedDate: true },
    });
    for (const charge of charges) {
      if (!charge.expectedDate) continue;
      const days = linked.paidAhead.get(charge.subscriptionId) ?? new Set<string>();
      days.add(String(charge.expectedDate).slice(0, 10));
      linked.paidAhead.set(charge.subscriptionId, days);
    }
    return linked;
  }

  /**
   * What the budget's subscriptions will still take this period: each charge
   * from today (or the period's start, if later) to the period's end. Paid
   * ones are behind today and their rows are in spentAmount already; a payment
   * made early has moved the next charge past it. A subscription in a currency
   * with no rate to the budget's is left out rather than counted one to one.
   */
  private async subscriptionReserve(
    budget: Budget,
    now: Date,
    linked: LinkedSubscriptions,
  ): Promise<SubscriptionReserve> {
    const reserve: SubscriptionReserve = { amount: 0, items: [] };
    const subscriptions = linked.subscriptions.filter(
      subscription => subscription.budgetId === budget.id,
    );
    const period = clampToWindow(computePeriodRange(budget.periodType, now), budget);
    if (!period || subscriptions.length === 0) return reserve;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const from = period.start > startOfToday ? period.start : startOfToday;
    if (from > period.end) return reserve;

    let total = 0;
    for (const subscription of subscriptions) {
      const count = countChargesBetween(
        subscription.nextChargeDate,
        subscription.frequency,
        from,
        period.end,
        linked.paidAhead.get(subscription.id),
      );
      if (count === 0) continue;
      const rate = await this.rateOrNull(
        subscription.currency,
        budget.currency,
        today,
        budget.workspaceId,
      );
      if (rate === null) continue;
      const amount = Number(subscription.amount) * count * rate;
      total += amount;
      reserve.items.push({
        subscriptionId: subscription.id,
        vendorName: subscription.vendorName,
        amount: Math.round(amount * 100) / 100,
      });
    }
    reserve.amount = Math.round(total * 100) / 100;
    return reserve;
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
    Pick<
      BudgetWithSpending,
      | 'spentAmount'
      | 'percentUsed'
      | 'availableAmount'
      | 'carriedAmount'
      | 'unconvertedSpending'
      | 'beforeStartSpending'
    >
  > {
    const limitAmount = Number(budget.limitAmount);
    const range = computePeriodRange(budget.periodType, now);
    const period = clampToWindow(range, budget);
    if (!period) {
      return {
        spentAmount: 0,
        percentUsed: 0,
        availableAmount: limitAmount,
        carriedAmount: 0,
        unconvertedSpending: [],
        beforeStartSpending: [],
      };
    }
    const categoryIds = await this.categoryIdsFor(budget.workspaceId, budget.categoryId);
    const { spent: spentAmount, unconverted } = await this.computeSpending(
      budget,
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
      unconvertedSpending: unconverted,
      beforeStartSpending:
        period.start.getTime() > range.start.getTime()
          ? await this.spendingBeforeStart(budget, categoryIds, range.start, period.start)
          : [],
    };
  }

  /**
   * The category's spending from the period's first day up to the day before
   * the budget starts, per currency as booked. A budget started mid-period
   * leaves it out, which reads as "nothing spent" unless the card says so.
   */
  private async spendingBeforeStart(
    budget: Budget,
    categoryIds: string[],
    periodStart: Date,
    budgetStart: Date,
  ): Promise<UnconvertedSpending[]> {
    const dayBefore = new Date(
      budgetStart.getFullYear(),
      budgetStart.getMonth(),
      budgetStart.getDate() - 1,
    );
    const rows = await this.spendingRows(budget.workspaceId, categoryIds, periodStart, dayBefore);
    const byCurrency = new Map<string, number>();
    for (const row of rows) {
      const currency = (row.currency || budget.currency).toUpperCase();
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + Number.parseFloat(row.amount));
    }
    return [...byCurrency].map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount * 100) / 100,
    }));
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
    const rows = await this.spendingRows(
      budget.workspaceId,
      categoryIds,
      periods[0].start,
      periods[periods.length - 1].end,
    );
    const converted = await this.inBudgetCurrency(budget, rows);
    return periods.map(period =>
      converted.reduce((sum, row) => {
        const at = parseDateOnly(row.date).getTime();
        return row.value !== null && at >= period.start.getTime() && at <= period.end.getTime()
          ? sum + row.value
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
        select: {
          id: true,
        },
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
  async getImpact(workspaceId: string, dto: BudgetImpactQuery): Promise<BudgetImpact> {
    const now = dto.date ? parseDateOnly(dto.date) : new Date();
    const currency = (dto.currency || '').toUpperCase();
    const chain = await this.categoryChainFor(workspaceId, dto.categoryId);
    const budgets = await this.budgetRepository.find({
      where: { workspaceId, categoryId: In(chain) },
      relations: {
        category: true,
      },
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

  /** The rate from one currency to another on a day: 1 for the same one, null when none is known. */
  private async rateOrNull(
    from: string,
    to: string,
    day: Date,
    workspaceId: string,
  ): Promise<number | null> {
    if (!from || from.toUpperCase() === to.toUpperCase()) return 1;
    if (!this.exchangeRatesService) return null;
    return this.exchangeRatesService
      .getRateOrNull(from.toUpperCase(), to.toUpperCase(), day, workspaceId)
      .catch(() => null);
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

  /**
   * The period's spending in the budget's currency. Rows in another currency
   * are converted at the rate of their own day; a row with no rate is left out
   * and reported, never counted one to one (500 UAH is not 500 USD).
   */
  private async computeSpending(
    budget: Budget,
    categoryIds: string[],
    start: Date,
    end: Date,
  ): Promise<{ spent: number; unconverted: UnconvertedSpending[] }> {
    const rows = await this.spendingRows(budget.workspaceId, categoryIds, start, end);
    const converted = await this.inBudgetCurrency(budget, rows);
    let spent = 0;
    const missing = new Map<string, number>();
    for (const row of converted) {
      if (row.value !== null) {
        spent += row.value;
      } else {
        missing.set(row.currency, (missing.get(row.currency) ?? 0) + row.amount);
      }
    }
    const unconverted = [...missing].map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount * 100) / 100,
    }));
    return { spent, unconverted };
  }

  /** The budget's rows between two days, summed per currency and day. */
  private spendingRows(
    workspaceId: string,
    categoryIds: string[],
    start: Date,
    end: Date,
  ): Promise<SpendingRow[]> {
    return this.transactionRepository
      .createQueryBuilder('t')
      .select('t.transaction_date', 'date')
      .addSelect('t.currency', 'currency')
      .addSelect('SUM(ABS(t.amount))', 'amount')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.category_id IN (:...categoryIds)', { categoryIds })
      .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
      .andWhere('t.transaction_date >= :start', { start })
      .andWhere('t.transaction_date <= :end', { end })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(flowsSql('t'))
      .groupBy('t.transaction_date')
      .addGroupBy('t.currency')
      .getRawMany<SpendingRow>();
  }

  /**
   * Each row's amount in the budget's currency (`value`), or null when no rate
   * exists for its day. A row with no currency is taken to be in the budget's.
   */
  private async inBudgetCurrency(
    budget: Budget,
    rows: SpendingRow[],
  ): Promise<
    Array<{ date: string | Date; currency: string; amount: number; value: number | null }>
  > {
    const target = budget.currency.toUpperCase();
    return Promise.all(
      rows.map(async row => {
        const amount = Number.parseFloat(row.amount);
        const currency = (row.currency || target).toUpperCase();
        if (currency === target) {
          return { date: row.date, currency, amount, value: amount };
        }
        const rate = this.exchangeRatesService
          ? await this.exchangeRatesService
              .getRateOrNull(currency, target, row.date, budget.workspaceId)
              .catch(() => null)
          : null;
        return { date: row.date, currency, amount, value: rate === null ? null : amount * rate };
      }),
    );
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

/** A day in local time, as a `date` column stores it. */
function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}
