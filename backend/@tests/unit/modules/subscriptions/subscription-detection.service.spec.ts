import { countedSql } from '@/common/utils/counted-transactions.util';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationType } from '../../../../src/entities/notification.entity';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionRiskStatus,
  SubscriptionStatus,
} from '../../../../src/entities/subscription.entity';
import { Transaction } from '../../../../src/entities/transaction.entity';
import { NotificationsService } from '../../../../src/modules/notifications/notifications.service';
import { SubscriptionDetectionService } from '../../../../src/modules/subscriptions/subscription-detection.service';

const charge = (date: string, amount: number) => ({
  id: `tx-${date}`,
  counterpartyName: 'Spotify',
  vendorNormalized: 'Spotify',
  amount,
  transactionDate: date,
  categoryId: null,
  currency: 'USD',
});

describe('SubscriptionDetectionService price changes', () => {
  let service: SubscriptionDetectionService;
  let transactions: ReturnType<typeof queryBuilderMock>;
  const subscriptionRepository = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const notificationsService = { createForWorkspaceMembers: jest.fn() };

  function queryBuilderMock(rows: unknown[]) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    return { createQueryBuilder: jest.fn(() => qb) };
  }

  async function build(rows: unknown[]) {
    transactions = queryBuilderMock(rows);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionDetectionService,
        { provide: getRepositoryToken(Transaction), useValue: transactions },
        { provide: getRepositoryToken(Subscription), useValue: subscriptionRepository },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();
    service = module.get(SubscriptionDetectionService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionRepository.save.mockImplementation(async (row: Subscription) => row);
  });

  it('flags a settled new price, stores the yearly effect and tells the workspace', async () => {
    const existing = {
      id: 'sub-1',
      vendorName: 'Spotify',
      currency: 'USD',
      amount: 10,
      frequency: SubscriptionFrequency.MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      riskStatus: SubscriptionRiskStatus.NONE,
      detectionMeta: {},
    } as unknown as Subscription;
    subscriptionRepository.findOne.mockResolvedValue(existing);
    await build([
      charge('2026-05-01', 10),
      charge('2026-06-01', 10),
      charge('2026-07-01', 11),
      charge('2026-08-01', 11),
    ]);

    await service.runDetection('ws-1');

    expect(existing.amount).toBe(11);
    expect(existing.riskStatus).toBe(SubscriptionRiskStatus.PRICE_CHANGED);
    expect(existing.detectionMeta.priceChange).toMatchObject({
      previous: 10,
      current: 11,
      delta: 1,
      yearlyDelta: 12,
    });
    expect(notificationsService.createForWorkspaceMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        type: NotificationType.SUBSCRIPTION_PRICE_CHANGED,
        messageKey: 'subscription.price_changed',
        messageParams: expect.objectContaining({ vendor: 'Spotify', delta: '+1.00', yearly: '+12.00' }),
        entityId: 'sub-1',
      }),
    );
  });

  it('detects subscriptions from confirmed charges only', async () => {
    await build([]);

    await service.runDetection('ws-1');

    const qb = transactions.createQueryBuilder.mock.results[0].value;
    expect(qb.andWhere).toHaveBeenCalledWith(countedSql('t'));
  });

  it('stays quiet while only the latest charge differs, and never repeats a known change', async () => {
    const existing = {
      id: 'sub-1',
      vendorName: 'Spotify',
      currency: 'USD',
      amount: 10,
      frequency: SubscriptionFrequency.MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      riskStatus: SubscriptionRiskStatus.NONE,
      detectionMeta: {},
    } as unknown as Subscription;
    subscriptionRepository.findOne.mockResolvedValue(existing);
    await build([charge('2026-06-01', 10), charge('2026-07-01', 10), charge('2026-08-01', 11)]);

    await service.runDetection('ws-1');
    expect(existing.amount).toBe(10);
    expect(notificationsService.createForWorkspaceMembers).not.toHaveBeenCalled();

    existing.amount = 11;
    existing.detectionMeta = { priceChange: { previous: 10, current: 11 } };
    await build([charge('2026-07-01', 11), charge('2026-08-01', 11)]);
    await service.runDetection('ws-1');
    expect(notificationsService.createForWorkspaceMembers).not.toHaveBeenCalled();
    expect(existing.detectionMeta.priceChange).toMatchObject({ previous: 10, current: 11 });
  });
});
