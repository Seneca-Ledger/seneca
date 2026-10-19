import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertFound } from '../../common/utils/assert-found.util';
import type {
  CreateGoalItemBody,
  GoalItemStatus as GoalItemStatusName,
  GoalItemsResponse,
  UpdateGoalItemBody,
} from '../../contracts';
import { Goal } from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { GoalItem, GoalItemStatus } from '../../entities/goal-item.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { buildRateMap, convertWith, normalizeCurrency, round2, toNumber } from './goal-money.util';

/** The contract's status names onto the column enum; a value missing on either side fails to compile. */
const ITEM_STATUS: Record<GoalItemStatusName, GoalItemStatus> = {
  planned: GoalItemStatus.PLANNED,
  paid: GoalItemStatus.PAID,
};

function itemSnapshot(item: GoalItem) {
  return {
    name: item.name,
    estimatedAmount: toNumber(item.estimatedAmount),
    actualAmount: item.actualAmount === null ? null : toNumber(item.actualAmount),
    currency: item.currency,
    dueMonth: item.dueMonth,
    status: item.status,
    note: item.note,
  };
}

/**
 * The cost breakdown behind a goal.
 *
 * A goal's `targetAmount` is left exactly as the user declared it: these lines
 * explain it rather than overwrite it, so the two can be compared and the drift
 * between "what I budgeted for the move" and "what the move now looks like it
 * costs" stays visible instead of being silently absorbed.
 */
@Injectable()
export class GoalItemsService {
  private readonly logger = new Logger(GoalItemsService.name);

  constructor(
    @InjectRepository(GoalItem)
    private readonly itemRepository: Repository<GoalItem>,
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly auditService: AuditService,
  ) {}

  async list(goalId: string, workspaceId: string): Promise<GoalItemsResponse> {
    const goal = await this.requireGoal(goalId, workspaceId);
    const items = await this.itemRepository.find({
      where: { goalId, workspaceId },
      // Dated lines first and in order, undated ones after: the plan reads as a
      // schedule, and the costs with no month yet collect at the bottom.
      order: { dueMonth: 'ASC', createdAt: 'ASC' },
    });

    return this.buildResponse(goal, items);
  }

