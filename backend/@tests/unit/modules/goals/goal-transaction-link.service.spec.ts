import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Goal, GoalContribution } from '@/entities';
import { GoalItem, GoalItemStatus } from '@/entities/goal-item.entity';
import { type Transaction, TransactionType } from '@/entities/transaction.entity';
import { GoalTransactionLinkService } from '@/modules/goals/goal-transaction-link.service';

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';
const PAYEE = 'ACME Store - Wireless Buds';

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    workspaceId: WORKSPACE_ID,
    name: 'Lisbon workation',
    currency: 'EUR',
    ...overrides,
  } as Goal;
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    workspaceId: WORKSPACE_ID,
    transactionType: TransactionType.EXPENSE,
    debit: 40,
    credit: null,
    amount: 40,
    currency: 'EUR',
    transactionDate: '2026-10-29' as unknown as Date,
    counterpartyName: PAYEE,
    ...overrides,
  } as Transaction;
}

function createService({
  goals = [goal()],
  transactions = [transaction()],
  contribution = null as Partial<GoalContribution> | null,
  items = [] as Array<Partial<GoalItem>>,
  rate = 1 as number | null,
} = {}) {
  const byIdAndWorkspace =
    <T extends { id: string; workspaceId: string }>(rows: T[]) =>
    async ({ where }: { where: { id: string; workspaceId: string } }) =>
      rows.find(row => row.id === where.id && row.workspaceId === where.workspaceId) ?? null;

  const itemRepository = {
    // Matches every key of `where`, like the real lookup by workspace, goal and transaction.
    findOne: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        items.find(item =>
          Object.entries(where).every(([key, value]) => item[key as keyof GoalItem] === value),
        ) ?? null,
    ),
    update: vi.fn(async () => ({ affected: 1 })),
  };
  const contributions = {
    delete: vi.fn(async () => ({ affected: contribution ? 1 : 0 })),
  };
  const manager = {
    query: vi.fn(async () => []),
    getRepository: vi.fn((entity: unknown) => (entity === GoalItem ? itemRepository : contributions)),
    transaction: vi.fn(async (work: (m: unknown) => Promise<unknown>) => work(manager)),
  };
  const goalRepository = { findOne: vi.fn(byIdAndWorkspace(goals)) } as any;
  const transactionRepository = { findOne: vi.fn(byIdAndWorkspace(transactions)) } as any;
  const contributionRepository = {
    findOne: vi.fn(async () => contribution),
    manager,
  } as any;
  const exchangeRates = { getRateOrNull: vi.fn(async () => rate) } as any;
  const auditService = { createEvent: vi.fn(async () => ({})) } as any;

  return {
    service: new GoalTransactionLinkService(
      goalRepository,
      contributionRepository,
      transactionRepository,
      exchangeRates,
      auditService,
    ),
    manager,
    contributions,
    itemRepository,
    exchangeRates,
    auditService,
  };
}

/** The values bound to the upsert, by column. */
function upserted(query: ReturnType<typeof vi.fn>) {
  const [, params] = query.mock.calls[0] as [string, unknown[]];
  const [goalId, workspaceId, amount, contributionDate, note, createdById, transactionId] = params;
  return { goalId, workspaceId, amount, contributionDate, note, createdById, transactionId };
}

