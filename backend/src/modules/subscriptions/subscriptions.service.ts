import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  type EntityManager,
  type FindOperator,
  In,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { toEnum } from '../../common/effect/to-enum';
import { canReadPrivate, redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import type {
  CreateSubscriptionBody,
  LinkSubscriptionChargeBody,
  RecordSubscriptionChargeBody,
  RecordSubscriptionDecisionBody,
  SubscriptionChargeCalendar,
  SubscriptionChargeCandidates,
  SubscriptionChargeCandidatesQuery,
  SubscriptionChargeRow,
  SubscriptionDuplicateGroups,
  SubscriptionMonthStatus,
  SubscriptionSummary,
  UpdateSubscriptionBody,
} from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Budget } from '../../entities/budget.entity';
import { Category } from '../../entities/category.entity';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import { Payable, PayableDirection, PayableStatus } from '../../entities/payable.entity';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionReviewStatus,
  SubscriptionRiskStatus,
  SubscriptionStatus,
} from '../../entities/subscription.entity';
import {
  SubscriptionCharge,
  SubscriptionChargeMatchStatus,
} from '../../entities/subscription-charge.entity';
import {
  SubscriptionDecision,
  SubscriptionDecisionType,
} from '../../entities/subscription-decision.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { GoalsService } from '../goals/goals.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  applyAssignment,
  assignmentInputOf,
  TaxAssignmentService,
} from '../tax/tax-assignment.service';
import { projectMonthlyCharges, splitMonthCharges } from './charge-calendar.util';
import {
  costPerUse,
  describePriceChange,
  findDuplicateGroups,
  monthlyCost,
  monthlySetAside,
} from './subscription-insights.util';

const DEFAULT_CALENDAR_MONTHS = 6;
/** How far back a bank row can still be picked as a payment. */
const CANDIDATE_LOOKBACK_DAYS = 400;
const CANDIDATE_LIMIT = 50;
/** A charge more than this far off the expected price is a price change. */
const PRICE_CHANGE_TOLERANCE = 0.05;

export interface BusinessSubscriptionsReport {
  currency: string;
  rows: Array<{
    id: string;
    vendorName: string;
    owner: string | null;
    ownerId: string | null;
    monthlyCost: number;
    frequency: SubscriptionFrequency;
    amount: number;
    subscriptionCurrency: string;
    nextChargeDate: Date | null;
    reviewAt: Date | null;
    riskStatus: SubscriptionRiskStatus;
  }>;
  byOwner: Array<{
    owner: string | null;
    ownerId: string | null;
    monthlyCost: number;
    count: number;
  }>;
  totalMonthlyCost: number;
}

