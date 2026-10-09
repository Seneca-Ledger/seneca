import { NotFoundException } from '@nestjs/common';
import type { Goal, GoalContribution } from '@/entities';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { GoalsService } from '@/modules/goals/goals.service';
import { workspaceCurrencyStub } from '../../../helpers/workspace-currency-stub';

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    workspaceId: WORKSPACE_ID,
    name: 'Подушка безопасности',
    targetAmount: 1000,
    currency: 'KZT',
    targetDate: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as Goal;
}

function contribution(amount: number, overrides: Partial<GoalContribution> = {}): GoalContribution {
  return {
    id: `contribution-${amount}`,
    goalId: 'goal-1',
    workspaceId: WORKSPACE_ID,
    amount,
    contributionDate: '2026-02-01',
    note: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  } as GoalContribution;
}

function createService(options: {
  goals?: Goal[];
  contributions?: GoalContribution[];
  totals?: Array<{ goalId: string; total: string }>;
  monthlyTotals?: Array<{ goalId: string; total: string }>;
}) {
  const goals = options.goals ?? [];
  const contributions = options.contributions ?? [];
  // A month-scoped list runs the month sum first and the all-time sum second,
  // so the stub answers in that order.
  const pending = options.monthlyTotals ? [options.monthlyTotals] : [];

  const queryBuilder: any = {
    select: jest.fn(() => queryBuilder),
    addSelect: jest.fn(() => queryBuilder),
    where: jest.fn(() => queryBuilder),
    andWhere: jest.fn(() => queryBuilder),
    groupBy: jest.fn(() => queryBuilder),
    getRawMany: jest.fn(async () => pending.shift() ?? options.totals ?? []),
  };

  const goalRepository = {
    create: jest.fn((data: Partial<Goal>) => data as Goal),
    save: jest.fn(async (data: Goal) => data),
    find: jest.fn(async () => goals),
    findOne: jest.fn(async () => goals[0] ?? null),
    softRemove: jest.fn(async (data: Goal) => data),
  } as any;

  const contributionRepository = {
    create: jest.fn((data: Partial<GoalContribution>) => data as GoalContribution),
    save: jest.fn(async (data: GoalContribution) => data),
    find: jest.fn(async () => contributions),
    findOne: jest.fn(async () => contributions[0] ?? null),
    remove: jest.fn(async (data: GoalContribution) => data),
    createQueryBuilder: jest.fn(() => queryBuilder),
  } as any;

  const auditService = { createEvent: jest.fn(async () => ({})) } as any;

  return {
    service: new GoalsService(
      goalRepository,
      contributionRepository,
      auditService,
      workspaceCurrencyStub() as never,
    ),
    goalRepository,
    contributionRepository,
    auditService,
    queryBuilder,
  };
}

