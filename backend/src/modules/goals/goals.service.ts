import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertFound } from '../../common/utils/assert-found.util';
import { Goal, GoalContribution } from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import type { CreateContributionDto } from './dto/create-contribution.dto';
import type { CreateGoalDto } from './dto/create-goal.dto';
import type { UpdateGoalDto } from './dto/update-goal.dto';

export interface GoalWithProgress {
  id: string;
  name: string;
  targetAmount: number;
  currency: string;
  targetDate: string | null;
  currentAmount: number;
  remaining: number;
  percent: number;
  isReached: boolean;
  createdAt: Date;
  cover: GoalCover | null;
  /** Only set when the list was asked for one month: what was put aside in it. */
  contributedInMonth?: number;
}

/**
 * How the client should draw the goal's picture. `preset` is a bundled tile it
 * draws itself; `photo` carries the URL of the stored file, served as a static
 * upload. The credit line travels with it because a CC image may not be shown
 * without one.
 */
export type GoalCover =
  | { kind: 'preset'; preset: string }
  | { kind: 'photo'; url: string; attribution: string | null; sourceUrl: string | null };

export interface GoalDetail extends GoalWithProgress {
  contributions: Array<{
    id: string;
    amount: number;
    contributionDate: string;
    note: string | null;
    createdAt: Date;
  }>;
}

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(GoalContribution)
    private readonly contributionRepository: Repository<GoalContribution>,
    private readonly auditService: AuditService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreateGoalDto): Promise<GoalWithProgress> {
    const goal = this.goalRepository.create({
      workspaceId,
      createdById: userId,
      name: dto.name,
      targetAmount: dto.targetAmount,
      currency: await this.workspaceCurrency.resolveFor(workspaceId, dto.currency),
      targetDate: dto.targetDate ?? null,
    });

    const saved = await this.goalRepository.save(goal);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: goalSnapshot(saved) },
    });
    return toProgress(saved, 0);
  }

  async findAll(workspaceId: string, month?: string): Promise<GoalWithProgress[]> {
    // A month narrows the list to the goals that actually moved in it, so the
    // filter has to be read before the goals themselves.
    const monthly = month ? await this.sumContributionsInMonth(workspaceId, month) : null;

    const all = await this.goalRepository.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
    const goals = monthly ? all.filter(goal => monthly.has(goal.id)) : all;

    if (goals.length === 0) {
      return [];
    }

    const totals = await this.sumContributions(
      workspaceId,
      goals.map(goal => goal.id),
    );

    return goals.map(goal => {
      const progress = toProgress(goal, totals.get(goal.id) ?? 0);
      // The whole-list shape stays exactly as it was; only a month-scoped
      // request grows the extra field.
      return monthly ? { ...progress, contributedInMonth: monthly.get(goal.id) ?? 0 } : progress;
    });
  }

  async findOne(id: string, workspaceId: string): Promise<GoalDetail> {
    const goal = await this.goalRepository.findOne({ where: { id, workspaceId } });
    assertFound(goal, 'Goal');

    const contributions = await this.contributionRepository.find({
      where: { goalId: goal.id, workspaceId },
      order: { contributionDate: 'DESC', createdAt: 'DESC' },
    });

    const currentAmount = contributions.reduce(
      (sum, contribution) => sum + toNumber(contribution.amount),
      0,
    );

    return {
      ...toProgress(goal, currentAmount),
      contributions: contributions.map(contribution => ({
        id: contribution.id,
        amount: toNumber(contribution.amount),
        contributionDate: contribution.contributionDate,
        note: contribution.note,
        createdAt: contribution.createdAt,
      })),
    };
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    dto: UpdateGoalDto,
  ): Promise<GoalWithProgress> {
    const goal = await this.goalRepository.findOne({ where: { id, workspaceId } });
    assertFound(goal, 'Goal');
    const before = goalSnapshot(goal);

    if (dto.name !== undefined) {
      goal.name = dto.name;
    }
    if (dto.targetAmount !== undefined) {
      goal.targetAmount = dto.targetAmount;
    }
    if (dto.currency !== undefined) {
      goal.currency = dto.currency;
    }
    if (dto.targetDate !== undefined) {
      goal.targetDate = dto.targetDate;
    }

    await this.goalRepository.save(goal);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: goal.id,
      action: AuditAction.UPDATE,
      diff: { before, after: goalSnapshot(goal) },
      meta: { name: goal.name },
    });
    const totals = await this.sumContributions(workspaceId, [goal.id]);
    return toProgress(goal, totals.get(goal.id) ?? 0);
  }

  /**
   * Soft delete: the contribution history is a record of real money set
   * aside, so removing a goal hides it rather than erasing what happened.
   */
  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const goal = await this.goalRepository.findOne({ where: { id, workspaceId } });
    assertFound(goal, 'Goal');
    const before = goalSnapshot(goal);
    await this.goalRepository.softRemove(goal);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: id,
      action: AuditAction.DELETE,
      diff: { before, after: null },
      meta: { softDeleted: true },
    });
  }

  async addContribution(
    id: string,
    workspaceId: string,
    userId: string,
    dto: CreateContributionDto,
  ): Promise<GoalDetail> {
    const goal = await this.goalRepository.findOne({ where: { id, workspaceId } });
    assertFound(goal, 'Goal');

    const contribution = this.contributionRepository.create({
      goalId: goal.id,
      workspaceId,
      createdById: userId,
      amount: dto.amount,
      contributionDate: dto.contributionDate ?? today(),
      note: dto.note ?? null,
    });
    const saved = await this.contributionRepository.save(contribution);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: goal.id,
      action: AuditAction.UPDATE,
      description: `Added contribution of ${toNumber(saved.amount)} ${goal.currency} to goal "${goal.name}"`,
      meta: { contribution: contributionSnapshot(saved), change: 'contribution_added' },
    });

    return this.findOne(goal.id, workspaceId);
  }

  async removeContribution(
    id: string,
    contributionId: string,
    workspaceId: string,
    userId: string,
  ): Promise<GoalDetail> {
    const contribution = await this.contributionRepository.findOne({
      where: { id: contributionId, goalId: id, workspaceId },
    });
    assertFound(contribution, 'Contribution');
    const removed = contributionSnapshot(contribution);

    await this.contributionRepository.remove(contribution);
    const detail = await this.findOne(id, workspaceId);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Removed contribution of ${removed.amount} ${detail.currency} from goal "${detail.name}"`,
      meta: { contribution: removed, change: 'contribution_removed' },
    });
    return detail;
  }

  /** The audit trail is a side record: failing to write it must not fail the goal change. */
  private async audit(event: CreateAuditEventDto): Promise<void> {
    try {
      await this.auditService.createEvent(event);
    } catch (error) {
      this.logger.warn(
        `Failed to record audit event ${event.action} for goal ${event.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Totals for many goals in one query, so a list of N goals is not N+1. */
  private async sumContributions(
    workspaceId: string,
    goalIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.contributionRepository
      .createQueryBuilder('contribution')
      .select('contribution.goal_id', 'goalId')
      .addSelect('COALESCE(SUM(contribution.amount), 0)', 'total')
      .where('contribution.workspace_id = :workspaceId', { workspaceId })
      .andWhere('contribution.goal_id IN (:...goalIds)', { goalIds })
      .groupBy('contribution.goal_id')
      .getRawMany<{ goalId: string; total: string }>();

    return new Map(rows.map(row => [row.goalId, toNumber(row.total)]));
  }

  /**
   * What each goal received inside one calendar month. A goal missing from the
   * map had no movement that month, which is what makes it the filter too.
   */
  private async sumContributionsInMonth(
    workspaceId: string,
    month: string,
  ): Promise<Map<string, number>> {
    const rows = await this.contributionRepository
      .createQueryBuilder('contribution')
      .select('contribution.goal_id', 'goalId')
      .addSelect('COALESCE(SUM(contribution.amount), 0)', 'total')
      .where('contribution.workspace_id = :workspaceId', { workspaceId })
      .andWhere('contribution.contribution_date >= :start', { start: `${month}-01` })
      .andWhere('contribution.contribution_date < :end', { end: firstDayOfNextMonth(month) })
      .groupBy('contribution.goal_id')
      .getRawMany<{ goalId: string; total: string }>();

    return new Map(rows.map(row => [row.goalId, toNumber(row.total)]));
  }
}

/** Half-open upper bound for a `YYYY-MM` month, so no day of it is missed. */
function firstDayOfNextMonth(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return index === 12 ? `${year + 1}-01-01` : `${year}-${String(index + 1).padStart(2, '0')}-01`;
}

function goalSnapshot(goal: Goal) {
  return {
    name: goal.name,
    targetAmount: toNumber(goal.targetAmount),
    currency: goal.currency,
    targetDate: goal.targetDate ?? null,
  };
}

function contributionSnapshot(contribution: GoalContribution) {
  return {
    id: contribution.id,
    amount: toNumber(contribution.amount),
    contributionDate: contribution.contributionDate,
    note: contribution.note ?? null,
  };
}

function toProgress(goal: Goal, currentAmount: number): GoalWithProgress {
  const targetAmount = toNumber(goal.targetAmount);
  const current = round2(currentAmount);

  return {
    id: goal.id,
    name: goal.name,
    targetAmount,
    currency: goal.currency,
    targetDate: goal.targetDate,
    currentAmount: current,
    // A goal can be overshot; what is left to save is never negative.
    remaining: round2(Math.max(targetAmount - current, 0)),
    percent: targetAmount > 0 ? round2((current / targetAmount) * 100) : 0,
    isReached: current >= targetAmount,
    createdAt: goal.createdAt,
    cover: toCover(goal),
  };
}

function toCover(goal: Goal): GoalCover | null {
  if (goal.coverPreset) {
    return { kind: 'preset', preset: goal.coverPreset };
  }
  if (goal.coverFile) {
    // Served statically, like user avatars: the name is a fresh uuid and only
    // ever reaches a client that was allowed to read this goal.
    return {
      kind: 'photo',
      url: `/uploads/goal-covers/${goal.coverFile}`,
      attribution: goal.coverAttribution,
      sourceUrl: goal.coverSourceUrl,
    };
  }
  return null;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}
