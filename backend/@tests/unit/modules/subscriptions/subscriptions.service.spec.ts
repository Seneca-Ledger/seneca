import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { Budget } from '@/entities/budget.entity';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '@/entities/subscription.entity';
import { SubscriptionCharge } from '@/entities/subscription-charge.entity';
import { Transaction, TransactionCategorySource } from '@/entities/transaction.entity';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';

const createRepoMock = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  remove: jest.fn(),
});

describe('SubscriptionsService', () => {
  const subscriptionRepository = createRepoMock();
  const notificationsService = {
    createForWorkspaceMembers: jest.fn(),
  };
  const workspaceMemberRepository = {
    findOne: jest.fn(),
  };
  const decisionRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const transactionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const chargeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  // What a database transaction hands the service: the same mocks, by entity.
  const budgetRepository = {
    findOne: jest.fn(),
  };
  const transactionManager = {
    query: jest.fn(),
    update: jest.fn(),
    getRepository: (entity: unknown) =>
      new Map<unknown, unknown>([
        [Subscription, subscriptionRepository],
        [SubscriptionCharge, chargeRepository],
        [Transaction, transactionRepository],
        [Budget, budgetRepository],
      ]).get(entity),
  };
  const taxAssignmentService = {
    resolve: jest.fn(),
  };
  const workspaceRepository = {
    findOne: jest.fn(),
  };
  const exchangeRatesService = {
    convert: jest.fn(),
  };
  const auditService = {
    createEvent: jest.fn(),
  };
  const categoryRepository = {
    findOne: jest.fn(),
  };

  let service: SubscriptionsService;

  beforeEach(() => {
    jest.resetAllMocks();
    chargeRepository.manager.transaction.mockImplementation(async work => work(transactionManager));
    service = new SubscriptionsService(
      subscriptionRepository as any,
      notificationsService as any,
      workspaceMemberRepository as any,
      decisionRepository as any,
      transactionRepository as any,
      chargeRepository as any,
      workspaceRepository as any,
      exchangeRatesService as any,
      auditService as any,
      categoryRepository as any,
      undefined,
      undefined,
      undefined,
      budgetRepository as any,
      taxAssignmentService as any,
    );
  });

  describe('getSummary', () => {
    it('counts every charge due in the next 30 days and what they come to', async () => {
      const today = new Date();
      const inDays = (days: number) =>
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
      subscriptionRepository.find
        .mockResolvedValueOnce([
          // Weekly from today: today, +7, +14, +21, +28.
          { amount: 5, currency: 'USD', frequency: SubscriptionFrequency.WEEKLY, status: SubscriptionStatus.ACTIVE, nextChargeDate: inDays(0) },
          { amount: 20, currency: 'EUR', frequency: SubscriptionFrequency.MONTHLY, status: SubscriptionStatus.ACTIVE, nextChargeDate: inDays(10) },
          // Next charge beyond the window: not counted.
          { amount: 99, currency: 'USD', frequency: SubscriptionFrequency.ANNUAL, status: SubscriptionStatus.ACTIVE, nextChargeDate: inDays(45) },
        ])
        .mockResolvedValueOnce([]);
      subscriptionRepository.count.mockResolvedValue(0);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });
      exchangeRatesService.convert.mockImplementation(async (amount: number) => ({ converted: amount * 1.1 }));

      const result = await service.getSummary('workspace-1');

      expect(result.upcoming30DaysCount).toBe(6);
      expect(result.upcoming30DaysAmount).toBe(5 * 5 + 22);
    });

    it('normalizes active subscription costs to monthly and sums them', async () => {
      // First call lists active rows, the second lists detected ones.
      subscriptionRepository.find
        .mockResolvedValueOnce([
          {
            amount: 100,
            currency: 'USD',
            frequency: SubscriptionFrequency.MONTHLY,
            status: SubscriptionStatus.ACTIVE,
          },
        ])
        .mockResolvedValueOnce([]);
      subscriptionRepository.count.mockResolvedValue(0);

      const result = await service.getSummary('workspace-1');

      expect(result).toEqual({
        totalMonthlyCost: 100,
        activeCount: 1,
        upcomingCount: 0,
        upcoming30DaysCount: 0,
        upcoming30DaysAmount: 0,
        priceChangeCount: 0,
        priceChangeYearlyEffect: 0,
        overdueReviewCount: 0,
        realizedAnnualSavings: 0,
        duplicateCount: 0,
      });
    });

    it('normalizes annual subscriptions to monthly cost', async () => {
      subscriptionRepository.find.mockResolvedValue([
        {
          amount: 1200,
          currency: 'KZT',
          frequency: SubscriptionFrequency.ANNUAL,
          status: SubscriptionStatus.ACTIVE,
        },
      ]);
      subscriptionRepository.count.mockResolvedValue(0);

      const result = await service.getSummary('workspace-1');

      expect(result.totalMonthlyCost).toBe(100);
    });

    it('converts normalized monthly spend to the workspace currency', async () => {
      workspaceRepository.findOne.mockResolvedValue({ currency: 'EUR' });
      subscriptionRepository.find.mockResolvedValue([
        { amount: 100, currency: 'USD', frequency: SubscriptionFrequency.MONTHLY, status: SubscriptionStatus.ACTIVE },
      ]);
      subscriptionRepository.count.mockResolvedValue(0);
      exchangeRatesService.convert.mockResolvedValue({ converted: 90 });

      const result = await service.getSummary('workspace-1');

      expect(exchangeRatesService.convert).toHaveBeenCalledWith(
        100,
        'USD',
        'EUR',
        expect.any(Date),
        'workspace-1',
      );
      expect(result.totalMonthlyCost).toBe(90);
    });

    it('returns management KPIs for price changes, overdue reviews, and realized savings', async () => {
      subscriptionRepository.find.mockResolvedValue([
        {
          amount: 100,
          currency: 'USD',
          frequency: SubscriptionFrequency.MONTHLY,
          status: SubscriptionStatus.ACTIVE,
          reviewAt: new Date('2026-08-03T00:00:00.000Z'),
          riskStatus: 'price_changed',
          realizedAnnualSavings: 1_200,
        },
      ]);
      subscriptionRepository.count.mockResolvedValue(0);

      const result = await service.getSummary('workspace-1');

      expect(result).toMatchObject({
        totalMonthlyCost: 100,
        activeCount: 1,
        upcomingCount: 0,
        upcoming30DaysCount: 0,
        upcoming30DaysAmount: 0,
        priceChangeCount: 1,
        overdueReviewCount: 1,
        realizedAnnualSavings: 1_200,
      });
    });
  });

  describe('assignOwner', () => {
    it('assigns only a member of the current workspace and records the decision', async () => {
      const subscription = { id: 'subscription-1', workspaceId: 'workspace-1', ownerId: null };
      workspaceMemberRepository.findOne.mockResolvedValue({ userId: 'owner-1', workspaceId: 'workspace-1' });
      subscriptionRepository.findOne.mockResolvedValue(subscription);
      subscriptionRepository.save.mockResolvedValue({ ...subscription, ownerId: 'owner-1' });
      decisionRepository.create.mockImplementation(value => value);
      decisionRepository.save.mockImplementation(value => value);

      const result = await service.assignOwner('subscription-1', 'workspace-1', 'owner-1', 'actor-1');

      expect(workspaceMemberRepository.findOne).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-1', userId: 'owner-1' },
      });
      expect(subscriptionRepository.save).toHaveBeenCalledWith({ ...subscription, ownerId: 'owner-1' });
      expect(decisionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'owner_assigned', actorId: 'actor-1', ownerId: 'owner-1' }),
      );
      expect(result.ownerId).toBe('owner-1');
    });
  });

  describe('confirm', () => {
    it('records the detected transaction evidence as immutable charge history', async () => {
      const subscription = {
        id: 'subscription-1', workspaceId: 'workspace-1', status: SubscriptionStatus.DETECTED,
        amount: 100, currency: 'USD', nextChargeDate: new Date('2026-09-01'), detectionMeta: { transactionIds: ['tx-1'] },
      };
      subscriptionRepository.findOne.mockResolvedValue(subscription);
      subscriptionRepository.save.mockResolvedValue({ ...subscription, status: SubscriptionStatus.ACTIVE });
      transactionRepository.find.mockResolvedValue([{ id: 'tx-1', amount: 105, currency: 'USD', transactionDate: new Date('2026-08-01') }]);
      chargeRepository.findOne.mockResolvedValue(null);
      chargeRepository.create.mockImplementation(value => value);
      chargeRepository.save.mockImplementation(value => value);

      await service.confirm('subscription-1', 'workspace-1', 'user-1');

      expect(chargeRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        transactionId: 'tx-1', subscriptionId: 'subscription-1', matchStatus: 'matched', expectedAmount: 100,
      }));
    });

    it('flags a confirmed subscription when its transaction price changes materially', async () => {
      const subscription = {
        id: 'subscription-1', workspaceId: 'workspace-1', status: SubscriptionStatus.DETECTED,
        amount: 100, currency: 'USD', nextChargeDate: new Date('2026-09-01'), detectionMeta: { transactionIds: ['tx-1'] },
      };
      subscriptionRepository.findOne.mockResolvedValue(subscription);
      subscriptionRepository.save.mockImplementation(value => value);
      transactionRepository.find.mockResolvedValue([{ id: 'tx-1', amount: 120, currency: 'USD', transactionDate: new Date('2026-08-01') }]);
      chargeRepository.findOne.mockResolvedValue(null);
      chargeRepository.create.mockImplementation(value => value);
      chargeRepository.save.mockImplementation(value => value);

      await service.confirm('subscription-1', 'workspace-1', 'user-1');

      expect(chargeRepository.save).toHaveBeenCalledWith(expect.objectContaining({ matchStatus: 'price_changed' }));
      expect(subscriptionRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({ riskStatus: 'price_changed' }));
    });
  });

  describe('getMonthStatus', () => {
    const daysFromToday = (days: number) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + days);
      return date;
    };
    const sub = (over: Record<string, unknown> = {}) => ({
      id: 'sub-1',
      amount: 10,
      currency: 'USD',
      frequency: SubscriptionFrequency.ANNUAL,
      nextChargeDate: daysFromToday(0),
      ...over,
    });

    beforeEach(() => {
      chargeRepository.find.mockResolvedValue([]);
    });

    it('reads only active subscriptions of the workspace', async () => {
      subscriptionRepository.find.mockResolvedValue([]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });

      await service.getMonthStatus('workspace-1');

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-1', status: SubscriptionStatus.ACTIVE },
      });
    });

    it('sums paid and unpaid charges in the workspace currency', async () => {
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      // A charge later this month exists unless today is the last day.
      const later = today.getDate() < lastDay ? 1 : 0;
      subscriptionRepository.find.mockResolvedValue([
        sub({ amount: 4 }),
        sub({ id: 'sub-2', currency: 'EUR', amount: 10, nextChargeDate: daysFromToday(later) }),
      ]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });
      exchangeRatesService.convert.mockResolvedValue({ converted: 11 });

      const result = await service.getMonthStatus('workspace-1');

      expect(result.currency).toBe('USD');
      expect(result.paidAmount).toBe(later ? 4 : 15);
      expect(result.paidCount).toBe(later ? 1 : 2);
      expect(result.unpaidAmount).toBe(later ? 11 : 0);
      expect(result.unpaidCount).toBe(later);
    });

    it('lists each charged subscription, still to pay first', async () => {
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      // Needs a day left in the month for a charge still to come.
      if (today.getDate() === lastDay) return;
      subscriptionRepository.find.mockResolvedValue([
        sub({ vendorName: 'ACME Music', vendorDomain: 'acmemusic.com', amount: 4 }),
        sub({ id: 'sub-2', vendorName: 'Example Cloud', vendorDomain: null, amount: 9, nextChargeDate: daysFromToday(1) }),
        // Nothing this month: left out.
        sub({ id: 'sub-3', nextChargeDate: daysFromToday(200) }),
      ]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });

      const result = await service.getMonthStatus('workspace-1');

      expect(result.items).toEqual([
        expect.objectContaining({ subscriptionId: 'sub-2', vendorName: 'Example Cloud', vendorDomain: null, amount: 9, paid: false }),
        expect.objectContaining({ subscriptionId: 'sub-1', vendorName: 'ACME Music', vendorDomain: 'acmemusic.com', amount: 4, paid: true }),
      ]);
    });
  });

  describe('recorded payments', () => {
    const subscription = (over: Record<string, unknown> = {}) => ({
      id: 'sub-1',
      workspaceId: 'workspace-1',
      vendorName: 'ACME Music',
      amount: '9.99',
      currency: 'EUR',
      frequency: SubscriptionFrequency.MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      nextChargeDate: '2026-10-05',
      lastChargeDate: '2026-09-05',
      riskStatus: 'none',
      detectionMeta: null,
      ...over,
    });
    const bankRow = {
      id: 'tx-1',
      workspaceId: 'workspace-1',
      amount: '-10.19',
      currency: 'EUR',
      transactionDate: '2026-10-07',
    };

    beforeEach(() => {
      subscriptionRepository.save.mockImplementation(async value => value);
      chargeRepository.create.mockImplementation(value => value);
      chargeRepository.save.mockImplementation(async value => ({
        id: 'charge-1',
        createdAt: new Date('2026-10-08T10:00:00.000Z'),
        ...value,
      }));
    });

    it('records a payment by hand at the subscription price and moves the next charge past it', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());

      const row = await service.recordCharge('sub-1', 'workspace-1', 'user-1', {
        chargeDate: '2026-10-06',
      });

      expect(subscriptionRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub-1', workspaceId: 'workspace-1' } }),
      );
      expect(row).toEqual({
        id: 'charge-1',
        transactionId: null,
        amount: '9.99',
        currency: 'EUR',
        chargeDate: '2026-10-06',
        expectedAmount: '9.99',
        expectedDate: '2026-10-05',
        matchStatus: 'matched',
        createdAt: '2026-10-08T10:00:00.000Z',
      });
      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastChargeDate: '2026-10-06', nextChargeDate: '2026-11-06' }),
      );
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: EntityType.SUBSCRIPTION,
          entityId: 'sub-1',
          meta: expect.objectContaining({ change: 'charge_recorded' }),
        }),
      );
    });

    it('keeps a next charge that is still ahead of the payment', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription({ nextChargeDate: '2026-10-20' }));

      await service.recordCharge('sub-1', 'workspace-1', 'user-1', {
        chargeDate: '2026-10-06',
        amount: 12,
      });

      expect(chargeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 12, matchStatus: 'price_changed' }),
      );
      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ nextChargeDate: '2026-10-20', riskStatus: 'price_changed' }),
      );
    });

    it('needs a date when no bank row is given', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());

      await expect(
        service.recordCharge('sub-1', 'workspace-1', 'user-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(chargeRepository.save).not.toHaveBeenCalled();
    });

    it('answers 404 for a subscription of another workspace', async () => {
      subscriptionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.recordCharge('sub-1', 'workspace-1', 'user-1', { chargeDate: '2026-10-06' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('takes the date, amount and currency of a bank row', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      transactionRepository.findOne.mockResolvedValue(bankRow);
      chargeRepository.findOne.mockResolvedValue(null);

      const row = await service.recordCharge('sub-1', 'workspace-1', 'user-1', {
        transactionId: 'tx-1',
      });

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tx-1', workspaceId: 'workspace-1' },
      });
      expect(row).toEqual(
        expect.objectContaining({
          transactionId: 'tx-1',
          amount: '10.19',
          currency: 'EUR',
          chargeDate: '2026-10-07',
          matchStatus: 'matched',
        }),
      );
    });

    it('never calls a payment in another currency a price change', async () => {
      // A euro plan billed in another currency: the figure moves with the rate, not the price.
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      transactionRepository.findOne.mockResolvedValue({ ...bankRow, amount: '-37.40', currency: 'ILS' });
      chargeRepository.findOne.mockResolvedValue(null);

      const row = await service.recordCharge('sub-1', 'workspace-1', 'user-1', {
        transactionId: 'tx-1',
      });

      expect(row).toEqual(expect.objectContaining({ currency: 'ILS', matchStatus: 'matched' }));
      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ riskStatus: 'none', detectionMeta: null }),
      );
    });

    it('refuses a bank row that is already a payment', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      transactionRepository.findOne.mockResolvedValue(bankRow);
      chargeRepository.findOne.mockResolvedValue({ id: 'charge-other', transactionId: 'tx-1' });

      await expect(
        service.recordCharge('sub-1', 'workspace-1', 'user-1', { transactionId: 'tx-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(chargeRepository.save).not.toHaveBeenCalled();
    });

    it("treats another workspace's bank row as not found", async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      // Looked up with the caller's workspace, the other workspace's row is not there.
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.recordCharge('sub-1', 'workspace-1', 'user-1', { transactionId: 'tx-other' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tx-other', workspaceId: 'workspace-1' },
      });
      expect(chargeRepository.save).not.toHaveBeenCalled();
    });

    it('links a payment to its bank row, which gives it its date and amount', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      chargeRepository.findOne
        .mockResolvedValueOnce({
          id: 'charge-1',
          subscriptionId: 'sub-1',
          workspaceId: 'workspace-1',
          transactionId: null,
          amount: '9.99',
          currency: 'EUR',
          chargeDate: '2026-10-06',
          expectedAmount: '9.99',
          expectedDate: '2026-10-05',
          matchStatus: 'matched',
          createdAt: new Date('2026-10-08T10:00:00.000Z'),
        })
        .mockResolvedValueOnce(null);
      transactionRepository.findOne.mockResolvedValue(bankRow);
      chargeRepository.save.mockImplementation(async value => value);

      const row = await service.linkCharge('sub-1', 'charge-1', 'workspace-1', 'user-1', {
        transactionId: 'tx-1',
      });

      expect(chargeRepository.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: 'charge-1', subscriptionId: 'sub-1', workspaceId: 'workspace-1' },
      });
      expect(row).toEqual(
        expect.objectContaining({
          id: 'charge-1',
          transactionId: 'tx-1',
          amount: '10.19',
          chargeDate: '2026-10-07',
        }),
      );
      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastChargeDate: '2026-10-07', nextChargeDate: '2026-11-07' }),
      );
    });

    it('removes a payment and takes the last charge date from the ones left', async () => {
      subscriptionRepository.findOne.mockResolvedValue(
        subscription({ lastChargeDate: '2026-10-06' }),
      );
      chargeRepository.findOne
        .mockResolvedValueOnce({ id: 'charge-1', chargeDate: '2026-10-06', amount: '9.99' })
        .mockResolvedValueOnce({ id: 'charge-0', chargeDate: '2026-09-05', amount: '9.99' });

      await service.removeCharge('sub-1', 'charge-1', 'workspace-1', 'user-1');

      expect(chargeRepository.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'charge-1' }),
      );
      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastChargeDate: '2026-09-05', nextChargeDate: '2026-10-05' }),
      );
    });

    it('clears the last charge date when no payment is left', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      chargeRepository.findOne
        .mockResolvedValueOnce({ id: 'charge-1', chargeDate: '2026-09-05', amount: '9.99' })
        .mockResolvedValueOnce(null);

      await service.removeCharge('sub-1', 'charge-1', 'workspace-1', 'user-1');

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastChargeDate: null }),
      );
    });

    describe('payee rules', () => {
      const payeeId = 'payee-acme-music';
      const ruleWrites = () =>
        transactionManager.query.mock.calls.filter(([sql]) => /subscription_payees/.test(sql));

      it("a bank row picked for a payment teaches the subscription the row's payee", async () => {
        subscriptionRepository.findOne.mockResolvedValue(subscription());
        transactionRepository.findOne.mockResolvedValue({ ...bankRow, payeeId });
        chargeRepository.findOne.mockResolvedValue(null);

        await service.recordCharge('sub-1', 'workspace-1', 'user-1', { transactionId: 'tx-1' });

        expect(ruleWrites()).toEqual([
          [expect.stringMatching(/INSERT INTO subscription_payees[\s\S]*ON CONFLICT/), ['workspace-1', 'sub-1', payeeId]],
        ]);
      });

      it('linking a payment to its bank row teaches the payee too', async () => {
        subscriptionRepository.findOne.mockResolvedValue(subscription());
        chargeRepository.findOne
          .mockResolvedValueOnce({ id: 'charge-1', transactionId: null, expectedAmount: '9.99' })
          .mockResolvedValueOnce(null);
        transactionRepository.findOne.mockResolvedValue({ ...bankRow, payeeId });
        chargeRepository.save.mockImplementation(async value => ({ createdAt: new Date(), ...value }));

        await service.linkCharge('sub-1', 'charge-1', 'workspace-1', 'user-1', {
          transactionId: 'tx-1',
        });

        expect(ruleWrites()).toEqual([
          [expect.stringContaining('INSERT INTO subscription_payees'), ['workspace-1', 'sub-1', payeeId]],
        ]);
      });

      it('a payment typed in by hand, or a row without a payee, teaches nothing', async () => {
        subscriptionRepository.findOne.mockResolvedValue(subscription());
        await service.recordCharge('sub-1', 'workspace-1', 'user-1', { chargeDate: '2026-10-06' });

        transactionRepository.findOne.mockResolvedValue({ ...bankRow, payeeId: null });
        chargeRepository.findOne.mockResolvedValue(null);
        await service.recordCharge('sub-1', 'workspace-1', 'user-1', { transactionId: 'tx-1' });

        expect(ruleWrites()).toEqual([]);
      });

      it('removing a payment of a bank row forgets its payee only when no other payment of it is left', async () => {
        subscriptionRepository.findOne.mockResolvedValue(subscription());
        chargeRepository.findOne
          .mockResolvedValueOnce({ id: 'charge-1', transactionId: 'tx-1', chargeDate: '2026-10-07', amount: '10.19' })
          .mockResolvedValueOnce(null);

        await service.removeCharge('sub-1', 'charge-1', 'workspace-1', 'user-1');

        expect(ruleWrites()).toEqual([
          [
            expect.stringMatching(/DELETE FROM subscription_payees[\s\S]*NOT EXISTS/),
            ['workspace-1', 'sub-1', 'tx-1'],
          ],
        ]);
      });

      it('removing a payment typed in by hand leaves the rules alone', async () => {
        subscriptionRepository.findOne.mockResolvedValue(subscription());
        chargeRepository.findOne
          .mockResolvedValueOnce({ id: 'charge-1', transactionId: null, chargeDate: '2026-10-06', amount: '9.99' })
          .mockResolvedValueOnce(null);

        await service.removeCharge('sub-1', 'charge-1', 'workspace-1', 'user-1');

        expect(ruleWrites()).toEqual([]);
      });

      it('confirming a detection books its rows without teaching a rule', async () => {
        subscriptionRepository.findOne.mockResolvedValue(
          subscription({ status: SubscriptionStatus.DETECTED, detectionMeta: { transactionIds: ['tx-1'] } }),
        );
        transactionRepository.find.mockResolvedValue([{ ...bankRow, payeeId }]);
        chargeRepository.findOne.mockResolvedValue(null);

        await service.confirm('sub-1', 'workspace-1', 'user-1');

        expect(chargeRepository.save).toHaveBeenCalled();
        expect(ruleWrites()).toEqual([]);
      });
    });

    it('answers 404 for a payment that is not one of this subscription', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      chargeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeCharge('sub-1', 'charge-x', 'workspace-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(chargeRepository.remove).not.toHaveBeenCalled();
    });

    it('counts a payment recorded this month as paid', async () => {
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      // Needs a day left in the month for a charge still to come by date.
      if (today.getDate() === lastDay) return;
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      subscriptionRepository.find.mockResolvedValue([
        subscription({ amount: 9.99, currency: 'USD', nextChargeDate: tomorrow }),
      ]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });
      chargeRepository.find.mockResolvedValue([{ subscriptionId: 'sub-1' }]);

      const result = await service.getMonthStatus('workspace-1');

      expect(chargeRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'workspace-1' }) }),
      );
      expect(result).toEqual(
        expect.objectContaining({ paidCount: 1, paidAmount: 9.99, unpaidCount: 0, unpaidAmount: 0 }),
      );
      expect(result.items).toEqual([
        expect.objectContaining({ subscriptionId: 'sub-1', paid: true }),
      ]);
    });

    it("lists the vendor's own bank rows first, then the newest, redacting private ones", async () => {
      const bankRowOf = (over: Record<string, unknown>) => ({
        vendorNormalized: null,
        amount: '-9.99',
        currency: 'EUR',
        isPrivate: false,
        ownerMemberId: null,
        ...over,
      });
      const rows = [
        bankRowOf({ id: 'tx-new', counterpartyName: 'Example Cloud', transactionDate: '2026-10-09' }),
        bankRowOf({ id: 'tx-acme', counterpartyName: 'ACME-MUSIC*SUB 1234', transactionDate: '2026-09-05' }),
        // Someone else's private row: never a vendor match, and its payee is hidden.
        bankRowOf({
          id: 'tx-private',
          counterpartyName: 'ACME Music',
          transactionDate: '2026-10-01',
          isPrivate: true,
          ownerMemberId: 'member-2',
        }),
        // The normalized vendor wins over the bank's text; "acme" is the first word.
        bankRowOf({
          id: 'tx-old',
          counterpartyName: 'Corner Shop',
          vendorNormalized: 'acme',
          transactionDate: '2026-08-01',
          amount: '-3.00',
        }),
      ];
      const builder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      transactionRepository.createQueryBuilder.mockReturnValue(builder);

      const result = await service.getChargeCandidates(
        'workspace-1',
        { vendorName: 'ACME Music', statementId: 'statement-1' },
        'member-1',
      );

      expect(builder.where).toHaveBeenCalledWith('tx.workspaceId = :workspaceId', {
        workspaceId: 'workspace-1',
      });
      expect(builder.andWhere).toHaveBeenCalledWith('tx.statementId = :statementId', {
        statementId: 'statement-1',
      });
      expect(result.map(row => [row.transactionId, row.matchesVendor])).toEqual([
        ['tx-acme', true],
        ['tx-old', true],
        ['tx-new', false],
        ['tx-private', false],
      ]);
      expect(result.find(row => row.transactionId === 'tx-private')?.counterpartyName).toBe('—');
      expect(result[0]).toEqual({
        transactionId: 'tx-acme',
        counterpartyName: 'ACME-MUSIC*SUB 1234',
        transactionDate: '2026-09-05',
        amount: 9.99,
        currency: 'EUR',
        matchesVendor: true,
      });
    });
  });

  describe('getChargeCalendar', () => {
    const sub = (over: Record<string, unknown> = {}) => ({
      id: 'sub-1',
      vendorName: 'Netflix',
      vendorDomain: 'netflix.com',
      amount: 100,
      currency: 'USD',
      frequency: SubscriptionFrequency.MONTHLY,
      nextChargeDate: new Date(),
      ...over,
    });

    it('reads only active subscriptions of the workspace', async () => {
      subscriptionRepository.find.mockResolvedValue([]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });

      await service.getChargeCalendar('workspace-1', 6);

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-1', status: SubscriptionStatus.ACTIVE },
      });
    });

    it('converts foreign currencies into the workspace currency', async () => {
      subscriptionRepository.find.mockResolvedValue([sub({ currency: 'EUR', amount: 10 })]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });
      exchangeRatesService.convert.mockResolvedValue({ converted: 11 });

      const result = await service.getChargeCalendar('workspace-1', 2);

      expect(exchangeRatesService.convert).toHaveBeenCalledWith(
        10,
        'EUR',
        'USD',
        expect.any(Date),
        'workspace-1',
      );
      expect(result.currency).toBe('USD');
      expect(result.rows[0].amounts).toEqual([11, 11]);
    });

    it('drops subscriptions with no charge date', async () => {
      subscriptionRepository.find.mockResolvedValue([sub({ nextChargeDate: null })]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });

      const result = await service.getChargeCalendar('workspace-1', 3);

      expect(result.rows).toEqual([]);
      expect(result.monthTotals).toEqual([0, 0, 0]);
    });

    it('clamps the horizon to twelve months', async () => {
      subscriptionRepository.find.mockResolvedValue([]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });

      const result = await service.getChargeCalendar('workspace-1', 99);

      expect(result.months).toHaveLength(12);
    });

    it('totals each month across rows and sorts the biggest spender first', async () => {
      subscriptionRepository.find.mockResolvedValue([
        sub({ id: 'small', vendorName: 'GitHub', amount: 4 }),
        sub({ id: 'big', vendorName: 'WeWork', amount: 690 }),
      ]);
      workspaceRepository.findOne.mockResolvedValue({ currency: 'USD' });

      const result = await service.getChargeCalendar('workspace-1', 2);

      expect(result.rows.map(row => row.vendorName)).toEqual(['WeWork', 'GitHub']);
      result.monthTotals.forEach((total, index) => {
        expect(total).toBe(result.rows.reduce((sum, row) => sum + row.amounts[index], 0));
      });
    });
  });

  describe('audit trail', () => {
    const stored = () => ({
      id: 'subscription-1',
      workspaceId: 'workspace-1',
      vendorName: 'Netflix',
      amount: '15.99',
      frequency: SubscriptionFrequency.MONTHLY,
      currency: 'EUR',
      status: SubscriptionStatus.DETECTED,
      categoryId: null,
      nextChargeDate: '2026-10-01',
      vendorDomain: null,
      ownerId: null,
      reviewStatus: 'current',
      reviewAt: null,
      cancellationReason: null,
      realizedAnnualSavings: '0.00',
    });
    const expectEvent = (action: AuditAction, extra: Record<string, unknown> = {}) =>
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          entityType: EntityType.SUBSCRIPTION,
          entityId: 'subscription-1',
          action,
          ...extra,
        }),
      );

    beforeEach(() => {
      subscriptionRepository.findOne.mockResolvedValue(stored());
      subscriptionRepository.create.mockImplementation(value => value);
      subscriptionRepository.save.mockImplementation(async value => value);
      decisionRepository.create.mockImplementation(value => value);
      decisionRepository.save.mockImplementation(async value => value);
    });

    it('records a created subscription', async () => {
      subscriptionRepository.save.mockImplementation(async value => ({ ...value, id: 'subscription-1' }));

      await service.create('workspace-1', 'user-1', {
        vendorName: 'Netflix',
        amount: 15.99,
        frequency: SubscriptionFrequency.MONTHLY,
      });

      expectEvent(AuditAction.CREATE, { actorId: 'user-1', meta: { name: 'Netflix' } });
    });

    it('refuses a category of another workspace, on create and on update', async () => {
      categoryRepository.findOne.mockResolvedValue(null);
      const theirs = { categoryId: '7d1f0a52-5b1e-4f5e-9d55-2f4f5d6c7b8a' };

      await expect(
        service.create('workspace-1', 'user-1', {
          vendorName: 'Netflix',
          amount: 15.99,
          frequency: SubscriptionFrequency.MONTHLY,
          ...theirs,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.update('subscription-1', 'workspace-1', 'user-1', theirs),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: theirs.categoryId, workspaceId: 'workspace-1' },
      });
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
    });

    it('records an update without flagging untouched decimals and dates as changed', async () => {
      await service.update('subscription-1', 'workspace-1', 'user-1', { amount: 17.99 });

      expectEvent(AuditAction.UPDATE, { actorId: 'user-1' });
      const { diff } = auditService.createEvent.mock.calls[0][0];
      const changed = Object.keys(diff.after).filter(
        key => JSON.stringify(diff.before[key]) !== JSON.stringify(diff.after[key]),
      );
      expect(changed).toEqual(['amount']);
    });

    it('settles a price change once the price is set by hand', async () => {
      const flagged = {
        ...stored(),
        riskStatus: 'price_changed',
        detectionMeta: { priceChange: { previous: 15.99, current: 17.99 }, source: 'detector' },
      };
      subscriptionRepository.findOne.mockResolvedValue(flagged);

      await service.update('subscription-1', 'workspace-1', 'user-1', { amount: 17.99 });

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ riskStatus: 'none', detectionMeta: { source: 'detector' } }),
      );
    });

    it('keeps a price change flagged when only the name is edited', async () => {
      subscriptionRepository.findOne.mockResolvedValue({ ...stored(), riskStatus: 'price_changed' });

      await service.update('subscription-1', 'workspace-1', 'user-1', { vendorName: 'Netflix Family' });

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ riskStatus: 'price_changed' }),
      );
    });

    it('records a removal', async () => {
      await service.remove('subscription-1', 'workspace-1', 'user-1');

      expect(subscriptionRepository.remove).toHaveBeenCalled();
      expectEvent(AuditAction.DELETE, { actorId: 'user-1' });
    });

    it('records a confirmed detection as a status change', async () => {
      await service.confirm('subscription-1', 'workspace-1', 'user-1');

      expectEvent(AuditAction.UPDATE, {
        actorId: 'user-1',
        diff: {
          before: expect.objectContaining({ status: SubscriptionStatus.DETECTED }),
          after: expect.objectContaining({ status: SubscriptionStatus.ACTIVE }),
        },
        meta: expect.objectContaining({ change: 'confirmed' }),
      });
    });

    it('records a dismissed detection as a deletion', async () => {
      await service.dismiss('subscription-1', 'workspace-1', 'user-1');

      expectEvent(AuditAction.DELETE, {
        actorId: 'user-1',
        meta: expect.objectContaining({ change: 'dismissed' }),
      });
    });

    it('records a decision with what was decided', async () => {
      await service.recordDecision('subscription-1', 'workspace-1', 'user-1', {
        decision: 'cancelled',
        note: 'Too expensive',
        realizedAnnualSavings: 191.88,
      } as any);

      expectEvent(AuditAction.UPDATE, {
        actorId: 'user-1',
        meta: expect.objectContaining({
          decision: expect.objectContaining({ type: 'cancelled', realizedAnnualSavings: 191.88 }),
        }),
      });
    });

    it('records an owner change with the previous and new owner', async () => {
      workspaceMemberRepository.findOne.mockResolvedValue({ userId: 'owner-1' });

      await service.assignOwner('subscription-1', 'workspace-1', 'owner-1', 'user-1');

      expectEvent(AuditAction.UPDATE, {
        actorId: 'user-1',
        diff: { before: { ownerId: null }, after: { ownerId: 'owner-1' } },
      });
    });

    it('does not fail the change when the audit write fails', async () => {
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.remove('subscription-1', 'workspace-1', 'user-1')).resolves.toBeUndefined();
      expect(subscriptionRepository.remove).toHaveBeenCalled();
    });
  });

  describe('checkUpcomingCharges', () => {
    const soon = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    };

    it('keeps one running notification per workspace, keyed by the charges it lists', async () => {
      subscriptionRepository.find.mockResolvedValue([
        {
          id: 'sub-adobe',
          workspaceId: 'ws-1',
          vendorName: 'Adobe Creative Cloud',
          amount: '66.45',
          currency: 'EUR',
          nextChargeDate: soon(2),
        },
        {
          id: 'sub-dropbox',
          workspaceId: 'ws-1',
          vendorName: 'Dropbox',
          amount: '11.99',
          currency: 'EUR',
          nextChargeDate: soon(1),
        },
      ]);

      await service.checkUpcomingCharges();

      expect(notificationsService.createForWorkspaceMembers).toHaveBeenCalledTimes(1);
      const payload = notificationsService.createForWorkspaceMembers.mock.calls[0][0];
      expect(payload.messageKey).toBe('subscription.upcoming');
      expect(payload.messageParams.charges.items).toEqual([
        { name: 'Adobe Creative Cloud', amount: 66.45, currency: 'EUR' },
        { name: 'Dropbox', amount: 11.99, currency: 'EUR' },
      ]);
      expect(payload.fingerprint).toBe(
        `sub-adobe:66.45:EUR:${soon(2)}|sub-dropbox:11.99:EUR:${soon(1)}`,
      );
    });

    it('uses the singular wording for a single charge', async () => {
      subscriptionRepository.find.mockResolvedValue([
        {
          id: 'sub-dropbox',
          workspaceId: 'ws-1',
          vendorName: 'Dropbox',
          amount: '11.99',
          currency: 'EUR',
          nextChargeDate: soon(1),
        },
      ]);

      await service.checkUpcomingCharges();

      expect(notificationsService.createForWorkspaceMembers.mock.calls[0][0].messageKey).toBe(
        'subscription.upcoming.one',
      );
    });
  });
  describe('paid from a budget', () => {
    const workspaceId = 'workspace-1';
    const budgetId = '3b0c6a1e-8f2d-4c55-9a7e-1d2e3f4a5b6c';
    const budget = { id: budgetId, name: 'Fun money', categoryId: 'category-fun' };
    const notAssessed = {
      taxRateId: null,
      taxRuleId: null,
      taxSource: null,
      taxAmount: null,
      taxNetAmount: null,
      taxReverseCharge: false,
      taxNotionalAmount: null,
    };
    const subscription = (over: Record<string, unknown> = {}) => ({
      id: 'sub-1',
      workspaceId,
      vendorName: 'ACME Music',
      amount: '9.99',
      currency: 'EUR',
      frequency: SubscriptionFrequency.MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      categoryId: null,
      budgetId,
      nextChargeDate: '2026-10-05',
      lastChargeDate: '2026-09-05',
      riskStatus: 'none',
      detectionMeta: null,
      ...over,
    });
    const bankRow = (over: Record<string, unknown> = {}) => ({
      id: 'tx-1',
      workspaceId,
      payeeId: null,
      amount: '-9.99',
      currency: 'EUR',
      transactionDate: '2026-10-05',
      categoryId: 'category-misc',
      categorySource: TransactionCategorySource.KEYWORD,
      categoryReason: 'music',
      taxLocked: false,
      ...over,
    });
    const categorised = {
      categoryId: budget.categoryId,
      categorySource: TransactionCategorySource.RULE,
      categoryReason: budget.name,
      ...notAssessed,
    };

    beforeEach(() => {
      subscriptionRepository.create.mockImplementation(value => value);
      subscriptionRepository.save.mockImplementation(async value => ({ id: 'sub-1', ...value }));
      chargeRepository.create.mockImplementation(value => value);
      chargeRepository.save.mockImplementation(async value => ({
        id: 'charge-1',
        createdAt: new Date('2026-10-08T10:00:00.000Z'),
        ...value,
      }));
      chargeRepository.findOne.mockResolvedValue(null);
      budgetRepository.findOne.mockResolvedValue(budget);
      taxAssignmentService.resolve.mockResolvedValue(notAssessed);
    });

    it('links a budget of the workspace on create and records it', async () => {
      await service.create(workspaceId, 'user-1', {
        vendorName: 'ACME Music',
        amount: 9.99,
        frequency: SubscriptionFrequency.MONTHLY,
        budgetId,
      });

      expect(budgetRepository.findOne).toHaveBeenCalledWith({ where: { id: budgetId, workspaceId } });
      expect(subscriptionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ budgetId }));
      const { diff } = auditService.createEvent.mock.calls[0][0];
      expect(diff.after.budgetId).toBe(budgetId);
    });

    it('refuses a budget of another workspace, on create and on update', async () => {
      budgetRepository.findOne.mockResolvedValue(null);
      subscriptionRepository.findOne.mockResolvedValue(subscription({ budgetId: null }));

      await expect(
        service.create(workspaceId, 'user-1', {
          vendorName: 'ACME Music',
          amount: 9.99,
          frequency: SubscriptionFrequency.MONTHLY,
          budgetId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.update('sub-1', workspaceId, 'user-1', { budgetId }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(budgetRepository.findOne).toHaveBeenCalledWith({ where: { id: budgetId, workspaceId } });
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
    });

    it('unlinks the budget with null and leaves it alone when left out', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());

      await service.update('sub-1', workspaceId, 'user-1', { vendorName: 'ACME Music Plus' });
      expect(subscriptionRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ budgetId }),
      );

      await service.update('sub-1', workspaceId, 'user-1', { budgetId: null });
      expect(budgetRepository.findOne).not.toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ budgetId: null }),
      );
      const { diff } = auditService.createEvent.mock.calls[1][0];
      expect(diff).toEqual(
        expect.objectContaining({
          before: expect.objectContaining({ budgetId }),
          after: expect.objectContaining({ budgetId: null }),
        }),
      );
      // Unlinking moves no row: only new payments are categorised.
      expect(transactionManager.update).not.toHaveBeenCalled();
    });

    it("a bank row recorded as a payment takes the budget's category", async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      transactionRepository.findOne.mockResolvedValue(bankRow());

      await service.recordCharge('sub-1', workspaceId, 'user-1', { transactionId: 'tx-1' });

      expect(budgetRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: budgetId, workspaceId } }),
      );
      expect(transactionManager.update).toHaveBeenCalledWith(
        Transaction,
        { id: 'tx-1', workspaceId },
        categorised,
      );
      // The tax follows the new category.
      expect(taxAssignmentService.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: budget.categoryId }),
      );
    });

    it('linking a payment to its bank row categorises the row too', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      chargeRepository.findOne
        .mockResolvedValueOnce({
          id: 'charge-1',
          subscriptionId: 'sub-1',
          workspaceId,
          transactionId: null,
          amount: '9.99',
          currency: 'EUR',
          chargeDate: '2026-10-05',
          expectedAmount: '9.99',
          expectedDate: '2026-10-05',
          matchStatus: 'matched',
          createdAt: new Date('2026-10-08T10:00:00.000Z'),
        })
        .mockResolvedValueOnce(null);
      chargeRepository.save.mockImplementation(async value => value);
      transactionRepository.findOne.mockResolvedValue(bankRow());

      await service.linkCharge('sub-1', 'charge-1', workspaceId, 'user-1', { transactionId: 'tx-1' });

      expect(transactionManager.update).toHaveBeenCalledWith(
        Transaction,
        { id: 'tx-1', workspaceId },
        categorised,
      );
    });

    it('keeps a category a person picked, and a row on a filed return', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      transactionRepository.findOne.mockResolvedValueOnce(
        bankRow({ categorySource: TransactionCategorySource.MANUAL }),
      );
      await service.recordCharge('sub-1', workspaceId, 'user-1', { transactionId: 'tx-1' });

      transactionRepository.findOne.mockResolvedValueOnce(bankRow({ id: 'tx-2', taxLocked: true }));
      await service.recordCharge('sub-1', workspaceId, 'user-1', { transactionId: 'tx-2' });

      expect(chargeRepository.save).toHaveBeenCalledTimes(2);
      expect(transactionManager.update).not.toHaveBeenCalled();
    });

    it('a payment typed in by hand has no row to categorise', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription());

      await service.recordCharge('sub-1', workspaceId, 'user-1', { chargeDate: '2026-10-05' });

      expect(chargeRepository.save).toHaveBeenCalled();
      expect(budgetRepository.findOne).not.toHaveBeenCalled();
      expect(transactionManager.update).not.toHaveBeenCalled();
    });

    it('a subscription without a budget leaves the row as it is', async () => {
      subscriptionRepository.findOne.mockResolvedValue(subscription({ budgetId: null }));
      transactionRepository.findOne.mockResolvedValue(bankRow());

      await service.recordCharge('sub-1', workspaceId, 'user-1', { transactionId: 'tx-1' });

      expect(budgetRepository.findOne).not.toHaveBeenCalled();
      expect(transactionManager.update).not.toHaveBeenCalled();
    });

    it("an auto-linked row takes the budget's category in the caller's transaction", async () => {
      transactionManager.query.mockResolvedValue([{ subscription_id: 'sub-1' }]);
      subscriptionRepository.findOne.mockResolvedValue(subscription());
      const row = bankRow({ id: 'tx-new', payeeId: 'payee-acme' }) as unknown as Transaction;

      const audit = await service.autoLinkTransaction(transactionManager as any, row);

      expect(audit).not.toBeNull();
      expect(transactionManager.update).toHaveBeenCalledWith(
        Transaction,
        { id: 'tx-new', workspaceId },
        categorised,
      );
      // The importer's copy of the row says what is stored.
      expect(row).toEqual(expect.objectContaining({ categoryId: budget.categoryId }));
    });
  });
});