describe('GoalTransactionLinkService', () => {
  it('takes an expense out of the goal', async () => {
    const { service, manager } = createService();

    const link = await service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1');

    expect(link).toEqual({
      goal: { id: 'goal-1', name: 'Lisbon workation', currency: 'EUR' },
      amount: -40,
      itemId: null,
    });
    expect(upserted(manager.query)).toEqual({
      goalId: 'goal-1',
      workspaceId: WORKSPACE_ID,
      amount: -40,
      contributionDate: '2026-10-29',
      note: PAYEE,
      createdById: USER_ID,
      transactionId: 'tx-1',
    });
  });

  it('adds income to the goal', async () => {
    const income = transaction({ transactionType: TransactionType.INCOME, debit: null, credit: 250 });
    const { service } = createService({ transactions: [income] });

    const link = await service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1');

    expect(link.amount).toBe(250);
  });

  it('converts into the goal currency at the transaction date', async () => {
    const { service, exchangeRates } = createService({
      transactions: [transaction({ currency: 'USD', debit: 2.97 })],
      rate: 0.9,
    });

    const link = await service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1');

    expect(link.amount).toBe(-2.67);
    expect(exchangeRates.getRateOrNull).toHaveBeenCalledWith('USD', 'EUR', '2026-10-29', WORKSPACE_ID);
  });

  it('refuses a currency with no rate rather than counting it one to one', async () => {
    const { service, manager } = createService({
      transactions: [transaction({ currency: 'UAH' })],
      rate: null,
    });

    await expect(service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('upserts on the transaction, so linking again moves the one row', async () => {
    const { service, manager } = createService({
      goals: [goal(), goal({ id: 'goal-2', name: 'New laptop' })],
    });

    await service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-2');

    const [sql] = manager.query.mock.calls[0] as [string];
    expect(sql).toContain('ON CONFLICT (transaction_id)');
    expect(sql).toContain('goal_id = EXCLUDED.goal_id');
    expect(upserted(manager.query).goalId).toBe('goal-2');
  });

  it('unlinks by deleting the mirrored row', async () => {
    const { service, contributions, auditService } = createService({
      contribution: { goalId: 'goal-1', transactionId: 'tx-1', amount: -40 },
    });

    const link = await service.set(WORKSPACE_ID, USER_ID, 'tx-1', null);

    expect(link).toEqual({ goal: null, amount: null, itemId: null });
    expect(contributions.delete).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      transactionId: 'tx-1',
    });
    expect(auditService.createEvent).toHaveBeenCalledTimes(1);
  });

  it("does not reach another workspace's transaction or goal", async () => {
    const { service, manager } = createService({
      transactions: [transaction({ workspaceId: 'workspace-2' })],
    });
    await expect(service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const other = createService({ goals: [goal({ workspaceId: 'workspace-2' })] });
    await expect(other.service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.query).not.toHaveBeenCalled();
    expect(other.manager.query).not.toHaveBeenCalled();
  });

  it('reads back the linked goal and what the row moved', async () => {
    const { service } = createService({
      contribution: { goalId: 'goal-1', transactionId: 'tx-1', amount: '-40.00' as never },
    });

    expect(await service.get(WORKSPACE_ID, 'tx-1')).toEqual({
      goal: { id: 'goal-1', name: 'Lisbon workation', currency: 'EUR' },
      amount: -40,
      itemId: null,
    });
  });

  it('marks the chosen cost line paid at what the transaction cost, in its currency', async () => {
    const { service, itemRepository } = createService({
      items: [{ id: 'item-1', goalId: 'goal-1', workspaceId: WORKSPACE_ID, currency: 'USD' }],
      rate: 1.1,
    });

    const link = await service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1', 'item-1');

    expect(link.itemId).toBe('item-1');
    expect(itemRepository.update).toHaveBeenCalledWith(
      { id: 'item-1', workspaceId: WORKSPACE_ID },
      { transactionId: 'tx-1', status: GoalItemStatus.PAID, actualAmount: 44 },
    );
  });

  it('hands the line it paid before back to the plan when another is picked', async () => {
    const { service, itemRepository } = createService({
      items: [
        { id: 'old', goalId: 'goal-1', workspaceId: WORKSPACE_ID, currency: 'EUR', transactionId: 'tx-1' },
        { id: 'new', goalId: 'goal-1', workspaceId: WORKSPACE_ID, currency: 'EUR' },
      ],
    });

    await service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1', 'new');

    expect(itemRepository.update).toHaveBeenCalledWith(
      { id: 'old', workspaceId: WORKSPACE_ID },
      { transactionId: null, status: GoalItemStatus.PLANNED, actualAmount: null },
    );
  });

  it('keeps the linked line when relinking without naming one, and drops it on another goal', async () => {
    const linked = { id: 'item-1', goalId: 'goal-1', workspaceId: WORKSPACE_ID, currency: 'EUR', transactionId: 'tx-1' };
    const same = createService({ items: [linked] });
    expect((await same.service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1')).itemId).toBe('item-1');

    const moved = createService({
      goals: [goal(), goal({ id: 'goal-2', name: 'New laptop' })],
      items: [linked],
    });
    expect((await moved.service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-2')).itemId).toBeNull();
    expect(moved.itemRepository.update).toHaveBeenCalledWith(
      { id: 'item-1', workspaceId: WORKSPACE_ID },
      { transactionId: null, status: GoalItemStatus.PLANNED, actualAmount: null },
    );
  });

  it("refuses a cost line of another goal", async () => {
    const { service } = createService({
      goals: [goal(), goal({ id: 'goal-2' })],
      items: [{ id: 'item-2', goalId: 'goal-2', workspaceId: WORKSPACE_ID, currency: 'EUR' }],
    });

    await expect(service.set(WORKSPACE_ID, USER_ID, 'tx-1', 'goal-1', 'item-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
