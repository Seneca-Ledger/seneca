import {
  ActorType,
  AuditAction,
  AuditEvent,
  EntityType,
  Severity,
} from '@/entities/audit-event.entity';
import { User } from '@/entities/user.entity';
import { Workspace } from '@/entities/workspace.entity';
import { AuditDescriptionService } from '@/modules/audit/description/audit-description.service';
import { AuditService } from '@/modules/audit/audit.service';
import type { RollbackService } from '@/modules/audit/rollback/rollback.service';
import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';

function createRepoMock<T>() {
  return {
    create: jest.fn((data: Partial<T>) => data as T),
    save: jest.fn(async (data: Partial<T>) => data as T),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<T> & Record<string, any>;
}

describe('AuditService', () => {
  const auditEventRepository = createRepoMock<AuditEvent>();
  const userRepository = createRepoMock<User>();
  const workspaceRepository = createRepoMock<Workspace>();
  const rollbackService = { rollback: jest.fn() } as unknown as RollbackService;
  const descriptionService = new AuditDescriptionService();

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(
      auditEventRepository as any,
      userRepository as any,
      workspaceRepository as any,
      rollbackService as any,
      descriptionService,
    );
  });

  it('createEvent requires entityId', async () => {
    await expect(
      service.createEvent({
        actorType: ActorType.USER,
        actorId: 'u1',
        entityType: EntityType.TRANSACTION,
        entityId: '',
        action: AuditAction.CREATE,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('createEvent resolves actorLabel from user when missing', async () => {
    userRepository.findOne = jest.fn(async () => ({
      id: 'u1',
      email: 'user@example.com',
    }));

    const event = await service.createEvent({
      actorType: ActorType.USER,
      actorId: 'u1',
      entityType: EntityType.TRANSACTION,
      entityId: 't1',
      action: AuditAction.CREATE,
      severity: Severity.INFO,
    });

    expect(auditEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorLabel: 'user@example.com',
        entityId: 't1',
      }),
    );
    expect(event).toBeDefined();
  });

  it('createEvent never offers undo for an entity type rollback cannot restore', async () => {
    await service.createEvent({
      actorType: ActorType.USER,
      actorId: 'u1',
      actorLabel: 'user@example.com',
      entityType: EntityType.PAYABLE,
      entityId: 'p1',
      action: AuditAction.UPDATE,
      isUndoable: true,
    });
    await service.createEvent({
      actorType: ActorType.USER,
      actorId: 'u1',
      actorLabel: 'user@example.com',
      entityType: EntityType.CATEGORY,
      entityId: 'c1',
      action: AuditAction.UPDATE,
    });

    expect(auditEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'p1', isUndoable: false }),
    );
    expect(auditEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'c1', isUndoable: true }),
    );
  });

  it('createEvent generates a human-readable description when missing', async () => {
    userRepository.findOne = jest.fn(async () => ({
      id: 'u1',
      email: 'user@example.com',
    }));

    await service.createEvent({
      actorType: ActorType.USER,
      actorId: 'u1',
      entityType: EntityType.CUSTOM_TABLE,
      entityId: 'table-1',
      action: AuditAction.CREATE,
      diff: {
        before: null,
        after: { id: 'table-1', name: 'Fish Dream product table' },
      },
    });

    // The stored column keeps an English rendering; the locale-independent
    // descriptor rides along in meta for clients to translate.
    expect(auditEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Created: table "Fish Dream product table"',
        meta: expect.objectContaining({
          auditDescription: {
            key: 'createNamed',
            params: { entity: EntityType.CUSTOM_TABLE, name: 'Fish Dream product table' },
          },
        }),
      }),
    );
  });

  it('createEvent preserves explicit description', async () => {
    userRepository.findOne = jest.fn(async () => ({
      id: 'u1',
      email: 'user@example.com',
    }));

    await service.createEvent({
      actorType: ActorType.USER,
      actorId: 'u1',
      entityType: EntityType.WORKSPACE,
      entityId: 'workspace-1',
      action: AuditAction.UPDATE,
      description: 'Переименован рабочий стол команды',
      diff: {
        before: { name: 'Old' },
        after: { name: 'New' },
      },
    });

    expect(auditEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Переименован рабочий стол команды',
      }),
    );
  });

  it('createBatchEvents assigns batchId to all events', async () => {
    const createSpy = jest.spyOn(service, 'createEvent').mockResolvedValue({} as AuditEvent);

    const result = await service.createBatchEvents(
      [
        {
          actorType: ActorType.USER,
          actorId: 'u1',
          entityType: EntityType.TRANSACTION,
          entityId: 't1',
          action: AuditAction.UPDATE,
        },
        {
          actorType: ActorType.USER,
          actorId: 'u1',
          entityType: EntityType.TRANSACTION,
          entityId: 't2',
          action: AuditAction.UPDATE,
        },
      ],
      'batch-1',
    );

    expect(result.batchId).toBe('batch-1');
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ batchId: 'batch-1' }));
  });

  it('findEvents applies filters and pagination', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    auditEventRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

    const result = await service.findEvents({
      workspaceId: 'w1',
      entityType: EntityType.TRANSACTION,
      actorType: ActorType.USER,
      actorId: 'u1',
      batchId: 'batch-1',
      action: AuditAction.UPDATE,
      actorLabel: 'admin@example.com',
      severity: Severity.WARN,
      dateFrom: '2025-01-01',
      dateTo: '2025-01-02',
      page: 2,
      limit: 10,
    });

    expect(qb.andWhere).toHaveBeenCalledWith('event.workspaceId = :workspaceId', {
      workspaceId: 'w1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('event.entityType = :entityType', {
      entityType: EntityType.TRANSACTION,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('event.actorType = :actorType', {
      actorType: ActorType.USER,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('event.actorId = :actorId', { actorId: 'u1' });
    expect(qb.andWhere).toHaveBeenCalledWith('event.batchId = :batchId', { batchId: 'batch-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('event.action = :action', {
      action: AuditAction.UPDATE,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('event.actorLabel ILIKE :actorLabel', {
      actorLabel: '%admin@example.com%',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('event.severity = :severity', {
      severity: Severity.WARN,
    });
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result).toEqual({ data: [], total: 0, page: 2, limit: 10 });
  });

  it('rollback creates rollback audit event on success', async () => {
    const event = {
      id: 'evt-1',
      workspaceId: null,
      isUndoable: true,
      entityType: EntityType.TRANSACTION,
      entityId: 't1',
      action: AuditAction.UPDATE,
      diff: { before: { amount: 1 }, after: { amount: 2 } },
    } as AuditEvent;

    auditEventRepository.findOne = jest.fn(async () => event);
    auditEventRepository.save = jest.fn(async (data: any) => ({ id: 'rollback-1', ...data }));
    userRepository.findOne = jest.fn(async () => ({ id: 'u1', email: 'user@example.com' }));
    rollbackService.rollback = jest.fn().mockResolvedValue({ success: true, message: 'ok' });

    const result = await service.rollback('evt-1', 'u1');

    expect(rollbackService.rollback).toHaveBeenCalledWith(event);
    expect(auditEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ROLLBACK,
        meta: expect.objectContaining({ rollbackOf: 'evt-1' }),
      }),
    );
    expect(result.success).toBe(true);
  });
});
