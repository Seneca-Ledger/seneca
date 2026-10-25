import type { Mock } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { GoalItemStatus } from '@/entities/goal-item.entity';
import { GoalItemsService } from '@/modules/goals/goal-items.service';

const WORKSPACE_ID = 'workspace-1';
const GOAL_ID = 'goal-1';

const goal = { id: GOAL_ID, currency: 'KZT', targetAmount: '3000000' };

function createService(options: {
  goal?: Record<string, unknown> | null;
  items?: Array<Record<string, unknown>>;
  rate?: number;
}) {
  const items = options.items ?? [];

  const itemRepository = {
    find: vi.fn(async () => items),
    findOne: vi.fn(async () => items[0] ?? null),
    create: vi.fn((data: Record<string, unknown>) => data),
    save: vi.fn(async (data: unknown) => data),
    remove: vi.fn(async () => undefined),
  } as never;

  const goalRepository = {
    findOne: vi.fn(async () => options.goal ?? null),
  } as never;

  const exchangeRatesService = { getRateOrNull: vi.fn(async () => options.rate ?? 1) } as never;
  const auditService = { createEvent: vi.fn(async () => ({})) };

  return {
    service: new GoalItemsService(
      itemRepository,
      goalRepository,
      exchangeRatesService,
      auditService as never,
    ),
    auditService,
    itemRepository: itemRepository as unknown as {
      create: Mock;
      save: Mock;
      remove: Mock;
      findOne: Mock;
    },
  };
}

const line = (over: Record<string, unknown> = {}) => ({
  id: 'item-1',
  name: 'Deposit',
  estimatedAmount: '500000',
  actualAmount: null,
  currency: 'KZT',
  dueMonth: '2026-06',
  status: GoalItemStatus.PLANNED,
  note: null,
  createdAt: new Date(2026, 4, 1),
  ...over,
});

