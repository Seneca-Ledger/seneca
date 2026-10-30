import { countedSql, flowsSql } from '@/common/utils/counted-transactions.util';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { BudgetPeriodType, BudgetRolloverMode } from '@/entities/budget.entity';
import { SubscriptionFrequency, SubscriptionStatus } from '@/entities/subscription.entity';
import { WorkspaceKind } from '@/entities/workspace.entity';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import { In, IsNull, MoreThanOrEqual } from 'typeorm';
import { workspaceCurrencyStub } from '../../../helpers/workspace-currency-stub';

const createRepoMock = () => ({
  create: vi.fn((data: unknown) => data),
  save: vi.fn(async (data: unknown) => data),
  find: vi.fn(),
  findOne: vi.fn(),
  remove: vi.fn(),
  createQueryBuilder: vi.fn(),
});

// The period's spending, summed per day and currency; no currency reads as the budget's own.
const createQueryBuilderMock = (total: string) => ({
  select: vi.fn().mockReturnThis(),
  addSelect: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  andWhere: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  addGroupBy: vi.fn().mockReturnThis(),
  getRawMany: vi.fn().mockResolvedValue([{ date: '2026-05-01', currency: null, amount: total }]),
});

describe('BudgetsService', () => {
  const budgetRepository = createRepoMock();
  const transactionRepository = createRepoMock();
  const goalRepository = createRepoMock();
  const categoryRepository = createRepoMock();
  const notificationsService = {
    createForWorkspaceMembers: vi.fn(),
  };
  const auditService = {
    createEvent: vi.fn(),
  };

  let service: BudgetsService;

  beforeEach(() => {
    vi.resetAllMocks();
    // resetAllMocks drops the pass-through implementations, and the service
    // now reads the saved entity back to record it in the audit trail.
    budgetRepository.create.mockImplementation((data: unknown) => data);
    budgetRepository.save.mockImplementation(async (data: unknown) => data);
    categoryRepository.findOne.mockResolvedValue({ id: 'category-1' });
    categoryRepository.find.mockResolvedValue([]);
    vi.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    service = new BudgetsService(
      budgetRepository as any,
      transactionRepository as any,
      goalRepository as any,
      notificationsService as any,
      auditService as any,
      workspaceCurrencyStub() as never,
      categoryRepository as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns budgets with spending computed from transactions', async () => {
    budgetRepository.find.mockResolvedValue([
      {
        id: 'budget-1',
        workspaceId: 'workspace-1',
        categoryId: 'category-1',
        name: 'Cloud tools',
        limitAmount: 100,
        currency: 'USD',
        periodType: BudgetPeriodType.MONTHLY,
        currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
    transactionRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock('30'),
    );

    const result = await service.findAll('workspace-1');

    expect(result[0]).toEqual(
      expect.objectContaining({
        limitAmount: 100,
        spentAmount: 30,
        percentUsed: 30,
        currency: 'USD',
      }),
    );
  });

  it('measures the period of the day asked for, not today', async () => {
    budgetRepository.find.mockResolvedValue([
      {
        id: 'budget-1',
        workspaceId: 'workspace-1',
        categoryId: 'category-1',
        name: 'Cloud tools',
        limitAmount: 100,
        currency: 'USD',
        periodType: BudgetPeriodType.MONTHLY,
        currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
    const query = createQueryBuilderMock('80');
    transactionRepository.createQueryBuilder.mockReturnValue(query);

    const [budget] = await service.findAll('workspace-1', new Date(2026, 2, 31));

    const start = query.andWhere.mock.calls.find(([sql]) => String(sql).includes(':start'));
    const end = query.andWhere.mock.calls.find(([sql]) => String(sql).includes(':end'));
    expect(start?.[1].start).toEqual(new Date(2026, 2, 1));
    expect(end?.[1].end.getMonth()).toBe(2);
    expect(budget).toEqual(expect.objectContaining({ spentAmount: 80, percentUsed: 80 }));
  });

  it('creates a budget with correct fields', async () => {
    budgetRepository.findOne.mockResolvedValue(null);

    await service.create('workspace-1', 'user-1', {
      name: 'Rent',
      categoryId: 'category-1',
      limitAmount: 10000,
      currency: 'KZT',
      periodType: BudgetPeriodType.MONTHLY,
    });

    expect(budgetRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rent',
        categoryId: 'category-1',
        limitAmount: 10000,
        currency: 'KZT',
        periodType: BudgetPeriodType.MONTHLY,
      }),
    );
  });

  it('refuses a category of another workspace', async () => {
    budgetRepository.findOne.mockResolvedValue(null);
    categoryRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create('workspace-1', 'user-1', {
        name: 'Theirs',
        categoryId: 'category-of-another-workspace',
        limitAmount: 10,
        periodType: BudgetPeriodType.MONTHLY,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(categoryRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'category-of-another-workspace', workspaceId: 'workspace-1' },
    });
    expect(budgetRepository.save).not.toHaveBeenCalled();
  });

  it('accepts fields on update via Object.assign', async () => {
    const budget = {
      id: 'budget-1',
      workspaceId: 'workspace-1',
      categoryId: 'category-1',
      name: 'Rent',
      limitAmount: 10000,
      currency: 'KZT',
      periodType: BudgetPeriodType.MONTHLY,
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
    };
    budgetRepository.findOne.mockResolvedValue(budget);

    await service.update('budget-1', 'workspace-1', 'user-1', {
      name: 'Rent updated',
      limitAmount: 12000,
    });

    expect(budgetRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rent updated',
        limitAmount: 12000,
        categoryId: 'category-1',
        periodType: BudgetPeriodType.MONTHLY,
      }),
    );
  });

  it('attaches a budget to a goal of the same workspace', async () => {
    budgetRepository.findOne.mockResolvedValue(null);
    goalRepository.findOne.mockResolvedValue({ id: 'goal-1', workspaceId: 'workspace-1' });

    await service.create('workspace-1', 'user-1', {
      name: 'Renovation supplies',
      categoryId: 'category-1',
      limitAmount: 50000,
      periodType: BudgetPeriodType.MONTHLY,
      goalId: 'goal-1',
    });

    expect(goalRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'goal-1', workspaceId: 'workspace-1' },
    });
    expect(budgetRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: 'goal-1' }),
    );
  });

  it('leaves goalId null when no goal is given', async () => {
    budgetRepository.findOne.mockResolvedValue(null);

    await service.create('workspace-1', 'user-1', {
      name: 'Rent',
      categoryId: 'category-1',
      limitAmount: 10000,
      periodType: BudgetPeriodType.MONTHLY,
    });

    expect(goalRepository.findOne).not.toHaveBeenCalled();
    expect(budgetRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: null }),
    );
  });

  it('looks for a duplicate only among unattached budgets when no goal is given', async () => {
    // A bare null in a find `where` is dropped, so a goal's budget on the same
    // category used to block the household one with a 409.
    budgetRepository.findOne.mockResolvedValue(null);

    await service.create('workspace-1', 'user-1', {
      name: 'Rent',
      categoryId: 'category-1',
      limitAmount: 10000,
      periodType: BudgetPeriodType.MONTHLY,
    });

    expect(budgetRepository.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        categoryId: 'category-1',
        periodType: BudgetPeriodType.MONTHLY,
        goalId: IsNull(),
      },
    });
  });

  it('refuses a goal that belongs to another workspace', async () => {
    budgetRepository.findOne.mockResolvedValue(null);
    goalRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create('workspace-1', 'user-1', {
        name: 'Rent',
        categoryId: 'category-1',
        limitAmount: 10000,
        periodType: BudgetPeriodType.MONTHLY,
        goalId: 'goal-of-another-tenant',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(budgetRepository.save).not.toHaveBeenCalled();
  });

  it('checks the goal on update before assigning the payload', async () => {
    budgetRepository.findOne.mockResolvedValue({
      id: 'budget-1',
      workspaceId: 'workspace-1',
      categoryId: 'category-1',
      goalId: null,
    });
    goalRepository.findOne.mockResolvedValue(null);

    await expect(
      service.update('budget-1', 'workspace-1', 'user-1', { goalId: 'goal-of-another-tenant' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(budgetRepository.save).not.toHaveBeenCalled();
  });

  it('detaches a budget from its goal when goalId is explicitly null', async () => {
    budgetRepository.findOne.mockResolvedValue({
      id: 'budget-1',
      workspaceId: 'workspace-1',
      categoryId: 'category-1',
      goalId: 'goal-1',
    });

    await service.update('budget-1', 'workspace-1', 'user-1', { goalId: null });

    expect(goalRepository.findOne).not.toHaveBeenCalled();
    expect(budgetRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: null }),
    );
  });

  describe('project budgets', () => {
    it('allows a second budget on a category when it serves a goal', async () => {
      // No unattached budget matches, because the create looks for one scoped
      // to the same goal — the household limit on this category is a different
      // row and must not block the project one.
      budgetRepository.findOne.mockResolvedValue(null);
      goalRepository.findOne.mockResolvedValue({ id: 'goal-1', workspaceId: 'workspace-1' });

      await service.create('workspace-1', 'user-1', {
        name: 'Transport for the move',
        categoryId: 'category-1',
        limitAmount: 200000,
        periodType: BudgetPeriodType.MONTHLY,
        goalId: 'goal-1',
      });

      expect(budgetRepository.findOne).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-1',
          categoryId: 'category-1',
          periodType: BudgetPeriodType.MONTHLY,
          goalId: 'goal-1',
        },
      });
      expect(budgetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ goalId: 'goal-1' }),
      );
    });

    it('still rejects a duplicate within the same goal', async () => {
      budgetRepository.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('workspace-1', 'user-1', {
          name: 'Transport for the move',
          categoryId: 'category-1',
          limitAmount: 200000,
          periodType: BudgetPeriodType.MONTHLY,
          goalId: 'goal-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('stores the window it was given', async () => {
      budgetRepository.findOne.mockResolvedValue(null);

      await service.create('workspace-1', 'user-1', {
        name: 'Moving costs',
        categoryId: 'category-1',
        limitAmount: 300000,
        periodType: BudgetPeriodType.MONTHLY,
        startsOn: '2026-02-01',
        endsOn: '2026-08-31',
      });

      expect(budgetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ startsOn: '2026-02-01', endsOn: '2026-08-31' }),
      );
    });

    it('refuses a window that ends before it starts', async () => {
      budgetRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('workspace-1', 'user-1', {
          name: 'Moving costs',
          categoryId: 'category-1',
          limitAmount: 300000,
          periodType: BudgetPeriodType.MONTHLY,
          startsOn: '2026-08-01',
          endsOn: '2026-02-28',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('counts only the part of the month the budget governs', async () => {
      budgetRepository.find.mockResolvedValue([
        {
          id: 'budget-1',
          workspaceId: 'workspace-1',
          categoryId: 'category-1',
          name: 'Moving costs',
          limitAmount: 300000,
          currency: 'KZT',
          periodType: BudgetPeriodType.MONTHLY,
          currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          startsOn: '2026-05-05',
          endsOn: null,
        },
      ]);
      const builder = createQueryBuilderMock('50000');
      transactionRepository.createQueryBuilder.mockReturnValue(builder);

      const [budget] = await service.findAll('workspace-1');

      expect(budget.isActive).toBe(true);
      // The 1st to the 4th is outside the window and never reaches the query.
      expect(builder.andWhere).toHaveBeenCalledWith('t.transaction_date >= :start', {
        start: new Date(2026, 4, 5),
      });
    });

    it('reports no spending once the window has closed', async () => {
      budgetRepository.find.mockResolvedValue([
        {
          id: 'budget-1',
          workspaceId: 'workspace-1',
          categoryId: 'category-1',
          name: 'Moving costs',
          limitAmount: 300000,
          currency: 'KZT',
          periodType: BudgetPeriodType.MONTHLY,
          currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          startsOn: '2026-01-01',
          endsOn: '2026-03-31',
        },
      ]);

      const [budget] = await service.findAll('workspace-1');

      expect(budget.spentAmount).toBe(0);
      expect(budget.percentUsed).toBe(0);
      expect(budget.isActive).toBe(false);
      expect(transactionRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('stops alerting on a budget whose window has closed', async () => {
      budgetRepository.find.mockResolvedValue([
        {
          id: 'budget-1',
          workspaceId: 'workspace-1',
          categoryId: 'category-1',
          name: 'Moving costs',
          limitAmount: 100,
          currency: 'KZT',
          periodType: BudgetPeriodType.MONTHLY,
          currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          startsOn: '2026-01-01',
          endsOn: '2026-03-31',
          alertAt80Sent: false,
          alertAt100Sent: false,
        },
      ]);

      await service.checkBudgetAlerts('workspace-1');

      expect(notificationsService.createForWorkspaceMembers).not.toHaveBeenCalled();
    });
  });

  describe('subcategories and rollover', () => {
    const categoryRepository = { find: vi.fn(), findOne: vi.fn() };
    const walletRepository = { findOne: vi.fn() };

    const withTree = () =>
      new BudgetsService(
        budgetRepository as any,
        transactionRepository as any,
        goalRepository as any,
        notificationsService as any,
        auditService as any,
        workspaceCurrencyStub() as never,
        categoryRepository as any,
        walletRepository as any,
      );

    const monthly = (extra: Record<string, unknown> = {}) => ({
      id: 'budget-1',
      workspaceId: 'workspace-1',
      categoryId: 'food',
      name: 'Food',
      limitAmount: 100,
      currency: 'USD',
      periodType: BudgetPeriodType.MONTHLY,
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      startsOn: null,
      endsOn: null,
      createdAt: new Date('2026-02-10T00:00:00.000Z'),
      ...extra,
    });

    beforeEach(() => {
      categoryRepository.find.mockReset();
      categoryRepository.findOne.mockReset();
      walletRepository.findOne.mockReset();
    });

    it('counts spending in subcategories against a budget on the parent', async () => {
      budgetRepository.find.mockResolvedValue([monthly()]);
      categoryRepository.find
        .mockResolvedValueOnce([{ id: 'groceries' }, { id: 'restaurants' }])
        .mockResolvedValueOnce([]);
      const builder = createQueryBuilderMock('40');
      transactionRepository.createQueryBuilder.mockReturnValue(builder);

      const [budget] = await withTree().findAll('workspace-1');

      expect(budget.spentAmount).toBe(40);
      expect(builder.andWhere).toHaveBeenCalledWith('t.category_id IN (:...categoryIds)', {
        categoryIds: ['food', 'groceries', 'restaurants'],
      });
      // Only what the user confirmed counts against a budget.
      expect(builder.andWhere).toHaveBeenCalledWith(flowsSql('t'));
    });

    it('carries the leftover of earlier periods into the current one', async () => {
      budgetRepository.find.mockResolvedValue([monthly({ rolloverMode: BudgetRolloverMode.CARRY })]);
      categoryRepository.find.mockResolvedValue([]);
      const current = createQueryBuilderMock('50');
      const history = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        addGroupBy: vi.fn().mockReturnThis(),
        // February (budget created on the 10th), March, April: 100 − 30, 100 − 0, 100 − 120.
        getRawMany: vi.fn().mockResolvedValue([
          { date: '2026-02-20', amount: '30' },
          { date: '2026-04-15', amount: '120' },
        ]),
      };
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(current)
        .mockReturnValueOnce(history);

      const [budget] = await withTree().findAll('workspace-1');

      // Feb 100 − 30 = 70, Mar 170 − 0 = 170, Apr 270 − 120 = 150 carried → 250 available.
      expect(budget.carriedAmount).toBe(150);
      expect(budget.availableAmount).toBe(250);
      expect(budget.percentUsed).toBe(20);
      // History starts with the period the budget was created in, whole, like the current one.
      expect(history.andWhere).toHaveBeenCalledWith('t.transaction_date >= :start', {
        start: new Date(2026, 1, 1),
      });
      expect(history.andWhere).toHaveBeenCalledWith(flowsSql('t'));
    });

    it('tells what an expense would do to the budgets up the category tree and to the account', async () => {
      categoryRepository.findOne
        .mockResolvedValueOnce({ id: 'groceries', parentId: 'food' })
        .mockResolvedValueOnce({ id: 'food', parentId: null });
      budgetRepository.find.mockResolvedValue([monthly({ category: { name: 'Food' } })]);
      categoryRepository.find.mockResolvedValue([]);
      walletRepository.findOne.mockResolvedValue({
        id: 'wallet-1',
        name: 'Cash',
        currency: 'USD',
        initialBalance: 10,
      });
      const spent = createQueryBuilderMock('80');
      const sums = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ credit: '5', debit: '0' }),
      };
      transactionRepository.createQueryBuilder.mockReturnValueOnce(spent).mockReturnValueOnce(sums);

      const impact = await withTree().getImpact('workspace-1', {
        categoryId: 'groceries',
        amount: 30,
        currency: 'USD',
        walletId: 'wallet-1',
      });

      expect(budgetRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'workspace-1' }) }),
      );
      expect(impact.budgets).toEqual([
        expect.objectContaining({ id: 'budget-1', remainingAfter: -10, exceeds: true }),
      ]);
      expect(impact.account).toEqual(
        expect.objectContaining({ name: 'Cash', balance: 15, balanceAfter: -15, overdraws: true }),
      );
      expect(sums.andWhere).toHaveBeenCalledWith(countedSql('t'));
      expect(walletRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'wallet-1', workspaceId: 'workspace-1', isActive: true },
      });
    });

    it('touches no account when the expense names none', async () => {
      categoryRepository.findOne.mockResolvedValueOnce({ id: 'groceries', parentId: null });
      budgetRepository.find.mockResolvedValue([]);
      categoryRepository.find.mockResolvedValue([]);

      const impact = await withTree().getImpact('workspace-1', {
        categoryId: 'groceries',
        amount: 30,
        currency: 'USD',
      });

      expect(impact.account).toBeNull();
      expect(walletRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('audit trail', () => {
    const stored = () => ({
      id: 'budget-1',
      workspaceId: 'workspace-1',
      categoryId: 'category-1',
      name: 'Rent',
      limitAmount: '10000.00',
      currency: 'KZT',
      periodType: BudgetPeriodType.MONTHLY,
      goalId: null,
      startsOn: null,
      endsOn: null,
    });

    it('records the creation with the workspace and the acting user', async () => {
      budgetRepository.findOne.mockResolvedValue(null);
      budgetRepository.save.mockImplementation(async (data: any) => ({ id: 'budget-new', ...data }));

      await service.create('workspace-1', 'user-1', {
        name: 'Rent',
        categoryId: 'category-1',
        limitAmount: 10000,
        currency: 'KZT',
        periodType: BudgetPeriodType.MONTHLY,
      });

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          actorId: 'user-1',
          entityType: EntityType.BUDGET,
          entityId: 'budget-new',
          action: AuditAction.CREATE,
          diff: { before: null, after: expect.objectContaining({ name: 'Rent', limitAmount: 10000 }) },
        }),
      );
    });

    it('records an update as before and after, without flagging an untouched decimal limit', async () => {
      budgetRepository.findOne.mockResolvedValue(stored());
      budgetRepository.save.mockImplementation(async (data: any) => data);

      await service.update('budget-1', 'workspace-1', 'user-1', { name: 'Rent 2027' });

      const event = auditService.createEvent.mock.calls[0][0];
      expect(event).toMatchObject({
        workspaceId: 'workspace-1',
        actorId: 'user-1',
        entityType: EntityType.BUDGET,
        entityId: 'budget-1',
        action: AuditAction.UPDATE,
      });
      expect(event.diff.before).toMatchObject({ name: 'Rent', limitAmount: 10000 });
      expect(event.diff.after).toMatchObject({ name: 'Rent 2027', limitAmount: 10000 });
    });

    it('records the deletion', async () => {
      budgetRepository.findOne.mockResolvedValue(stored());

      await service.remove('budget-1', 'workspace-1', 'user-1');

      expect(budgetRepository.remove).toHaveBeenCalled();
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          entityType: EntityType.BUDGET,
          entityId: 'budget-1',
          action: AuditAction.DELETE,
          diff: { before: expect.objectContaining({ name: 'Rent' }), after: null },
        }),
      );
    });

    it('does not fail the change when the audit write fails', async () => {
      budgetRepository.findOne.mockResolvedValue(stored());
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.remove('budget-1', 'workspace-1', 'user-1')).resolves.toBeUndefined();
      expect(budgetRepository.remove).toHaveBeenCalled();
    });
  });

  it('resets alert flags of ordinary workspaces only, leaving a past version as it was copied', async () => {
    budgetRepository.find.mockResolvedValue([]);

    await service.resetPeriodAlertFlags();

    const standard = { kind: WorkspaceKind.STANDARD };
    expect(budgetRepository.find).toHaveBeenCalledWith({
      where: [
        { alertAt80Sent: true, workspace: standard },
        { alertAt100Sent: true, workspace: standard },
      ],
    });
  });
  describe('subscription reserve', () => {
    // Today is 2026-05-08 (fake timers): a monthly budget's period runs to 2026-05-31.
    const workspaceId = 'workspace-1';
    const subscriptionRepository = createRepoMock();
    const chargeRepository = createRepoMock();
    const exchangeRatesService = { getRateOrNull: vi.fn() };
    const budget = (over: Record<string, unknown> = {}) => ({
      id: 'budget-fun',
      workspaceId,
      categoryId: 'category-1',
      name: 'Fun money',
      limitAmount: 100,
      currency: 'USD',
      periodType: BudgetPeriodType.MONTHLY,
      currentPeriodStart: new Date(2026, 4, 1),
      startsOn: null,
      endsOn: null,
      ...over,
    });
    const subscription = (over: Record<string, unknown>) => ({
      id: 'sub-music',
      budgetId: 'budget-fun',
      vendorName: 'ACME Music',
      amount: '5.00',
      currency: 'USD',
      frequency: SubscriptionFrequency.WEEKLY,
      nextChargeDate: '2026-05-11',
      ...over,
    });

    beforeEach(() => {
      transactionRepository.createQueryBuilder.mockReturnValue(createQueryBuilderMock('0'));
      chargeRepository.find.mockResolvedValue([]);
      exchangeRatesService.getRateOrNull.mockImplementation(async (from: string) =>
        from === 'EUR' ? 1.1 : null,
      );
      service = new BudgetsService(
        budgetRepository as any,
        transactionRepository as any,
        goalRepository as any,
        notificationsService as any,
        auditService as any,
        workspaceCurrencyStub() as never,
        categoryRepository as any,
        undefined,
        exchangeRatesService as any,
        undefined,
        subscriptionRepository as any,
        chargeRepository as any,
      );
    });

    it("reserves a weekly subscription's remaining dates in a monthly budget, in its currency", async () => {
      budgetRepository.find.mockResolvedValue([budget(), budget({ id: 'budget-other', name: 'Work' })]);
      subscriptionRepository.find.mockResolvedValue([
        // 11, 18 and 25 May: three charges of 5 USD.
        subscription({}),
        // 20 May, 10 EUR at 1.1.
        subscription({
          id: 'sub-cloud',
          vendorName: 'Example Cloud',
          amount: '10.00',
          currency: 'EUR',
          frequency: SubscriptionFrequency.MONTHLY,
          nextChargeDate: '2026-05-20',
        }),
        // No rate from GBP: left out rather than counted one to one.
        subscription({ id: 'sub-gbp', vendorName: 'Example Radio', currency: 'GBP' }),
        // Paid from another budget.
        subscription({ id: 'sub-other', budgetId: 'budget-other', vendorName: 'Example Tools' }),
      ]);

      const [fun, other] = await service.findAll(workspaceId);

      // One query for every budget in the list, active subscriptions only.
      expect(subscriptionRepository.find).toHaveBeenCalledTimes(1);
      expect(subscriptionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId,
            status: SubscriptionStatus.ACTIVE,
            budgetId: In(['budget-fun', 'budget-other']),
          },
        }),
      );
      expect(fun.subscriptionReserve).toEqual({
        amount: 26,
        items: [
          { subscriptionId: 'sub-music', vendorName: 'ACME Music', amount: 15 },
          { subscriptionId: 'sub-cloud', vendorName: 'Example Cloud', amount: 11 },
        ],
      });
      expect(other.subscriptionReserve).toEqual({
        amount: 15,
        items: [{ subscriptionId: 'sub-other', vendorName: 'Example Tools', amount: 15 }],
      });
    });

    it('reserves nothing for charges before today, and stops at the end of the period', async () => {
      budgetRepository.find.mockResolvedValue([budget()]);
      // A stale next charge (1 May) is caught up: 8, 15, 22 and 29 May are still to come.
      subscriptionRepository.find.mockResolvedValue([subscription({ nextChargeDate: '2026-05-01' })]);

      const [fun] = await service.findAll(workspaceId);

      expect(fun.subscriptionReserve.amount).toBe(20);
    });

    it('does not reserve a charge already paid ahead of its date', async () => {
      budgetRepository.find.mockResolvedValue([budget()]);
      // Paid on 6 May for the 20 May charge: the next charge stays on the 20th.
      subscriptionRepository.find.mockResolvedValue([
        subscription({
          frequency: SubscriptionFrequency.MONTHLY,
          amount: '10.00',
          nextChargeDate: '2026-05-20',
        }),
      ]);
      chargeRepository.find.mockResolvedValue([
        { subscriptionId: 'sub-music', expectedDate: '2026-05-20' },
      ]);

      const [fun] = await service.findAll(workspaceId);

      expect(chargeRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId,
            subscriptionId: In(['sub-music']),
            expectedDate: MoreThanOrEqual('2026-05-08'),
          },
        }),
      );
      expect(fun.subscriptionReserve).toEqual({ amount: 0, items: [] });
    });

    it('reserves nothing for a budget whose window has closed', async () => {
      budgetRepository.find.mockResolvedValue([budget({ endsOn: '2026-04-30' })]);
      subscriptionRepository.find.mockResolvedValue([subscription({})]);

      const [fun] = await service.findAll(workspaceId);

      expect(fun.subscriptionReserve).toEqual({ amount: 0, items: [] });
    });

    it('answers an empty reserve on a single budget with no subscriptions', async () => {
      budgetRepository.findOne.mockResolvedValue(budget());
      subscriptionRepository.find.mockResolvedValue([]);

      const fun = await service.findOne('budget-fun', workspaceId);

      expect(fun.subscriptionReserve).toEqual({ amount: 0, items: [] });
      expect(chargeRepository.find).not.toHaveBeenCalled();
    });
  });
});