describe('GoalsService', () => {
  it('derives progress from the contribution log rather than a stored total', async () => {
    const { service } = createService({
      goals: [goal()],
      totals: [{ goalId: 'goal-1', total: '250' }],
    });

    const [result] = await service.findAll(WORKSPACE_ID);

    expect(result).toMatchObject({
      currentAmount: 250,
      remaining: 750,
      percent: 25,
      isReached: false,
    });
  });

  it('sums the whole workspace in one query instead of one per goal', async () => {
    const { service, contributionRepository } = createService({
      goals: [goal(), goal({ id: 'goal-2', name: 'Отпуск' })],
      totals: [
        { goalId: 'goal-1', total: '100' },
        { goalId: 'goal-2', total: '400' },
      ],
    });

    const results = await service.findAll(WORKSPACE_ID);

    expect(results.map(item => item.currentAmount)).toEqual([100, 400]);
    expect(contributionRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('keeps only the goals that moved in the asked-for month, with that month\'s amount', async () => {
    const { service, contributionRepository } = createService({
      goals: [goal(), goal({ id: 'goal-2', name: 'Отпуск' })],
      monthlyTotals: [{ goalId: 'goal-2', total: '400' }],
      totals: [{ goalId: 'goal-2', total: '900' }],
    });

    const results = await service.findAll(WORKSPACE_ID, '2026-02');

    expect(results.map(item => item.id)).toEqual(['goal-2']);
    expect(results[0]).toMatchObject({ currentAmount: 900, contributedInMonth: 400 });
    expect(contributionRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('bounds the month half-open so December rolls into the next year', async () => {
    const { service, queryBuilder } = createService({
      goals: [goal()],
      monthlyTotals: [{ goalId: 'goal-1', total: '50' }],
      totals: [{ goalId: 'goal-1', total: '50' }],
    });

    await service.findAll(WORKSPACE_ID, '2026-12');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.stringContaining('>= :start'), {
      start: '2026-12-01',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.stringContaining('< :end'), {
      end: '2027-01-01',
    });
  });

  it('leaves the plain list untouched by the month filter', async () => {
    const { service, contributionRepository } = createService({
      goals: [goal()],
      totals: [{ goalId: 'goal-1', total: '250' }],
    });

    const [result] = await service.findAll(WORKSPACE_ID);

    expect(result.contributedInMonth).toBeUndefined();
    expect(contributionRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('treats a goal with no contributions as empty, not as an error', async () => {
    const { service } = createService({ goals: [goal()], totals: [] });

    const [result] = await service.findAll(WORKSPACE_ID);

    expect(result.currentAmount).toBe(0);
    expect(result.percent).toBe(0);
  });

  it('marks an overshot goal reached and never reports negative remaining', async () => {
    const { service } = createService({
      goals: [goal()],
      totals: [{ goalId: 'goal-1', total: '1200' }],
    });

    const [result] = await service.findAll(WORKSPACE_ID);

    expect(result.isReached).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.percent).toBe(120);
  });

  it('nets withdrawals against deposits', async () => {
    const { service } = createService({
      goals: [goal()],
      contributions: [contribution(500), contribution(-200)],
    });

    const result = await service.findOne('goal-1', WORKSPACE_ID);

    expect(result.currentAmount).toBe(300);
    expect(result.contributions).toHaveLength(2);
  });

  it('defaults a contribution to today when no date is given', async () => {
    const { service, contributionRepository } = createService({
      goals: [goal()],
      contributions: [],
    });

    await service.addContribution('goal-1', WORKSPACE_ID, USER_ID, { amount: 100 });

    expect(contributionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 100,
        contributionDate: new Date().toISOString().split('T')[0],
        workspaceId: WORKSPACE_ID,
        createdById: USER_ID,
      }),
    );
  });

  it('hides a deleted goal instead of erasing its history', async () => {
    const { service, goalRepository } = createService({ goals: [goal()] });

    await service.remove('goal-1', WORKSPACE_ID, USER_ID);

    expect(goalRepository.softRemove).toHaveBeenCalled();
  });

  it('refuses to touch a goal that belongs to another workspace', async () => {
    const { service, goalRepository } = createService({ goals: [] });
    goalRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne('goal-1', WORKSPACE_ID)).rejects.toThrow(NotFoundException);
    await expect(
      service.addContribution('goal-1', WORKSPACE_ID, USER_ID, { amount: 100 }),
    ).rejects.toThrow(NotFoundException);
    expect(goalRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'goal-1', workspaceId: WORKSPACE_ID },
    });
  });

  it('leaves fields the update did not mention alone', async () => {
    const { service, goalRepository } = createService({
      goals: [goal({ name: 'Отпуск', targetDate: '2026-12-31' })],
      totals: [{ goalId: 'goal-1', total: '0' }],
    });

    await service.update('goal-1', WORKSPACE_ID, USER_ID, { targetAmount: 5000 });

    expect(goalRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Отпуск', targetAmount: 5000, targetDate: '2026-12-31' }),
    );
  });

  describe('audit trail', () => {
    it('records a created goal in its workspace', async () => {
      const { service, goalRepository, auditService } = createService({});
      goalRepository.save.mockImplementation(async (data: Goal) => ({ ...data, id: 'goal-new' }));

      await service.create(WORKSPACE_ID, USER_ID, { name: 'Lisbon', targetAmount: 5000 });

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          actorId: USER_ID,
          entityType: EntityType.GOAL,
          entityId: 'goal-new',
          action: AuditAction.CREATE,
        }),
      );
    });

    it('records an update with the old and new values', async () => {
      const { service, auditService } = createService({ goals: [goal({ targetAmount: '1000.00' as any })] });

      await service.update('goal-1', WORKSPACE_ID, USER_ID, { targetAmount: 5000 });

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          entityType: EntityType.GOAL,
          entityId: 'goal-1',
          action: AuditAction.UPDATE,
          diff: {
            before: expect.objectContaining({ targetAmount: 1000 }),
            after: expect.objectContaining({ targetAmount: 5000 }),
          },
        }),
      );
    });

    it('records the deletion', async () => {
      const { service, auditService } = createService({ goals: [goal()] });

      await service.remove('goal-1', WORKSPACE_ID, USER_ID);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          entityType: EntityType.GOAL,
          entityId: 'goal-1',
          action: AuditAction.DELETE,
        }),
      );
    });

    it('records a contribution as a change to its goal', async () => {
      const { service, contributionRepository, auditService } = createService({
        goals: [goal({ name: 'Lisbon', currency: 'EUR' })],
      });
      contributionRepository.save.mockImplementation(async (data: GoalContribution) => ({
        ...data,
        id: 'contribution-new',
      }));

      await service.addContribution('goal-1', WORKSPACE_ID, USER_ID, { amount: 250 });

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          actorId: USER_ID,
          entityType: EntityType.GOAL,
          entityId: 'goal-1',
          action: AuditAction.UPDATE,
          description: 'Added contribution of 250 EUR to goal "Lisbon"',
          meta: expect.objectContaining({
            contribution: expect.objectContaining({ id: 'contribution-new', amount: 250 }),
          }),
        }),
      );
    });

    it('records a removed contribution as a change to its goal', async () => {
      const { service, auditService } = createService({
        goals: [goal()],
        contributions: [contribution(300)],
      });

      await service.removeContribution('goal-1', 'contribution-300', WORKSPACE_ID, USER_ID);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          entityType: EntityType.GOAL,
          entityId: 'goal-1',
          action: AuditAction.UPDATE,
          meta: expect.objectContaining({
            contribution: expect.objectContaining({ id: 'contribution-300', amount: 300 }),
          }),
        }),
      );
    });

    it('does not fail the change when the audit write fails', async () => {
      const { service, goalRepository, auditService } = createService({ goals: [goal()] });
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.remove('goal-1', WORKSPACE_ID, USER_ID)).resolves.toBeUndefined();
      expect(goalRepository.softRemove).toHaveBeenCalled();
    });
  });
});
