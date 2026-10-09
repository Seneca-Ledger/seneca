import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, type Repository } from 'typeorm';
import { getAuditActor } from '../../common/audit-actor.context';
import { normalizePagination } from '../../common/utils/pagination.util';
import {
  ActorType,
  AuditAction,
  AuditEvent,
  type AuditEventDiff,
  EntityType,
  Severity,
} from '../../entities/audit-event.entity';
import { User } from '../../entities/user.entity';
import { Workspace } from '../../entities/workspace.entity';
import {
  AuditDescriptionService,
  renderAuditDescriptionEnglish,
} from './description/audit-description.service';
import type {
  AuditEventFilter,
  CreateAuditEventDto,
  RollbackResult,
} from './interfaces/audit-event.interface';
import { RollbackService } from './rollback/rollback.service';
import {
  HOUSEHOLD_ENTITY_TYPES,
  toActivityEntry,
  type WorkspaceActivityEntry,
} from './workspace-activity';

const AUDIT_RETENTION_YEARS = 1;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEventRepository: Repository<AuditEvent>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly rollbackService: RollbackService,
    private readonly descriptionService: AuditDescriptionService,
  ) {}

  async createEvent(dto: CreateAuditEventDto): Promise<AuditEvent> {
    if (!dto.entityId) {
      throw new BadRequestException('Audit event requires entityId');
    }

    if (dto.workspaceId) {
      const workspace = await this.workspaceRepository.findOne({
        where: { id: dto.workspaceId },
        select: ['id'],
      });
      if (!workspace) {
        throw new BadRequestException('Workspace not found for audit event');
      }
    }

    // An API key or the assistant signs everything written in its request,
    // wherever the event is emitted; and what they changed can always be undone
    // where rollback knows the entity.
    const actor = getAuditActor();
    if (actor && dto.actorType === ActorType.USER) {
      dto = {
        ...dto,
        actorType: actor.actorType,
        actorLabel: actor.actorLabel,
        meta: { ...(dto.meta ?? {}), ...(actor.meta ?? {}), onBehalfOfUserId: dto.actorId ?? null },
        isUndoable: RollbackService.supports(dto.entityType) ? true : dto.isUndoable,
      };
    }
    const actorLabel = await this.resolveActorLabel(dto);
    const isUndoable = this.isUndoable(dto.action, dto.entityType, dto.isUndoable);
    // A caller-supplied description wins; otherwise emit a locale-independent
    // descriptor for clients and an English rendering for the stored column.
    const customDescription = dto.description?.trim();
    const descriptor = customDescription ? null : this.descriptionService.generate(dto);
    const description = descriptor ? renderAuditDescriptionEnglish(descriptor) : customDescription;
    const meta = descriptor
      ? { ...(dto.meta ?? {}), auditDescription: descriptor }
      : (dto.meta ?? null);

    const event = this.auditEventRepository.create({
      workspaceId: dto.workspaceId ?? null,
      actorType: dto.actorType,
      actorId: dto.actorId ?? null,
      actorLabel,
      entityType: dto.entityType,
      entityId: dto.entityId,
      action: dto.action,
      description,
      diff: dto.diff ?? null,
      meta,
      batchId: dto.batchId ?? null,
      severity: dto.severity ?? Severity.INFO,
      isUndoable,
    });

    return this.auditEventRepository.save(event);
  }

  async createBatchEvents(
    events: CreateAuditEventDto[],
    batchId?: string,
  ): Promise<{ batchId: string; events: AuditEvent[] }> {
    const resolvedBatchId = batchId || randomUUID();
    const created: AuditEvent[] = [];

    for (const event of events) {
      // Audit: persist each event under a shared batch id.
      const saved = await this.createEvent({
        ...event,
        batchId: resolvedBatchId,
      });
      created.push(saved);
    }

    return { batchId: resolvedBatchId, events: created };
  }

  async findEvents(filter: AuditEventFilter): Promise<{
    data: AuditEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, skip } = normalizePagination(filter, { defaultLimit: 50, maxLimit: 200 });

    const qb = this.auditEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.actor', 'actor')
      .orderBy('event.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (filter.workspaceId) {
      qb.andWhere('event.workspaceId = :workspaceId', { workspaceId: filter.workspaceId });
    }

    if (filter.entityType) {
      qb.andWhere('event.entityType = :entityType', { entityType: filter.entityType });
    }

    if (filter.entityId) {
      qb.andWhere('event.entityId = :entityId', { entityId: filter.entityId });
    }

    if (filter.actorType) {
      qb.andWhere('event.actorType = :actorType', { actorType: filter.actorType });
    }

    if (filter.actorId) {
      qb.andWhere('event.actorId = :actorId', { actorId: filter.actorId });
    }

    if (filter.action) {
      qb.andWhere('event.action = :action', { action: filter.action });
    }

    if (filter.actorLabel) {
      qb.andWhere('event.actorLabel ILIKE :actorLabel', {
        actorLabel: `%${filter.actorLabel}%`,
      });
    }

    if (filter.batchId) {
      qb.andWhere('event.batchId = :batchId', { batchId: filter.batchId });
    }

    if (filter.severity) {
      qb.andWhere('event.severity = :severity', { severity: filter.severity });
    }

    if (filter.dateFrom) {
      qb.andWhere('event.createdAt >= :dateFrom', {
        dateFrom: new Date(filter.dateFrom),
      });
    }

    if (filter.dateTo) {
      qb.andWhere('event.createdAt <= :dateTo', { dateTo: new Date(filter.dateTo) });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * The household's own feed: who touched the money lately.
   *
   * Narrower than `findEvents` on purpose — it answers "did you change this?",
   * not "what happened on this account", so it never reaches the events that
   * only the owner should see.
   */
  async findWorkspaceActivity(workspaceId: string, limit = 20): Promise<WorkspaceActivityEntry[]> {
    const events = await this.auditEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.actor', 'actor')
      .where('event.workspaceId = :workspaceId', { workspaceId })
      .andWhere('event.entityType IN (:...entityTypes)', {
        entityTypes: HOUSEHOLD_ENTITY_TYPES,
      })
      .orderBy('event.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 100))
      .getMany();

    return events.map(toActivityEntry);
  }

  async findEventById(id: string, workspaceId?: string): Promise<AuditEvent | null> {
    const qb = this.auditEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.actor', 'actor')
      .where('event.id = :id', { id });

    if (workspaceId) {
      qb.andWhere('event.workspaceId = :workspaceId', { workspaceId });
    }

    const event = await qb.getOne();

    if (workspaceId && event && event.workspaceId !== workspaceId) {
      throw new BadRequestException('Audit event is outside workspace scope');
    }

    return event;
  }

  async findEventsByEntity(
    entityType: EntityType,
    entityId: string,
    workspaceId?: string,
  ): Promise<AuditEvent[]> {
    const qb = this.auditEventRepository
      .createQueryBuilder('event')
      .where('event.entityType = :entityType', { entityType })
      .andWhere('event.entityId = :entityId', { entityId })
      .orderBy('event.createdAt', 'DESC');

    if (workspaceId) {
      qb.andWhere('event.workspaceId = :workspaceId', { workspaceId });
    }

    return qb.getMany();
  }

  async findEventsByBatch(batchId: string, workspaceId?: string): Promise<AuditEvent[]> {
    const qb = this.auditEventRepository
      .createQueryBuilder('event')
      .where('event.batchId = :batchId', { batchId })
      .orderBy('event.createdAt', 'DESC');

    if (workspaceId) {
      qb.andWhere('event.workspaceId = :workspaceId', { workspaceId });
    }

    return qb.getMany();
  }

  async rollback(eventId: string, userId: string, workspaceId?: string): Promise<RollbackResult> {
    const event = await this.auditEventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Audit event not found');
    }

    if (workspaceId && event.workspaceId && event.workspaceId !== workspaceId) {
      throw new BadRequestException('Audit event is outside workspace scope');
    }

    if (!event.isUndoable) {
      throw new BadRequestException('Audit event is not undoable');
    }

    const rollbackResult = await this.rollbackService.rollback(event);

    if (!rollbackResult.success) {
      return rollbackResult;
    }

    const rollbackDiff = this.buildRollbackDiff(event.diff);

    // Audit: record rollback action referencing the original event.
    const rollbackEvent = await this.createEvent({
      workspaceId: event.workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: event.entityType,
      entityId: event.entityId,
      action: AuditAction.ROLLBACK,
      diff: rollbackDiff,
      meta: {
        rollbackOf: event.id,
        originalAction: event.action,
      },
      severity: Severity.INFO,
      isUndoable: false,
    });

    return {
      success: true,
      message: rollbackResult.message,
      eventId: rollbackEvent.id,
    };
  }

  private async resolveActorLabel(dto: CreateAuditEventDto): Promise<string> {
    if (dto.actorLabel?.trim()) {
      return dto.actorLabel.trim();
    }

    if (dto.actorType === ActorType.USER && dto.actorId) {
      const user = await this.userRepository.findOne({
        where: { id: dto.actorId },
        select: ['id', 'email', 'name'],
      });
      if (user?.email) {
        return user.email;
      }
      if (user?.name) {
        return user.name;
      }
      return 'User';
    }

    if (dto.actorType === ActorType.INTEGRATION) {
      return 'Integration';
    }

    if (dto.actorType === ActorType.AI) {
      return 'AI assistant';
    }

    return 'System';
  }

  private isUndoable(action: AuditAction, entityType: EntityType, requested?: boolean): boolean {
    // An undo button on an event that rollback cannot handle only fails when pressed.
    if (!RollbackService.supports(entityType)) {
      return false;
    }
    if (requested !== undefined) {
      return requested;
    }
    if (action === AuditAction.ROLLBACK) {
      return false;
    }
    if (action === AuditAction.UPDATE || action === AuditAction.DELETE) {
      return true;
    }
    if (action === AuditAction.CREATE) {
      return [
        EntityType.TABLE_ROW,
        EntityType.TABLE_CELL,
        EntityType.CUSTOM_TABLE,
        EntityType.CUSTOM_TABLE_COLUMN,
      ].includes(entityType);
    }
    return false;
  }

  private buildRollbackDiff(diff: AuditEventDiff | null | undefined): AuditEventDiff | null {
    if (!diff || Array.isArray(diff)) {
      return diff ?? null;
    }

    return {
      before: diff.after ?? null,
      after: diff.before ?? null,
    };
  }

  /**
   * Audit events had no expiry and grew forever. A year keeps them useful for
   * "who changed this" questions without carrying every row from day one.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOldAuditEvents(): Promise<void> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - AUDIT_RETENTION_YEARS);

    const result = await this.auditEventRepository.delete({ createdAt: LessThan(cutoff) });

    if ((result.affected ?? 0) > 0) {
      this.logger.log(`Deleted ${result.affected} audit events older than ${cutoff.toISOString()}`);
    }
  }
}