  async create(
    goalId: string,
    workspaceId: string,
    userId: string,
    dto: CreateGoalItemBody,
  ): Promise<GoalItemsResponse> {
    const goal = await this.requireGoal(goalId, workspaceId);

    const item = this.itemRepository.create({
      goalId,
      workspaceId,
      createdById: userId,
      name: dto.name,
      estimatedAmount: dto.estimatedAmount,
      actualAmount: dto.actualAmount ?? null,
      // Defaults to the goal's currency, which is what most lines will be in.
      currency: normalizeCurrency(dto.currency || goal.currency),
      dueMonth: dto.dueMonth ?? null,
      status: dto.status ? ITEM_STATUS[dto.status] : GoalItemStatus.PLANNED,
      note: dto.note ?? null,
    });
    const saved = await this.itemRepository.save(item);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: goalId,
      action: AuditAction.UPDATE,
      description: `Added cost line "${saved.name}" to goal "${goal.name}"`,
      diff: { before: null, after: itemSnapshot(saved) },
      meta: { item: { id: saved.id, name: saved.name }, change: 'item_added' },
    });

    return this.list(goalId, workspaceId);
  }

  async update(
    goalId: string,
    itemId: string,
    workspaceId: string,
    userId: string,
    dto: UpdateGoalItemBody,
  ): Promise<GoalItemsResponse> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId, goalId, workspaceId },
    });
    assertFound(item, 'Goal item');
    const before = itemSnapshot(item);

    if (dto.name !== undefined) {
      item.name = dto.name;
    }
    if (dto.estimatedAmount !== undefined) {
      item.estimatedAmount = dto.estimatedAmount;
    }
    if (dto.actualAmount !== undefined) {
      item.actualAmount = dto.actualAmount;
    }
    if (dto.currency !== undefined) {
      item.currency = normalizeCurrency(dto.currency);
    }
    if (dto.dueMonth !== undefined) {
      item.dueMonth = dto.dueMonth;
    }
    if (dto.status !== undefined) {
      item.status = ITEM_STATUS[dto.status];
    }
    if (dto.note !== undefined) {
      item.note = dto.note;
    }

    await this.itemRepository.save(item);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: goalId,
      action: AuditAction.UPDATE,
      description: `Updated cost line "${item.name}"`,
      diff: { before, after: itemSnapshot(item) },
      meta: { item: { id: item.id, name: item.name }, change: 'item_updated' },
    });
    return this.list(goalId, workspaceId);
  }

  async remove(
    goalId: string,
    itemId: string,
    workspaceId: string,
    userId: string,
  ): Promise<GoalItemsResponse> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId, goalId, workspaceId },
    });
    assertFound(item, 'Goal item');
    const before = itemSnapshot(item);

    await this.itemRepository.remove(item);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: goalId,
      action: AuditAction.UPDATE,
      description: `Removed cost line "${before.name}"`,
      diff: { before, after: null },
      meta: { item: { id: itemId, name: before.name }, change: 'item_removed' },
    });
    return this.list(goalId, workspaceId);
  }

  /** The audit trail is a side record: failing to write it must not fail the item change. */
  private async audit(event: CreateAuditEventDto): Promise<void> {
    try {
      await this.auditService.createEvent(event);
    } catch (error) {
      this.logger.warn(
        `Failed to record audit event for goal ${event.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * The estimate as one number in the goal's currency, for the plan service.
   * Returns 0 when nothing has been itemised, which reads as "no breakdown"
   * rather than "the move is free" — the caller compares it against the target.
   */
  async estimatedTotal(goalId: string, workspaceId: string, currency: string): Promise<number> {
    const items = await this.itemRepository.find({ where: { goalId, workspaceId } });
    if (items.length === 0) {
      return 0;
    }

    const rates = await buildRateMap(
      this.exchangeRatesService,
      items.map(item => item.currency),
      normalizeCurrency(currency),
      workspaceId,
    );

    return round2(
      items.reduce((sum, item) => sum + convertWith(rates, item.estimatedAmount, item.currency), 0),
    );
  }

  private async buildResponse(goal: Goal, items: GoalItem[]): Promise<GoalItemsResponse> {
    const currency = normalizeCurrency(goal.currency);
    const targetAmount = toNumber(goal.targetAmount);

    const rates = await buildRateMap(
      this.exchangeRatesService,
      items.map(item => item.currency),
      currency,
      goal.workspaceId,
    );

    let estimatedTotal = 0;
    let committedTotal = 0;
    let paidTotal = 0;

    for (const item of items) {
      const estimated = convertWith(rates, item.estimatedAmount, item.currency);
      const actual =
        item.actualAmount === null ? null : convertWith(rates, item.actualAmount, item.currency);
      const committed = actual ?? estimated;

      estimatedTotal += estimated;
      committedTotal += committed;
      if (item.status === GoalItemStatus.PAID) {
        paidTotal += committed;
      }
    }

    return {
      currency,
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        estimatedAmount: toNumber(item.estimatedAmount),
        actualAmount: item.actualAmount === null ? null : toNumber(item.actualAmount),
        currency: item.currency,
        dueMonth: item.dueMonth,
        status: item.status,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
      })),
      summary: {
        estimatedTotal: round2(estimatedTotal),
        committedTotal: round2(committedTotal),
        paidTotal: round2(paidTotal),
        outstanding: round2(Math.max(committedTotal - paidTotal, 0)),
        targetAmount,
        unallocated: round2(targetAmount - estimatedTotal),
      },
    };
  }

  /** Tenant guard: a goal id from another workspace must not resolve here. */
  private async requireGoal(goalId: string, workspaceId: string): Promise<Goal> {
    const goal = await this.goalRepository.findOne({ where: { id: goalId, workspaceId } });
    assertFound(goal, 'Goal');
    return goal;
  }
}