export interface ChargeCalendarRow {
  subscriptionId: string;
  vendorName: string;
  vendorDomain: string | null;
  amounts: number[];
  kind: 'subscription' | 'payable' | 'invoice';
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(SubscriptionDecision)
    private readonly decisionRepository: Repository<SubscriptionDecision>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(SubscriptionCharge)
    private readonly chargeRepository: Repository<SubscriptionCharge>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly auditService: AuditService,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @Optional()
    private readonly goalsService?: GoalsService,
    @Optional()
    @InjectRepository(Payable)
    private readonly payableRepository?: Repository<Payable>,
    @Optional()
    @InjectRepository(Invoice)
    private readonly invoiceRepository?: Repository<Invoice>,
    @Optional()
    @InjectRepository(Budget)
    private readonly budgetRepository?: Repository<Budget>,
    @Optional()
    private readonly taxAssignmentService?: TaxAssignmentService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateSubscriptionBody,
  ): Promise<Subscription> {
    await this.assertCategoryInWorkspace(dto.categoryId, workspaceId);
    await this.assertBudgetInWorkspace(dto.budgetId, workspaceId);
    const subscription = this.subscriptionRepository.create({
      workspaceId,
      createdById: userId,
      vendorName: dto.vendorName,
      amount: dto.amount,
      frequency: toEnum(SubscriptionFrequency, dto.frequency),
      currency: dto.currency ?? 'USD',
      categoryId: dto.categoryId ?? null,
      budgetId: dto.budgetId ?? null,
      nextChargeDate: dto.nextChargeDate ? new Date(dto.nextChargeDate) : null,
      vendorDomain: dto.vendorDomain ?? null,
      status: SubscriptionStatus.ACTIVE,
    });
    const saved = await this.subscriptionRepository.save(subscription);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: subscriptionSnapshot(saved) },
      meta: { name: saved.vendorName },
    });
    return saved;
  }

  /** The id came from the request: another workspace's category is "not found". */
  private async assertCategoryInWorkspace(
    categoryId: string | null | undefined,
    workspaceId: string,
  ): Promise<void> {
    if (!categoryId) return;
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, workspaceId },
    });
    if (!category) throw new NotFoundException('Category not found');
  }

  /** The id came from the request: another workspace's budget is "not found". */
  private async assertBudgetInWorkspace(
    budgetId: string | null | undefined,
    workspaceId: string,
  ): Promise<void> {
    if (!budgetId) return;
    const budget = await this.budgetRepository?.findOne({ where: { id: budgetId, workspaceId } });
    if (!budget) throw new NotFoundException('Budget not found');
  }

  async findAll(
    workspaceId: string,
    status?: SubscriptionStatus,
  ): Promise<Array<Subscription & { costPerUse: number | null }>> {
    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;
    const rows = await this.subscriptionRepository.find({
      where,
      relations: {
        category: true,
      },
      order: { status: 'ASC', nextChargeDate: 'ASC' },
    });
    return rows.map(row => Object.assign(row, { costPerUse: costPerUse(row) }));
  }

  async findOne(id: string, workspaceId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id, workspaceId },
      relations: {
        category: true,
      },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }

  async getDetails(id: string, workspaceId: string) {
    const subscription = await this.findOne(id, workspaceId);
    const [charges, decisions] = await Promise.all([
      this.chargeRepository.find({
        where: { workspaceId, subscriptionId: id },
        order: { chargeDate: 'DESC' },
      }),
      this.decisionRepository.find({
        where: { workspaceId, subscriptionId: id },
        order: { createdAt: 'DESC' },
      }),
    ]);
    const autoLinkPayees = await this.autoLinkPayees(id, workspaceId);
    return { subscription, charges: charges.map(toChargeRow), autoLinkPayees, decisions };
  }

  /** The payee rules of a subscription; `shared` when another active subscription has the same payee. */
  private async autoLinkPayees(
    subscriptionId: string,
    workspaceId: string,
  ): Promise<Array<{ payeeId: string; name: string; shared: boolean }>> {
    const rows: Array<{ payeeId: string; name: string; shared: boolean }> =
      await this.chargeRepository.manager.query(
        `SELECT p.id AS "payeeId", p.name AS "name",
                EXISTS (
                  SELECT 1 FROM subscription_payees other
                  JOIN subscriptions s ON s.id = other.subscription_id AND s.workspace_id = other.workspace_id
                  WHERE other.workspace_id = rule.workspace_id
                    AND other.payee_id = rule.payee_id
                    AND other.subscription_id <> rule.subscription_id
                    AND s.status = $3
                ) AS "shared"
           FROM subscription_payees rule
           JOIN payees p ON p.id = rule.payee_id AND p.workspace_id = rule.workspace_id
          WHERE rule.subscription_id = $1 AND rule.workspace_id = $2
          ORDER BY p.name`,
        [subscriptionId, workspaceId, SubscriptionStatus.ACTIVE],
      );
    return rows.map(row => ({ payeeId: row.payeeId, name: row.name, shared: Boolean(row.shared) }));
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    dto: UpdateSubscriptionBody,
  ): Promise<Subscription> {
    const subscription = await this.findOne(id, workspaceId);
    const before = subscriptionSnapshot(subscription);
    if (dto.vendorName != null) subscription.vendorName = dto.vendorName;
    if (dto.amount != null) subscription.amount = dto.amount;
    if (dto.frequency != null)
      subscription.frequency = toEnum(SubscriptionFrequency, dto.frequency);
    if (dto.status != null) subscription.status = toEnum(SubscriptionStatus, dto.status);
    if (dto.currency != null) subscription.currency = dto.currency;
    if (dto.categoryId !== undefined) {
      await this.assertCategoryInWorkspace(dto.categoryId, workspaceId);
      subscription.categoryId = dto.categoryId;
    }
    // Only payments booked from now on move to the budget; past rows keep their category.
    if (dto.budgetId !== undefined) {
      await this.assertBudgetInWorkspace(dto.budgetId, workspaceId);
      subscription.budgetId = dto.budgetId;
    }
    // null clears the date (new Date(null) would have stored 1970-01-01).
    if (dto.nextChargeDate !== undefined)
      subscription.nextChargeDate = dto.nextChargeDate ? new Date(dto.nextChargeDate) : null;
    if (dto.vendorDomain !== undefined) subscription.vendorDomain = dto.vendorDomain;
    // A price set by hand is the price now: the change it answered is settled.
    const priceEdited =
      Number(subscription.amount) !== before.amount ||
      subscription.currency.toUpperCase() !== before.currency.toUpperCase();
    if (priceEdited && subscription.riskStatus === SubscriptionRiskStatus.PRICE_CHANGED) {
      subscription.riskStatus = SubscriptionRiskStatus.NONE;
      if (subscription.detectionMeta?.priceChange) {
        const { priceChange: _settled, ...rest } = subscription.detectionMeta;
        subscription.detectionMeta = rest;
      }
    }
    const saved = await this.subscriptionRepository.save(subscription);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.UPDATE,
      diff: { before, after: subscriptionSnapshot(saved) },
      meta: { name: saved.vendorName },
    });
    return saved;
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const subscription = await this.findOne(id, workspaceId);
    const before = subscriptionSnapshot(subscription);
    await this.subscriptionRepository.remove(subscription);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.DELETE,
      diff: { before, after: null },
      meta: { name: before.vendorName },
    });
  }

  async confirm(id: string, workspaceId: string, userId: string): Promise<Subscription> {
    const subscription = await this.findOne(id, workspaceId);
    const before = subscriptionSnapshot(subscription);
    subscription.status = SubscriptionStatus.ACTIVE;
    const saved = await this.subscriptionRepository.save(subscription);
    await this.recordDetectedCharges(saved);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Confirmed detected subscription "${saved.vendorName}"`,
      diff: { before, after: subscriptionSnapshot(saved) },
      meta: { name: saved.vendorName, change: 'confirmed' },
    });
    return saved;
  }

  /** A dismissed detection is deleted outright, so it is logged as a deletion. */
  async dismiss(id: string, workspaceId: string, userId: string): Promise<void> {
    const subscription = await this.findOne(id, workspaceId);
    const before = subscriptionSnapshot(subscription);
    await this.subscriptionRepository.remove(subscription);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.DELETE,
      description: `Dismissed detected subscription "${before.vendorName}"`,
      diff: { before, after: null },
      meta: { name: before.vendorName, change: 'dismissed' },
    });
  }

  async assignOwner(
    id: string,
    workspaceId: string,
    ownerId: string,
    actorId: string,
  ): Promise<Subscription> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: ownerId },
    });
    if (!membership) {
      throw new BadRequestException('Subscription owner must be a workspace member');
    }

    const subscription = await this.findOne(id, workspaceId);
    const previousOwnerId = subscription.ownerId ?? null;
    subscription.ownerId = ownerId;
    const saved = await this.subscriptionRepository.save(subscription);
    await this.decisionRepository.save(
      this.decisionRepository.create({
        workspaceId,
        subscriptionId: id,
        actorId,
        ownerId,
        decision: SubscriptionDecisionType.OWNER_ASSIGNED,
      }),
    );
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Assigned an owner to subscription "${saved.vendorName}"`,
      diff: { before: { ownerId: previousOwnerId }, after: { ownerId } },
      meta: {
        name: saved.vendorName,
        change: 'owner_assigned',
        owner: { previousOwnerId, ownerId },
      },
    });
    return saved;
  }

  async recordDecision(
    id: string,
    workspaceId: string,
    actorId: string,
    dto: RecordSubscriptionDecisionBody,
  ): Promise<Subscription> {
    const subscription = await this.findOne(id, workspaceId);
    const before = subscriptionSnapshot(subscription);
    if (dto.decision === SubscriptionDecisionType.KEEP) {
      subscription.reviewStatus = SubscriptionReviewStatus.CURRENT;
      subscription.reviewAt = dto.reviewAt ? new Date(dto.reviewAt) : subscription.reviewAt;
      // The user looked at it and kept it: the flag has done its job.
      subscription.riskStatus = SubscriptionRiskStatus.NONE;
    }
    if (dto.decision === SubscriptionDecisionType.REVIEW) {
      subscription.reviewStatus = SubscriptionReviewStatus.NEEDS_REVIEW;
      subscription.reviewAt = dto.reviewAt ? new Date(dto.reviewAt) : subscription.reviewAt;
    }
    if (dto.decision === SubscriptionDecisionType.CANCELLED) {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancellationReason = dto.note ?? null;
      subscription.realizedAnnualSavings = dto.realizedAnnualSavings ?? 0;
    }
    if (dto.decision === SubscriptionDecisionType.PRICE_REDUCED) {
      subscription.realizedAnnualSavings = dto.realizedAnnualSavings ?? 0;
      subscription.reviewStatus = SubscriptionReviewStatus.CURRENT;
      subscription.riskStatus = SubscriptionRiskStatus.NONE;
    }

    const saved = await this.subscriptionRepository.save(subscription);
    await this.decisionRepository.save(
      this.decisionRepository.create({
        workspaceId,
        subscriptionId: id,
        actorId,
        decision: toEnum(SubscriptionDecisionType, dto.decision),
        note: dto.note ?? null,
        savingsAmount: dto.realizedAnnualSavings ?? null,
      }),
    );
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Recorded decision "${dto.decision}" for subscription "${saved.vendorName}"`,
      diff: { before, after: subscriptionSnapshot(saved) },
      meta: {
        name: saved.vendorName,
        change: 'decision_recorded',
        decision: {
          type: toEnum(SubscriptionDecisionType, dto.decision),
          note: dto.note ?? null,
          realizedAnnualSavings: dto.realizedAnnualSavings ?? null,
          reviewAt: dto.reviewAt ?? null,
        },
      },
    });
    return saved;
  }

  /** The audit trail is a side record: failing to write it must not fail the subscription change. */
  private async audit(event: CreateAuditEventDto): Promise<void> {
    try {
      await this.auditService.createEvent(event);
    } catch (error) {
      this.logger.warn(
        `Failed to record audit event ${event.action} for subscription ${event.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getSummary(workspaceId: string): Promise<SubscriptionSummary> {
    const active = await this.subscriptionRepository.find({
      where: { workspaceId, status: SubscriptionStatus.ACTIVE },
    });
    const detected = await this.subscriptionRepository.find({
      where: { workspaceId, status: SubscriptionStatus.DETECTED },
    });

    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    const workspaceCurrency = workspace?.currency?.toUpperCase();
    const normalizedMonthlyCosts = await Promise.all(
      active.map(async sub => {
        const amount = this.normalizeToMonthly(Number(sub.amount), sub.frequency);
        if (!workspaceCurrency || sub.currency.toUpperCase() === workspaceCurrency) return amount;
        const converted = await this.exchangeRatesService.convert(
          amount,
          sub.currency,
          workspaceCurrency,
          new Date(),
          workspaceId,
        );
        return converted.converted;
      }),
    );
    const totalMonthlyCost = normalizedMonthlyCosts.reduce((sum, amount) => sum + amount, 0);

    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);
    const monthAhead = new Date(now);
    monthAhead.setDate(monthAhead.getDate() + 30);

    const upcomingCount = await this.subscriptionRepository.count({
      where: {
        workspaceId,
        status: SubscriptionStatus.ACTIVE,
        nextChargeDate: LessThanOrEqual(weekAhead),
      },
    });

    // Every charge due in the next 30 days, today included: a weekly
    // subscription charges four or five times, not once.
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming30Days = await Promise.all(
      active.map(async sub => {
        if (!sub.nextChargeDate) return { count: 0, amount: 0 };
        let count = 0;
        for (
          let charge = new Date(sub.nextChargeDate);
          charge <= monthAhead;
          charge = this.addInterval(charge, sub.frequency)
        ) {
          if (charge >= startOfToday) count += 1;
        }
        const amount = Number(sub.amount) * count;
        if (!(amount && workspaceCurrency) || sub.currency.toUpperCase() === workspaceCurrency) {
          return { count, amount };
        }
        const converted = await this.exchangeRatesService.convert(
          amount,
          sub.currency,
          workspaceCurrency,
          new Date(),
          workspaceId,
        );
        return { count, amount: converted.converted };
      }),
    );
    const upcoming30DaysCount = upcoming30Days.reduce((sum, next) => sum + next.count, 0);
    const upcoming30DaysAmount =
      Math.round(upcoming30Days.reduce((sum, next) => sum + next.amount, 0) * 100) / 100;

    const priceChanged = active.filter(sub => sub.riskStatus === 'price_changed');
    const priceChangeCount = priceChanged.length;
    const yearlyEffects = await Promise.all(
      priceChanged.map(async sub => {
        const change = sub.detectionMeta?.priceChange as { yearlyDelta?: number } | undefined;
        const yearly = Number(change?.yearlyDelta ?? 0);
        if (!(yearly && workspaceCurrency) || sub.currency.toUpperCase() === workspaceCurrency) {
          return yearly;
        }
        const converted = await this.exchangeRatesService.convert(
          yearly,
          sub.currency,
          workspaceCurrency,
          new Date(),
          workspaceId,
        );
        return converted.converted;
      }),
    );
    const priceChangeYearlyEffect =
      Math.round(yearlyEffects.reduce((sum, value) => sum + value, 0) * 100) / 100;
    const duplicateCount = findDuplicateGroups([...active, ...detected]).length;
    const overdueReviewCount = active.filter(
      sub => sub.reviewAt && new Date(sub.reviewAt) < now,
    ).length;
    const realizedAnnualSavings = active.reduce(
      (sum, sub) => sum + Number(sub.realizedAnnualSavings ?? 0),
      0,
    );

    return {
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      activeCount: active.length,
      upcomingCount,
      upcoming30DaysCount,
      upcoming30DaysAmount,
      priceChangeCount,
      priceChangeYearlyEffect,
      duplicateCount,
      overdueReviewCount,
      realizedAnnualSavings: Math.round(realizedAnnualSavings * 100) / 100,
    };
  }

  /**
   * Expected charges per vendor per month for the months ahead.
   *
   * Always the active subscriptions of the whole workspace, never the status
   * tab the page happens to show, and converted to the workspace currency by
   * the same service as the monthly-cost summary so the two agree on screen.
   */
  async getChargeCalendar(
    workspaceId: string,
    months = DEFAULT_CALENDAR_MONTHS,
  ): Promise<SubscriptionChargeCalendar> {
    const horizon = Math.min(Math.max(Math.trunc(months) || DEFAULT_CALENDAR_MONTHS, 1), 12);
    const [active, workspace] = await Promise.all([
      this.subscriptionRepository.find({
        where: { workspaceId, status: SubscriptionStatus.ACTIVE },
      }),
      this.workspaceRepository.findOne({ where: { id: workspaceId } }),
    ]);

    const workspaceCurrency = workspace?.currency?.toUpperCase() ?? null;
    const from = new Date();
    const monthLabels = Array.from({ length: horizon }, (_, index) => {
      const date = new Date(from.getFullYear(), from.getMonth() + index, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });

    const rows: ChargeCalendarRow[] = await Promise.all(
      active.map(async sub => {
        const occurrences = projectMonthlyCharges(
          sub.nextChargeDate ? new Date(sub.nextChargeDate) : null,
          sub.frequency,
          from,
          horizon,
        );

        let amount = Number(sub.amount);
        if (workspaceCurrency && sub.currency.toUpperCase() !== workspaceCurrency) {
          const converted = await this.exchangeRatesService.convert(
            amount,
            sub.currency,
            workspaceCurrency,
            new Date(),
            workspaceId,
          );
          amount = converted.converted;
        }

        return {
          subscriptionId: sub.id,
          vendorName: sub.vendorName,
          vendorDomain: sub.vendorDomain ?? null,
          amounts: occurrences.map(count => Math.round(amount * count * 100) / 100),
          kind: 'subscription',
        };
      }),
    );
    rows.push(...(await this.dueRows(workspaceId, from, horizon, workspaceCurrency)));

    const visibleRows = rows
      .filter(row => row.amounts.some(value => value > 0))
      .sort(
        (a, b) =>
          b.amounts.reduce((sum, value) => sum + value, 0) -
          a.amounts.reduce((sum, value) => sum + value, 0),
      );

    // Money going out; invoices are money coming in and stay out of the totals.
    const monthTotals = monthLabels.map(
      (_, index) =>
        Math.round(
          visibleRows
            .filter(row => row.kind !== 'invoice')
            .reduce((sum, row) => sum + row.amounts[index], 0) * 100,
        ) / 100,
    );

    return { currency: workspaceCurrency, months: monthLabels, monthTotals, rows: visibleRows };
  }

  /** This month's charges of active subscriptions, paid (on or before today) and still to come. */
  async getMonthStatus(workspaceId: string): Promise<SubscriptionMonthStatus> {
    const [active, workspace] = await Promise.all([
      this.subscriptionRepository.find({
        where: { workspaceId, status: SubscriptionStatus.ACTIVE },
      }),
      this.workspaceRepository.findOne({ where: { id: workspaceId } }),
    ]);

    const workspaceCurrency = workspace?.currency?.toUpperCase() ?? null;
    const today = new Date();
    const recordedThisMonth = await this.chargesInMonth(workspaceId, today);
    const status = { paidAmount: 0, paidCount: 0, unpaidAmount: 0, unpaidCount: 0 };
    const items: SubscriptionMonthStatus['items'][number][] = [];

    for (const sub of active) {
      const byDate = splitMonthCharges(
        sub.nextChargeDate ? new Date(sub.nextChargeDate) : null,
        sub.frequency,
        today,
      );
      const total = byDate.paid + byDate.unpaid;
      if (total === 0) continue;
      // A payment recorded this month is paid whatever the date says.
      const paid = Math.min(total, Math.max(byDate.paid, recordedThisMonth.get(sub.id) ?? 0));
      const unpaid = total - paid;

      let amount = Number(sub.amount);
      if (workspaceCurrency && sub.currency.toUpperCase() !== workspaceCurrency) {
        const converted = await this.exchangeRatesService.convert(
          amount,
          sub.currency,
          workspaceCurrency,
          today,
          workspaceId,
        );
        amount = converted.converted;
      }

      status.paidAmount += amount * paid;
      status.paidCount += paid;
      status.unpaidAmount += amount * unpaid;
      status.unpaidCount += unpaid;
      items.push({
        subscriptionId: sub.id,
        vendorName: sub.vendorName,
        vendorDomain: sub.vendorDomain ?? null,
        amount: Math.round(amount * (paid + unpaid) * 100) / 100,
        paid: unpaid === 0,
        nextChargeDate: toDay(sub.nextChargeDate),
      });
    }
    items.sort(
      (a, b) =>
        Number(a.paid) - Number(b.paid) ||
        (a.nextChargeDate ?? '').localeCompare(b.nextChargeDate ?? ''),
    );

    return {
      currency: workspaceCurrency,
      month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      ...status,
      paidAmount: Math.round(status.paidAmount * 100) / 100,
      unpaidAmount: Math.round(status.unpaidAmount * 100) / 100,
      items,
    };
  }

  /** How many payments each subscription of the workspace has recorded in the month of `day`. */
  private async chargesInMonth(workspaceId: string, day: Date): Promise<Map<string, number>> {
    const first = new Date(day.getFullYear(), day.getMonth(), 1);
    const last = new Date(day.getFullYear(), day.getMonth() + 1, 0);
    const charges = await this.chargeRepository.find({
      select: { subscriptionId: true },
      where: {
        workspaceId,
        chargeDate: Between(localDay(first), localDay(last)) as unknown as FindOperator<Date>,
      },
    });
    const counts = new Map<string, number>();
    for (const charge of charges) {
      counts.set(charge.subscriptionId, (counts.get(charge.subscriptionId) ?? 0) + 1);
    }
    return counts;
  }

  /** Open bills and sent invoices due inside the horizon, one row each, bucketed by due month. */
  private async dueRows(
    workspaceId: string,
    from: Date,
    horizon: number,
    workspaceCurrency: string | null,
  ): Promise<
    Array<{
      subscriptionId: string;
      vendorName: string;
      vendorDomain: string | null;
      amounts: number[];
      kind: 'payable' | 'invoice';
    }>
  > {
    const start = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(from.getFullYear(), from.getMonth() + horizon, 1);
    const bucket = (due: Date | string | null): number => {
      if (!due) return -1;
      const date = new Date(due);
      if (date < start || date >= end) return -1;
      return (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
    };
    const convert = async (amount: number, currency: string): Promise<number> => {
      if (!workspaceCurrency || currency.toUpperCase() === workspaceCurrency) return amount;
      return (
        await this.exchangeRatesService.convert(
          amount,
          currency,
          workspaceCurrency,
          new Date(),
          workspaceId,
        )
      ).converted;
    };
    const rows: Array<{
      subscriptionId: string;
      vendorName: string;
      vendorDomain: string | null;
      amounts: number[];
      kind: 'payable' | 'invoice';
    }> = [];

    const payables = this.payableRepository
      ? await this.payableRepository.find({
          where: {
            workspaceId,
            direction: PayableDirection.PAYABLE,
            status: In([PayableStatus.TO_PAY, PayableStatus.SCHEDULED, PayableStatus.OVERDUE]),
          },
        })
      : [];
    for (const payable of payables) {
      const index = bucket(payable.dueDate);
      if (index < 0 || (payable as { deletedAt?: Date | null }).deletedAt) continue;
      const amounts = Array.from({ length: horizon }, () => 0);
      amounts[index] =
        Math.round((await convert(Number(payable.amount), payable.currency)) * 100) / 100;
      rows.push({
        subscriptionId: payable.id,
        vendorName: payable.vendor,
        vendorDomain: null,
        amounts,
        kind: 'payable',
      });
    }

    const invoices = this.invoiceRepository
      ? await this.invoiceRepository.find({
          where: { workspaceId, status: In([InvoiceStatus.SENT, InvoiceStatus.OVERDUE]) },
          relations: {
            client: true,
          },
        })
      : [];
    for (const invoice of invoices) {
      const index = bucket(invoice.dueDate);
      if (index < 0) continue;
      const amounts = Array.from({ length: horizon }, () => 0);
      amounts[index] =
        Math.round((await convert(Number(invoice.total), invoice.currency)) * 100) / 100;
      const client = (invoice as { client?: { name?: string } }).client;
      rows.push({
        subscriptionId: invoice.id,
        vendorName: client?.name || invoice.invoiceNumber || 'Invoice',
        vendorDomain: null,
        amounts,
        kind: 'invoice',
      });
    }
    return rows;
  }

  /** One "I used it" tap. The counter starts on the first tap, so cost per use is honest from then on. */
  /**
   * Who pays for what: every active subscription with its owner, monthly cost
   * in the workspace currency, next charge and last review — the list a
   * finance lead asks for once a quarter.
   */
  async getBusinessReport(workspaceId: string): Promise<BusinessSubscriptionsReport> {
    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    const currency = workspace?.currency?.toUpperCase() ?? 'KZT';
    const subs = await this.subscriptionRepository.find({
      where: { workspaceId, status: SubscriptionStatus.ACTIVE },
      relations: {
        owner: true,
      },
      order: { vendorName: 'ASC' },
    });
    const rows: BusinessSubscriptionsReport['rows'] = [];
    for (const sub of subs) {
      let monthly = monthlyCost(Number(sub.amount), sub.frequency);
      if (sub.currency.toUpperCase() !== currency) {
        const converted = await this.exchangeRatesService.convert(
          monthly,
          sub.currency,
          currency,
          new Date(),
          workspaceId,
        );
        monthly = converted.converted;
      }
      rows.push({
        id: sub.id,
        vendorName: sub.vendorName,
        owner: sub.owner?.name || sub.owner?.email || null,
        ownerId: sub.ownerId ?? null,
        monthlyCost: Math.round(monthly * 100) / 100,
        frequency: sub.frequency,
        amount: Number(sub.amount),
        subscriptionCurrency: sub.currency,
        nextChargeDate: sub.nextChargeDate,
        reviewAt: sub.reviewAt,
        riskStatus: sub.riskStatus,
      });
    }
    const byOwnerMap = new Map<string, BusinessSubscriptionsReport['byOwner'][number]>();
    for (const row of rows) {
      const key = row.ownerId ?? '';
      const current = byOwnerMap.get(key) ?? {
        owner: row.owner,
        ownerId: row.ownerId,
        monthlyCost: 0,
        count: 0,
      };
      current.monthlyCost = Math.round((current.monthlyCost + row.monthlyCost) * 100) / 100;
      current.count += 1;
      byOwnerMap.set(key, current);
    }
    return {
      currency,
      rows,
      byOwner: [...byOwnerMap.values()].sort((a, b) => b.monthlyCost - a.monthlyCost),
      totalMonthlyCost: Math.round(rows.reduce((sum, row) => sum + row.monthlyCost, 0) * 100) / 100,
    };
  }

  async recordUsage(
    id: string,
    workspaceId: string,
  ): Promise<Subscription & { costPerUse: number | null }> {
    const subscription = await this.findOne(id, workspaceId);
    const now = new Date();
    subscription.usageCount = (subscription.usageCount ?? 0) + 1;
    subscription.usageSince = subscription.usageSince ?? now;
    subscription.lastUsedAt = now;
    const saved = await this.subscriptionRepository.save(subscription);
    return Object.assign(saved, { costPerUse: costPerUse(saved, now) });
  }

  /** Quarterly and annual charges with the monthly amount that covers the next one by its date. */
  async getSinkingFunds(workspaceId: string): Promise<
    Array<{
      subscriptionId: string;
      vendorName: string;
      amount: number;
      currency: string;
      frequency: SubscriptionFrequency;
      nextChargeDate: Date | null;
      monthlySetAside: number;
      goalId: string | null;
    }>
  > {
    const subs = await this.subscriptionRepository.find({
      where: {
        workspaceId,
        status: SubscriptionStatus.ACTIVE,
        frequency: In([SubscriptionFrequency.QUARTERLY, SubscriptionFrequency.ANNUAL]),
      },
      order: { nextChargeDate: 'ASC' },
    });
    return subs.map(sub => ({
      subscriptionId: sub.id,
      vendorName: sub.vendorName,
      amount: Number(sub.amount),
      currency: sub.currency,
      frequency: sub.frequency,
      nextChargeDate: sub.nextChargeDate,
      monthlySetAside: monthlySetAside(Number(sub.amount), sub.nextChargeDate),
      goalId: sub.sinkingGoalId,
    }));
  }

  /**
   * A savings goal for the next big charge: target = the charge, due = its
   * date. The goal plan then says what to put aside each month, and the
   * budgets page sees the headroom. Idempotent: the goal is created once.
   */
  async createSinkingFund(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<{ goalId: string; monthlySetAside: number; created: boolean }> {
    const subscription = await this.findOne(id, workspaceId);
    if (
      subscription.frequency !== SubscriptionFrequency.QUARTERLY &&
      subscription.frequency !== SubscriptionFrequency.ANNUAL
    ) {
      throw new BadRequestException('Only quarterly and annual subscriptions need a sinking fund');
    }
    const setAside = monthlySetAside(Number(subscription.amount), subscription.nextChargeDate);
    if (subscription.sinkingGoalId) {
      return { goalId: subscription.sinkingGoalId, monthlySetAside: setAside, created: false };
    }
    if (!this.goalsService) {
      throw new BadRequestException('Goals are not available');
    }
    const goal = await this.goalsService.create(workspaceId, userId, {
      name: `${subscription.vendorName} · ${subscription.frequency}`,
      targetAmount: Number(subscription.amount),
      currency: subscription.currency,
      targetDate: subscription.nextChargeDate
        ? new Date(subscription.nextChargeDate).toISOString().slice(0, 10)
        : undefined,
    });
    subscription.sinkingGoalId = goal.id;
    await this.subscriptionRepository.save(subscription);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Created a sinking-fund goal for subscription "${subscription.vendorName}"`,
      meta: { name: subscription.vendorName, change: 'sinking_fund_created', goalId: goal.id },
    });
    return { goalId: goal.id, monthlySetAside: setAside, created: true };
  }

  /** Rows that look like the same service paid twice: two plans, two cards, two members. */
  async getDuplicates(workspaceId: string): Promise<SubscriptionDuplicateGroups> {
    const subs = await this.subscriptionRepository.find({
      where: { workspaceId, status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.DETECTED]) },
    });
    return findDuplicateGroups(subs).map(group => ({
      key: group.key,
      items: group.items.map(sub => ({
        id: sub.id,
        vendorName: sub.vendorName,
        amount: Number(sub.amount),
        currency: sub.currency,
        frequency: sub.frequency,
        status: sub.status,
        ownerId: sub.ownerId,
      })),
    }));
  }

  async getUpcoming(workspaceId: string, days = 7): Promise<Subscription[]> {
    const until = new Date();
    until.setDate(until.getDate() + days);

    return this.subscriptionRepository.find({
      where: {
        workspaceId,
        status: SubscriptionStatus.ACTIVE,
        nextChargeDate: LessThanOrEqual(until),
      },
      relations: {
        category: true,
      },
      order: { nextChargeDate: 'ASC' },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async checkUpcomingCharges(): Promise<void> {
    const threeDaysAhead = new Date();
    threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextChargeDate: LessThanOrEqual(threeDaysAhead),
        workspace: STANDARD_WORKSPACE,
      },
    });

    const byWorkspace = new Map<string, Subscription[]>();
    for (const sub of upcoming) {
      if (!sub.nextChargeDate || new Date(sub.nextChargeDate) < today) continue;
      const list = byWorkspace.get(sub.workspaceId) ?? [];
      list.push(sub);
      byWorkspace.set(sub.workspaceId, list);
    }

    for (const [workspaceId, subs] of byWorkspace) {
      const charges = subs.map(s => ({
        id: s.id,
        vendor: s.vendorName,
        amount: Number(s.amount),
        currency: s.currency,
        // A `date` column arrives as a string despite the Date type.
        chargeDate:
          typeof s.nextChargeDate === 'string'
            ? (s.nextChargeDate as string).slice(0, 10)
            : (s.nextChargeDate as Date).toISOString().slice(0, 10),
      }));
      // One running notification per workspace, rewritten when the set of
      // charges changes rather than added again every morning.
      await this.notificationsService.createForWorkspaceMembers({
        workspaceId,
        type: NotificationType.SUBSCRIPTION_UPCOMING,
        category: NotificationCategory.WORKSPACE_ACTIVITY,
        severity: NotificationSeverity.INFO,
        messageKey: subs.length === 1 ? 'subscription.upcoming.one' : 'subscription.upcoming',
        messageParams: {
          charges: {
            kind: 'charges',
            items: charges.map(c => ({ name: c.vendor, amount: c.amount, currency: c.currency })),
          },
        },
        entityType: 'subscription',
        entityId: subs[0].id,
        meta: { subscriptions: charges },
        fingerprint: charges
          .map(c => `${c.id}:${c.amount}:${c.currency}:${c.chargeDate}`)
          .sort()
          .join('|'),
      });
    }

    this.logger.log(
      `Checked upcoming charges: ${upcoming.length} subscription(s) due within 3 days`,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async updatePastDueNextDates(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // A past version keeps the charge dates it was copied with.
    const pastDue = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextChargeDate: LessThanOrEqual(today),
        workspace: STANDARD_WORKSPACE,
      },
    });

    for (const sub of pastDue) {
      const currentChargeDate = sub.nextChargeDate;
      if (!currentChargeDate) continue;

      sub.lastChargeDate = currentChargeDate;
      sub.nextChargeDate = this.addInterval(new Date(currentChargeDate), sub.frequency);
      sub.riskStatus = SubscriptionRiskStatus.MISSING_CHARGE;
      await this.subscriptionRepository.save(sub);
    }

    if (pastDue.length > 0) {
      this.logger.log(`Updated nextChargeDate for ${pastDue.length} past-due subscription(s)`);
    }
  }

  /**
   * Expense rows that could be a payment of a subscription: not a payment of
   * any yet, from the last 400 days, the vendor's own first, then newest.
   */
  async getChargeCandidates(
    workspaceId: string,
    query: SubscriptionChargeCandidatesQuery,
    viewerMemberId: string | null,
  ): Promise<SubscriptionChargeCandidates> {
    const since = new Date();
    since.setDate(since.getDate() - CANDIDATE_LOOKBACK_DAYS);
    const builder = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoin('tx.statement', 'statement')
      .select([
        'tx.id',
        'tx.counterpartyName',
        'tx.vendorNormalized',
        'tx.transactionDate',
        'tx.amount',
        'tx.currency',
        'tx.isPrivate',
        'tx.ownerMemberId',
      ])
      .where('tx.workspaceId = :workspaceId', { workspaceId })
      .andWhere('(tx.statementId IS NULL OR statement.deletedAt IS NULL)')
      .andWhere('tx.transactionType = :type', { type: TransactionType.EXPENSE })
      .andWhere('tx.amount IS NOT NULL')
      .andWhere('tx.transactionDate >= :since', { since: localDay(since) })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM subscription_charges charge WHERE charge.transaction_id = tx.id)',
      );
    // A statement of another workspace has no rows here: the filter above keeps them out.
    if (query.statementId) {
      builder.andWhere('tx.statementId = :statementId', { statementId: query.statementId });
    }
    const rows = await builder.getMany();

    const candidates = rows.map(row => ({
      row,
      matchesVendor:
        !!query.vendorName &&
        canReadPrivate(row, viewerMemberId) &&
        payeeMatchesVendor(query.vendorName, row.vendorNormalized ?? row.counterpartyName),
      date: toDay(row.transactionDate) ?? '',
    }));
    candidates.sort(
      (a, b) => Number(b.matchesVendor) - Number(a.matchesVendor) || b.date.localeCompare(a.date),
    );
    const top = candidates.slice(0, CANDIDATE_LIMIT);
    redactPrivateRows(
      top.map(candidate => candidate.row),
      viewerMemberId,
    );
    return top.map(({ row, matchesVendor, date }) => ({
      transactionId: row.id,
      counterpartyName: row.counterpartyName ?? '',
      transactionDate: date,
      amount: Math.abs(Number(row.amount)),
      currency: row.currency,
      matchesVendor,
    }));
  }

  /**
   * A payment already made: a bank row (its date and amount) or a date with an
   * optional amount, linked to its row later. Moves the subscription past it.
   */
  async recordCharge(
    id: string,
    workspaceId: string,
    userId: string,
    body: RecordSubscriptionChargeBody,
  ): Promise<SubscriptionChargeRow> {
    const { charge, subscription, before } = await this.chargeRepository.manager.transaction(
      async manager => {
        const subscription = await this.lockSubscription(manager, id, workspaceId);
        const before = chargeDates(subscription);
        let paid: Payment;
        if (body.transactionId) {
          const transaction = await this.chargeableTransaction(
            manager,
            body.transactionId,
            workspaceId,
            null,
          );
          await learnPayeeRule(manager, subscription, transaction);
          await this.categoriseForBudget(manager, subscription, transaction);
          paid = paymentOf(transaction);
        } else {
          if (!body.chargeDate) {
            throw new BadRequestException('chargeDate is required without a transactionId');
          }
          paid = {
            transactionId: null,
            chargeDate: body.chargeDate,
            amount: body.amount ?? Number(subscription.amount),
            currency: subscription.currency,
          };
        }
        const charge = await this.bookCharge(manager, subscription, paid);
        return { charge, subscription, before };
      },
    );
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Recorded a payment of subscription "${subscription.vendorName}"`,
      diff: { before, after: chargeDates(subscription) },
      meta: {
        name: subscription.vendorName,
        change: 'charge_recorded',
        charge: chargeMeta(charge),
      },
    });
    return toChargeRow(charge);
  }

  /** Links a payment to its bank row, which then gives it its date and amount. */
  async linkCharge(
    id: string,
    chargeId: string,
    workspaceId: string,
    userId: string,
    body: LinkSubscriptionChargeBody,
  ): Promise<SubscriptionChargeRow> {
    const { charge, subscription, before } = await this.chargeRepository.manager.transaction(
      async manager => {
        const charges = manager.getRepository(SubscriptionCharge);
        const subscription = await this.lockSubscription(manager, id, workspaceId);
        const before = chargeDates(subscription);
        const charge = await charges.findOne({
          where: { id: chargeId, subscriptionId: id, workspaceId },
        });
        if (!charge) throw new NotFoundException('Subscription payment not found');
        const transaction = await this.chargeableTransaction(
          manager,
          body.transactionId,
          workspaceId,
          charge.id,
        );
        const previousTransactionId = charge.transactionId;
        const paid = paymentOf(transaction);
        Object.assign(charge, paid, { chargeDate: paid.chargeDate as unknown as Date });
        charge.matchStatus = chargeMatchStatus(paid, {
          amount: Number(charge.expectedAmount),
          currency: subscription.currency,
        });
        const saved = await charges.save(charge);
        await learnPayeeRule(manager, subscription, transaction);
        await this.categoriseForBudget(manager, subscription, transaction);
        if (previousTransactionId && previousTransactionId !== transaction.id) {
          await forgetPayeeRule(manager, subscription, previousTransactionId);
        }
        if (charge.matchStatus === SubscriptionChargeMatchStatus.PRICE_CHANGED) {
          flagPriceChange(subscription, paid.amount);
        }
        this.advancePastCharge(subscription, paid.chargeDate);
        await manager.getRepository(Subscription).save(subscription);
        return { charge: saved, subscription, before };
      },
    );
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.LINK,
      description: `Linked a payment of subscription "${subscription.vendorName}" to a transaction`,
      diff: { before, after: chargeDates(subscription) },
      meta: { name: subscription.vendorName, change: 'charge_linked', charge: chargeMeta(charge) },
    });
    return toChargeRow(charge);
  }

  /** Removes a payment, never its bank row; the last charge date follows what is left. */
  async removeCharge(
    id: string,
    chargeId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const { charge, subscription, before } = await this.chargeRepository.manager.transaction(
      async manager => {
        const charges = manager.getRepository(SubscriptionCharge);
        const subscription = await this.lockSubscription(manager, id, workspaceId);
        const before = chargeDates(subscription);
        const charge = await charges.findOne({
          where: { id: chargeId, subscriptionId: id, workspaceId },
        });
        if (!charge) throw new NotFoundException('Subscription payment not found');
        const removed = chargeMeta(charge);
        await charges.remove(charge);
        if (removed.transactionId) {
          await forgetPayeeRule(manager, subscription, removed.transactionId);
        }
        const latest = await charges.findOne({
          where: { subscriptionId: id, workspaceId },
          order: { chargeDate: 'DESC' },
        });
        subscription.lastChargeDate = latest?.chargeDate ?? null;
        await manager.getRepository(Subscription).save(subscription);
        return { charge: removed, subscription, before };
      },
    );
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Removed a payment of subscription "${subscription.vendorName}"`,
      diff: { before, after: chargeDates(subscription) },
      meta: { name: subscription.vendorName, change: 'charge_removed', charge },
    });
  }

  /**
   * Books a payment on a locked subscription: the charge with what was
   * expected, the price-change flag, and the subscription moved past it.
   */
  private async bookCharge(
    manager: EntityManager,
    subscription: Subscription,
    paid: Payment,
  ): Promise<SubscriptionCharge> {
    const charges = manager.getRepository(SubscriptionCharge);
    const matchStatus = chargeMatchStatus(paid, {
      amount: Number(subscription.amount),
      currency: subscription.currency,
    });
    const charge = await charges.save(
      charges.create({
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        ...paid,
        chargeDate: paid.chargeDate as unknown as Date,
        expectedAmount: subscription.amount,
        expectedDate: subscription.nextChargeDate,
        matchStatus,
      }),
    );
    if (matchStatus === SubscriptionChargeMatchStatus.PRICE_CHANGED) {
      flagPriceChange(subscription, paid.amount);
    }
    this.advancePastCharge(subscription, paid.chargeDate);
    await manager.getRepository(Subscription).save(subscription);
    return charge;
  }

  /**
   * Makes a just-inserted bank row a payment of the one active subscription
   * whose payee rule it matches, in the caller's database transaction.
   * Answers the audit event to write, or null when no rule applies: no rule,
   * two subscriptions sharing the payee (never guessed), or already a payment.
   */
  async autoLinkTransaction(
    manager: EntityManager,
    transaction: Transaction,
  ): Promise<CreateAuditEventDto | null> {
    const { workspaceId, payeeId } = transaction;
    const rules: Array<{ subscription_id: string }> = await manager.query(
      `SELECT rule.subscription_id
         FROM subscription_payees rule
         JOIN subscriptions s ON s.id = rule.subscription_id AND s.workspace_id = rule.workspace_id
        WHERE rule.workspace_id = $1 AND rule.payee_id = $2 AND s.status = $3
        LIMIT 2`,
      [workspaceId, payeeId, SubscriptionStatus.ACTIVE],
    );
    if (rules.length !== 1) return null;
    const existing = await manager.getRepository(SubscriptionCharge).findOne({
      where: { transactionId: transaction.id, workspaceId },
    });
    if (existing) return null;
    const subscription = await this.lockSubscription(
      manager,
      rules[0].subscription_id,
      workspaceId,
    );
    if (subscription.status !== SubscriptionStatus.ACTIVE) return null;
    const before = chargeDates(subscription);
    const charge = await this.bookCharge(manager, subscription, paymentOf(transaction));
    await this.categoriseForBudget(manager, subscription, transaction);
    return {
      workspaceId,
      actorType: ActorType.SYSTEM,
      actorId: null,
      entityType: EntityType.SUBSCRIPTION,
      entityId: subscription.id,
      action: AuditAction.LINK,
      description: `Linked a payment of subscription "${subscription.vendorName}" by its payee`,
      diff: { before, after: chargeDates(subscription) },
      meta: {
        name: subscription.vendorName,
        change: 'charge_auto_linked',
        charge: chargeMeta(charge),
      },
    };
  }

  /**
   * A bank row that just became a payment of a subscription paid from a budget
   * takes the budget's category, so the budget counts it. A category a person
   * picked stays, and so does a row on a filed tax return. Written with
   * update() in the caller's transaction: a save() would run the transaction
   * subscribers on a row the caller may still be inserting, so the tax that
   * follows the category is worked out here instead.
   */
  private async categoriseForBudget(
    manager: EntityManager,
    subscription: Subscription,
    transaction: Transaction,
  ): Promise<void> {
    if (
      !subscription.budgetId ||
      transaction.categorySource === TransactionCategorySource.MANUAL ||
      transaction.taxLocked
    ) {
      return;
    }
    const budget = await manager.getRepository(Budget).findOne({
      where: { id: subscription.budgetId, workspaceId: subscription.workspaceId },
      select: { id: true, name: true, categoryId: true },
    });
    if (!budget || transaction.categoryId === budget.categoryId) return;
    const patch: Record<string, unknown> = {
      categoryId: budget.categoryId,
      categorySource: TransactionCategorySource.RULE,
      categoryReason: budget.name.slice(0, 255),
    };
    if (this.taxAssignmentService) {
      const assignment = await this.taxAssignmentService.resolve(
        assignmentInputOf({ ...transaction, ...patch } as Transaction),
      );
      applyAssignment(patch as unknown as Transaction, assignment);
    }
    await manager.update(
      Transaction,
      { id: transaction.id, workspaceId: subscription.workspaceId },
      patch as QueryDeepPartialEntity<Transaction>,
    );
    // The caller's copy of the row says what was stored, should it be saved again.
    Object.assign(transaction, patch);
  }

  /** The subscription, locked so two payments recorded at once advance it one after the other. */
  private async lockSubscription(
    manager: EntityManager,
    id: string,
    workspaceId: string,
  ): Promise<Subscription> {
    const subscription = await manager.getRepository(Subscription).findOne({
      where: { id, workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }

  /** A row of this workspace that is not a payment yet (other than `ownChargeId`, being relinked). */
  private async chargeableTransaction(
    manager: EntityManager,
    transactionId: string,
    workspaceId: string,
    ownChargeId: string | null,
  ): Promise<Transaction> {
    const transaction = await manager.getRepository(Transaction).findOne({
      where: { id: transactionId, workspaceId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    const existing = await manager.getRepository(SubscriptionCharge).findOne({
      where: { transactionId, workspaceId },
    });
    if (existing && existing.id !== ownChargeId) {
      throw new ConflictException('This transaction is already a subscription payment');
    }
    return transaction;
  }

  /** Last charge is the latest payment; the next one moves past a payment on or after it. */
  private advancePastCharge(subscription: Subscription, chargeDay: string): void {
    const last = toDay(subscription.lastChargeDate);
    if (!last || last < chargeDay) {
      subscription.lastChargeDate = chargeDay as unknown as Date;
    }
    const next = toDay(subscription.nextChargeDate);
    if (next && next > chargeDay) return;
    let date = new Date(chargeDay);
    do {
      date = this.addInterval(date, subscription.frequency);
    } while ((toDay(date) ?? '') <= chargeDay);
    subscription.nextChargeDate = toDay(date) as unknown as Date;
  }

  private normalizeToMonthly(amount: number, frequency: SubscriptionFrequency): number {
    switch (frequency) {
      case SubscriptionFrequency.WEEKLY:
        return amount * 4.33;
      case SubscriptionFrequency.MONTHLY:
        return amount;
      case SubscriptionFrequency.QUARTERLY:
        return amount / 3;
      case SubscriptionFrequency.ANNUAL:
        return amount / 12;
    }
  }

  private addInterval(date: Date, frequency: SubscriptionFrequency): Date {
    const d = new Date(date);
    switch (frequency) {
      case SubscriptionFrequency.WEEKLY:
        d.setDate(d.getDate() + 7);
        break;
      case SubscriptionFrequency.MONTHLY:
        d.setMonth(d.getMonth() + 1);
        break;
      case SubscriptionFrequency.QUARTERLY:
        d.setMonth(d.getMonth() + 3);
        break;
      case SubscriptionFrequency.ANNUAL:
        d.setFullYear(d.getFullYear() + 1);
        break;
    }
    return d;
  }

  private async recordDetectedCharges(subscription: Subscription): Promise<void> {
    const transactionIds = subscription.detectionMeta?.transactionIds;
    if (!Array.isArray(transactionIds) || transactionIds.some(id => typeof id !== 'string')) return;

    const transactions = await this.transactionRepository.find({
      where: { workspaceId: subscription.workspaceId, id: In(transactionIds) },
    });
    for (const transaction of transactions) {
      const existing = await this.chargeRepository.findOne({
        where: { transactionId: transaction.id },
      });
      if (existing) continue;
      const amount = Math.abs(Number(transaction.amount));
      const matchStatus = chargeMatchStatus(
        { amount, currency: transaction.currency },
        { amount: Number(subscription.amount), currency: subscription.currency },
      );
      await this.chargeRepository.save(
        this.chargeRepository.create({
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          transactionId: transaction.id,
          amount,
          currency: transaction.currency,
          chargeDate: transaction.transactionDate,
          expectedAmount: subscription.amount,
          expectedDate: subscription.nextChargeDate,
          matchStatus,
        }),
      );
      if (matchStatus === SubscriptionChargeMatchStatus.PRICE_CHANGED) {
        flagPriceChange(subscription, amount);
        await this.subscriptionRepository.save(subscription);
      }
    }
  }
}

/** A `date` column comes back from Postgres as a string but is assigned as a Date; both read as a day here. */
function toDay(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/** A day in local time, as a `date` column stores it. */
function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Matched, or a price change when the amount is more than 5% off what was expected. */
/**
 * Prices are compared only in one currency. A charge in another one (a dollar
 * plan billed in shekels) moves with the exchange rate every month, so it says
 * nothing about the price and is never a price change.
 */
function chargeMatchStatus(
  paid: { amount: number; currency: string },
  expected: { amount: number; currency: string },
): SubscriptionChargeMatchStatus {
  if (paid.currency.toUpperCase() !== expected.currency.toUpperCase()) {
    return SubscriptionChargeMatchStatus.MATCHED;
  }
  const variance = expected.amount ? Math.abs(paid.amount - expected.amount) / expected.amount : 0;
  return variance > PRICE_CHANGE_TOLERANCE
    ? SubscriptionChargeMatchStatus.PRICE_CHANGED
    : SubscriptionChargeMatchStatus.MATCHED;
}

/** Flags the subscription with the price a charge came in at. */
function flagPriceChange(subscription: Subscription, amount: number): void {
  subscription.riskStatus = SubscriptionRiskStatus.PRICE_CHANGED;
  const change = describePriceChange(Number(subscription.amount), amount, subscription.frequency);
  if (change) {
    subscription.detectionMeta = { ...(subscription.detectionMeta ?? {}), priceChange: change };
  }
}

type Payment = Pick<SubscriptionCharge, 'transactionId' | 'amount' | 'currency'> & {
  chargeDate: string;
};

/** What a bank row says about the payment it is. */
function paymentOf(transaction: Transaction): Payment {
  return {
    transactionId: transaction.id,
    chargeDate: toDay(transaction.transactionDate) ?? '',
    amount: Math.abs(Number(transaction.amount)),
    currency: transaction.currency,
  };
}

/** A person linked this row to the subscription: its payee's later rows become payments too. */
async function learnPayeeRule(
  manager: EntityManager,
  subscription: Subscription,
  transaction: Transaction,
): Promise<void> {
  if (!transaction.payeeId) return;
  await manager.query(
    `INSERT INTO subscription_payees (workspace_id, subscription_id, payee_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (subscription_id, payee_id) DO NOTHING`,
    [subscription.workspaceId, subscription.id, transaction.payeeId],
  );
}

/** Drops the rule of the row's payee once no payment of the subscription is a row of that payee. */
async function forgetPayeeRule(
  manager: EntityManager,
  subscription: Subscription,
  transactionId: string,
): Promise<void> {
  await manager.query(
    `DELETE FROM subscription_payees rule
      WHERE rule.workspace_id = $1
        AND rule.subscription_id = $2
        AND rule.payee_id = (SELECT payee_id FROM transactions WHERE id = $3 AND workspace_id = $1)
        AND NOT EXISTS (
          SELECT 1 FROM subscription_charges charge
          JOIN transactions tx ON tx.id = charge.transaction_id AND tx.workspace_id = charge.workspace_id
          WHERE charge.subscription_id = rule.subscription_id
            AND charge.workspace_id = rule.workspace_id
            AND tx.payee_id = rule.payee_id
        )`,
    [subscription.workspaceId, subscription.id, transactionId],
  );
}

/** Lower-case letters and digits only, so "ACME-Music Inc." reads as "acmemusicinc". */
function normalizeName(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** The bank's payee looks like this vendor: one contains the other, or it has the vendor's first word. */
function payeeMatchesVendor(vendorName: string, payee: string | null | undefined): boolean {
  const name = normalizeName(payee);
  const vendor = normalizeName(vendorName);
  if (name.length < 3) return false;
  if (vendor.length >= 3 && (name.includes(vendor) || vendor.includes(name))) return true;
  const firstWord = normalizeName(vendorName.trim().split(/\s+/)[0]);
  return firstWord.length >= 3 && name.includes(firstWord);
}

/** A charge as `SubscriptionChargeRow`: decimals as strings, days as YYYY-MM-DD. */
function toChargeRow(charge: SubscriptionCharge): SubscriptionChargeRow {
  return {
    id: charge.id,
    transactionId: charge.transactionId ?? null,
    amount: Number(charge.amount).toFixed(2),
    currency: charge.currency,
    chargeDate: toDay(charge.chargeDate) ?? '',
    expectedAmount: Number(charge.expectedAmount).toFixed(2),
    expectedDate: toDay(charge.expectedDate),
    matchStatus: charge.matchStatus,
    createdAt: new Date(charge.createdAt).toISOString(),
  };
}

/** The charge in the audit trail. */
function chargeMeta(charge: SubscriptionCharge) {
  return {
    id: charge.id,
    transactionId: charge.transactionId ?? null,
    amount: Number(charge.amount),
    currency: charge.currency,
    chargeDate: toDay(charge.chargeDate),
  };
}

/** The dates a payment moves. */
function chargeDates(subscription: Subscription) {
  return {
    lastChargeDate: toDay(subscription.lastChargeDate),
    nextChargeDate: toDay(subscription.nextChargeDate),
  };
}

/** The fields a person edits or decides on, with decimals as numbers so unchanged values stay equal. */
function subscriptionSnapshot(subscription: Subscription) {
  return {
    vendorName: subscription.vendorName,
    amount: Number(subscription.amount),
    frequency: subscription.frequency,
    currency: subscription.currency,
    status: subscription.status,
    categoryId: subscription.categoryId ?? null,
    budgetId: subscription.budgetId ?? null,
    nextChargeDate: toDay(subscription.nextChargeDate),
    vendorDomain: subscription.vendorDomain ?? null,
    reviewStatus: subscription.reviewStatus,
    reviewAt: toDay(subscription.reviewAt),
    cancellationReason: subscription.cancellationReason ?? null,
    realizedAnnualSavings: Number(subscription.realizedAnnualSavings ?? 0),
  };
}