describe('GoalItemsService', () => {
  it('rejects a goal from another workspace', async () => {
    const { service } = createService({ goal: null });
    await expect(service.list(GOAL_ID, WORKSPACE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds up what the lines are expected to cost', async () => {
    const { service } = createService({
      goal,
      items: [line(), line({ id: 'item-2', estimatedAmount: '250000' })],
    });

    const { summary } = await service.list(GOAL_ID, WORKSPACE_ID);

    expect(summary.estimatedTotal).toBe(750000);
    expect(summary.targetAmount).toBe(3000000);
    expect(summary.unallocated).toBe(2250000);
  });

  it('prefers the real cost to the estimate once it is known', async () => {
    const { service } = createService({
      goal,
      items: [line({ actualAmount: '620000', status: GoalItemStatus.PAID })],
    });

    const { summary } = await service.list(GOAL_ID, WORKSPACE_ID);

    // The estimate stands as written; the committed figure moves to the actual.
    expect(summary.estimatedTotal).toBe(500000);
    expect(summary.committedTotal).toBe(620000);
    expect(summary.paidTotal).toBe(620000);
    expect(summary.outstanding).toBe(0);
  });

  it('counts an unpaid line as outstanding', async () => {
    const { service } = createService({
      goal,
      items: [
        line({ status: GoalItemStatus.PAID, actualAmount: '500000' }),
        line({ id: 'item-2', estimatedAmount: '300000' }),
      ],
    });

    const { summary } = await service.list(GOAL_ID, WORKSPACE_ID);

    expect(summary.paidTotal).toBe(500000);
    expect(summary.outstanding).toBe(300000);
  });

  it('reports an estimate that has outgrown the declared target as negative slack', async () => {
    const { service } = createService({
      goal,
      items: [line({ estimatedAmount: '3400000' })],
    });

    const { summary } = await service.list(GOAL_ID, WORKSPACE_ID);

    expect(summary.unallocated).toBe(-400000);
  });

  it('converts a line in another currency into the goal currency', async () => {
    const { service } = createService({
      goal,
      items: [line({ currency: 'EUR', estimatedAmount: '2000' })],
      rate: 500,
    });

    const { summary, items } = await service.list(GOAL_ID, WORKSPACE_ID);

    expect(summary.estimatedTotal).toBe(1000000);
    // The line itself keeps the currency it was entered in.
    expect(items[0]).toEqual(expect.objectContaining({ currency: 'EUR', estimatedAmount: 2000 }));
  });

  it('defaults a new line to the goal currency', async () => {
    const { service, itemRepository } = createService({ goal });

    await service.create(GOAL_ID, WORKSPACE_ID, 'user-1', {
      name: 'Visa',
      estimatedAmount: 250000,
    });

    expect(itemRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: GOAL_ID,
        workspaceId: WORKSPACE_ID,
        currency: 'KZT',
        status: GoalItemStatus.PLANNED,
        actualAmount: null,
      }),
    );
  });

  it('clears the actual cost when it is explicitly nulled', async () => {
    const { service, itemRepository } = createService({
      goal,
      items: [line({ actualAmount: '620000' })],
    });

    await service.update(GOAL_ID, 'item-1', WORKSPACE_ID, 'user-1', { actualAmount: null });

    expect(itemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ actualAmount: null }),
    );
  });

  it('leaves untouched fields alone on a partial edit', async () => {
    const { service, itemRepository } = createService({
      goal,
      items: [line()],
    });

    await service.update(GOAL_ID, 'item-1', WORKSPACE_ID, 'user-1', { estimatedAmount: 700000 });

    expect(itemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Deposit', dueMonth: '2026-06', estimatedAmount: 700000 }),
    );
  });

  it('refuses to edit a line that is not in this workspace', async () => {
    const { service } = createService({ goal, items: [] });

    await expect(
      service.update(GOAL_ID, 'item-1', WORKSPACE_ID, 'user-1', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sums the estimate in a currency the plan asks for', async () => {
    const { service } = createService({
      goal,
      items: [line({ currency: 'EUR', estimatedAmount: '1000' })],
      rate: 2,
    });

    await expect(service.estimatedTotal(GOAL_ID, WORKSPACE_ID, 'USD')).resolves.toBe(2000);
  });

  it('reports no estimate at all when nothing has been itemised', async () => {
    const { service } = createService({ goal, items: [] });

    await expect(service.estimatedTotal(GOAL_ID, WORKSPACE_ID, 'KZT')).resolves.toBe(0);
  });

  describe('audit trail', () => {
    const expectGoalEvent = (auditService: { createEvent: Mock }, itemId: string) =>
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          actorId: 'user-1',
          entityType: EntityType.GOAL,
          entityId: GOAL_ID,
          action: AuditAction.UPDATE,
          meta: expect.objectContaining({ item: { id: itemId, name: 'Deposit' } }),
        }),
      );

    it('records an added cost line against its goal', async () => {
      const { service, itemRepository, auditService } = createService({ goal: { ...goal, name: 'Lisbon' } });
      itemRepository.save.mockImplementation(async (data: Record<string, unknown>) => ({
        ...data,
        id: 'item-new',
      }));

      await service.create(GOAL_ID, WORKSPACE_ID, 'user-1', {
        name: 'Deposit',
        estimatedAmount: 500000,
      });

      expectGoalEvent(auditService, 'item-new');
    });

    it('records an edited cost line against its goal', async () => {
      const { service, auditService } = createService({ goal, items: [line()] });

      await service.update(GOAL_ID, 'item-1', WORKSPACE_ID, 'user-1', { estimatedAmount: 700000 });

      expectGoalEvent(auditService, 'item-1');
      expect(auditService.createEvent.mock.calls[0][0].diff).toEqual({
        before: expect.objectContaining({ estimatedAmount: 500000 }),
        after: expect.objectContaining({ estimatedAmount: 700000 }),
      });
    });

    it('records a removed cost line against its goal', async () => {
      const { service, auditService } = createService({ goal, items: [line()] });

      await service.remove(GOAL_ID, 'item-1', WORKSPACE_ID, 'user-1');

      expectGoalEvent(auditService, 'item-1');
    });

    it('does not fail the change when the audit write fails', async () => {
      const { service, itemRepository, auditService } = createService({ goal, items: [line()] });
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.remove(GOAL_ID, 'item-1', WORKSPACE_ID, 'user-1')).resolves.toBeDefined();
      expect(itemRepository.remove).toHaveBeenCalled();
    });
  });
});
