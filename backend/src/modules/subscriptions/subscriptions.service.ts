import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import type {
  CreateSubscriptionBody,
  RecordSubscriptionDecisionBody,
  SubscriptionChargeCalendar,
  SubscriptionDuplicateGroups,
  SubscriptionSummary,
  UpdateSubscriptionBody,
} from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
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
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { GoalsService } from '../goals/goals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { projectMonthlyCharges } from './charge-calendar.util';
import {
  costPerUse,
  describePriceChange,
  findDuplicateGroups,
  monthlyCost,
  monthlySetAside,
} from './subscription-insights.util';

const DEFAULT_CALENDAR_MONTHS = 6;

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
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateSubscriptionBody,
  ): Promise<Subscription> {
    await this.assertCategoryInWorkspace(dto.categoryId, workspaceId);
    const subscription = this.subscriptionRepository.create({
      workspaceId,
      createdById: userId,
      vendorName: dto.vendorName,
      amount: dto.amount,
      frequency: toEnum(SubscriptionFrequency, dto.frequency),
      currency: dto.currency ?? 'USD',
      categoryId: dto.categoryId ?? null,
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

  async findAll(
    workspaceId: string,
    status?: SubscriptionStatus,
  ): Promise<Array<Subscription & { costPerUse: number | null }>> {
    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;
    const rows = await this.subscriptionRepository.find({
      where,
      relations: ['category'],
      order: { status: 'ASC', nextChargeDate: 'ASC' },
    });
    return rows.map(row => Object.assign(row, { costPerUse: costPerUse(row) }));
  }

  async findOne(id: string, workspaceId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id, workspaceId },
      relations: ['category'],
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }

  async getDetails(id: string, workspaceId: string) {
    const subscription = await this.findOne(id, workspaceId);
    const [charges, decisions] = await Promise.all([
      this.chargeRepository.find({
        where: { workspaceId, subscriptionId: id },
        relations: ['transaction'],
        order: { chargeDate: 'DESC' },
      }),
      this.decisionRepository.find({
        where: { workspaceId, subscriptionId: id },
        order: { createdAt: 'DESC' },
      }),
    ]);
    return { subscription, charges, decisions };
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
    // null clears the date (new Date(null) would have stored 1970-01-01).
    if (dto.nextChargeDate !== undefined)
      subscription.nextChargeDate = dto.nextChargeDate ? new Date(dto.nextChargeDate) : null;
    if (dto.vendorDomain !== undefined) subscription.vendorDomain = dto.vendorDomain;
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

    const upcoming30DaysCount = active.filter(sub => {
      const chargeDate = sub.nextChargeDate ? new Date(sub.nextChargeDate) : null;
      return chargeDate !== null && chargeDate >= now && chargeDate <= monthAhead;
    }).length;

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
          relations: ['client'],
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
      relations: ['owner'],
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
      relations: ['category'],
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
      await this.notificationsService.createForWorkspaceMembers({
        workspaceId,
        type: NotificationType.SUBSCRIPTION_UPCOMING,
        category: NotificationCategory.WORKSPACE_ACTIVITY,
        severity: NotificationSeverity.INFO,
        messageKey: 'subscription.upcoming',
        messageParams: {
          details: subs.map(s => `${s.vendorName} (${s.amount} ${s.currency})`).join(', '),
        },
        entityType: 'subscription',
        entityId: subs[0].id,
        meta: {
          subscriptions: subs.map(s => ({ id: s.id, vendor: s.vendorName, amount: s.amount })),
        },
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

    const pastDue = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextChargeDate: LessThanOrEqual(today),
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
      const variance = subscription.amount
        ? Math.abs(amount - Number(subscription.amount)) / Number(subscription.amount)
        : 0;
      const matchStatus =
        variance > 0.05
          ? SubscriptionChargeMatchStatus.PRICE_CHANGED
          : SubscriptionChargeMatchStatus.MATCHED;
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
        subscription.riskStatus = SubscriptionRiskStatus.PRICE_CHANGED;
        const change = describePriceChange(
          Number(subscription.amount),
          amount,
          subscription.frequency,
        );
        if (change) {
          subscription.detectionMeta = {
            ...(subscription.detectionMeta ?? {}),
            priceChange: change,
          };
        }
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

/** The fields a person edits or decides on, with decimals as numbers so unchanged values stay equal. */
function subscriptionSnapshot(subscription: Subscription) {
  return {
    vendorName: subscription.vendorName,
    amount: Number(subscription.amount),
    frequency: subscription.frequency,
    currency: subscription.currency,
    status: subscription.status,
    categoryId: subscription.categoryId ?? null,
    nextChargeDate: toDay(subscription.nextChargeDate),
    vendorDomain: subscription.vendorDomain ?? null,
    reviewStatus: subscription.reviewStatus,
    reviewAt: toDay(subscription.reviewAt),
    cancellationReason: subscription.cancellationReason ?? null,
    realizedAnnualSavings: Number(subscription.realizedAnnualSavings ?? 0),
  };
}
