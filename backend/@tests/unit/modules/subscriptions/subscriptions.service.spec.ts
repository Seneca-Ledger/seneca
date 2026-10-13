import { NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { SubscriptionFrequency, SubscriptionStatus } from '@/entities/subscription.entity';
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
  };
  const chargeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
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
    );
  });

  describe('getSummary', () => {
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
});
