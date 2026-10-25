import { Logger } from '@nestjs/common';
import { ActorType, AuditAction } from '@/entities/audit-event.entity';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '@/entities/subscription.entity';
import { SubscriptionCharge } from '@/entities/subscription-charge.entity';
import { TransactionType } from '@/entities/transaction.entity';
import { SubscriptionAutoLinkSubscriber } from '@/modules/subscriptions/subscription-autolink.subscriber';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';

const workspaceId = 'workspace-1';
const payeeId = 'payee-example-cloud';
const vendorName = 'Example Cloud';

describe('SubscriptionAutoLinkSubscriber', () => {
  const subscriptionRepository = { findOne: vi.fn(), save: vi.fn() };
  const chargeRepository = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
  const auditService = { createEvent: vi.fn() };
  const manager = {
    query: vi.fn(),
    getRepository: (entity: unknown) =>
      new Map<unknown, unknown>([
        [Subscription, subscriptionRepository],
        [SubscriptionCharge, chargeRepository],
      ]).get(entity),
  };
  let queryRunner: { isTransactionActive: boolean; data: Record<string, unknown> };
  let subscriber: SubscriptionAutoLinkSubscriber;
  /** The subscription ids the rule lookup answers. */
  let ruled: string[];

  const subscription = (over: Record<string, unknown> = {}) => ({
    id: 'sub-1',
    workspaceId,
    vendorName,
    amount: '20.00',
    currency: 'EUR',
    frequency: SubscriptionFrequency.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    nextChargeDate: '2026-10-03',
    lastChargeDate: '2026-09-03',
    riskStatus: 'none',
    detectionMeta: null,
    ...over,
  });
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'tx-new',
    workspaceId,
    payeeId,
    transactionType: TransactionType.EXPENSE,
    amount: -20,
    currency: 'EUR',
    transactionDate: '2026-10-04',
    ...over,
  });
  const insert = (entity: Record<string, unknown>) =>
    subscriber.afterInsert({ entity, manager, queryRunner } as any);
  const lookups = () =>
    manager.query.mock.calls.filter(([sql]) => /FROM subscription_payees/.test(sql));

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    ruled = ['sub-1'];
    queryRunner = { isTransactionActive: true, data: {} };
    manager.query.mockImplementation(async (sql: string) =>
      /FROM subscription_payees/.test(sql) ? ruled.map(id => ({ subscription_id: id })) : undefined,
    );
    subscriptionRepository.findOne.mockResolvedValue(subscription());
    subscriptionRepository.save.mockImplementation(async value => value);
    chargeRepository.findOne.mockResolvedValue(null);
    chargeRepository.create.mockImplementation(value => value);
    chargeRepository.save.mockImplementation(async value => ({
      id: 'charge-auto',
      createdAt: new Date('2026-10-04T08:00:00.000Z'),
      ...value,
    }));
    const service = new SubscriptionsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      auditService as any,
      {} as any,
    );
    const dataSource = { subscribers: [] as unknown[] };
    subscriber = new SubscriptionAutoLinkSubscriber(dataSource as any, service, auditService as any);
    expect(dataSource.subscribers).toEqual([subscriber]);
  });

  it('makes a new row of a ruled payee a payment and moves the subscription past it', async () => {
    subscriber.afterTransactionStart({ queryRunner } as any);
    await insert(row());

    expect(lookups()).toEqual([
      [expect.any(String), [workspaceId, payeeId, SubscriptionStatus.ACTIVE]],
    ]);
    expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'sub-1', workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    expect(chargeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        subscriptionId: 'sub-1',
        transactionId: 'tx-new',
        amount: 20,
        currency: 'EUR',
        chargeDate: '2026-10-04',
        expectedAmount: '20.00',
        expectedDate: '2026-10-03',
        matchStatus: 'matched',
      }),
    );
    expect(subscriptionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ lastChargeDate: '2026-10-04', nextChargeDate: '2026-11-04' }),
    );
    expect(manager.query.mock.calls.map(([sql]) => sql)).toEqual([
      'SAVEPOINT sub_autolink',
      expect.stringContaining('FROM subscription_payees'),
      'RELEASE SAVEPOINT sub_autolink',
    ]);

    // The audit event waits for the commit.
    expect(auditService.createEvent).not.toHaveBeenCalled();
    await subscriber.afterTransactionCommit({ queryRunner } as any);
    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        actorType: ActorType.SYSTEM,
        actorId: null,
        entityId: 'sub-1',
        action: AuditAction.LINK,
        meta: expect.objectContaining({ change: 'charge_auto_linked' }),
      }),
    );
  });

  it('flags a price change the row came in at', async () => {
    await insert(row({ amount: -25 }));

    expect(chargeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 25, matchStatus: 'price_changed' }),
    );
    expect(subscriptionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ riskStatus: 'price_changed' }),
    );
  });

  it('writes no audit event for a link the import rolled back', async () => {
    subscriber.afterTransactionStart({ queryRunner } as any);
    await insert(row());
    subscriber.afterTransactionRollback({ queryRunner } as any);
    await subscriber.afterTransactionCommit({ queryRunner } as any);

    expect(auditService.createEvent).not.toHaveBeenCalled();
  });

  it('never guesses between two active subscriptions sharing the payee', async () => {
    ruled = ['sub-1', 'sub-2'];
    await insert(row());

    expect(lookups()).toHaveLength(1);
    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(chargeRepository.save).not.toHaveBeenCalled();
  });

  it('does nothing for a payee without a rule, in three queries', async () => {
    ruled = [];
    await insert(row());

    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(chargeRepository.findOne).not.toHaveBeenCalled();
    expect(chargeRepository.save).not.toHaveBeenCalled();
  });

  it('does nothing for a subscription no longer active once locked', async () => {
    subscriptionRepository.findOne.mockResolvedValue(
      subscription({ status: SubscriptionStatus.CANCELLED }),
    );
    await insert(row());

    expect(chargeRepository.save).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('leaves income rows, rows without a payee or amount alone without a query', async () => {
    await insert(row({ transactionType: TransactionType.INCOME }));
    await insert(row({ payeeId: null }));
    await insert(row({ amount: null }));
    await insert(row({ workspaceId: null }));

    expect(manager.query).not.toHaveBeenCalled();
  });

  it('skips a row that is already a payment', async () => {
    chargeRepository.findOne.mockResolvedValue({ id: 'charge-other', transactionId: 'tx-new' });
    await insert(row());

    expect(chargeRepository.findOne).toHaveBeenCalledWith({
      where: { transactionId: 'tx-new', workspaceId },
    });
    expect(chargeRepository.save).not.toHaveBeenCalled();
  });

  it('swallows a failure and rolls back to its savepoint, so the import goes on', async () => {
    chargeRepository.save.mockRejectedValue(new Error('boom'));

    await expect(insert(row())).resolves.toBeUndefined();

    expect(manager.query).toHaveBeenLastCalledWith('ROLLBACK TO SAVEPOINT sub_autolink');
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('tx-new'));
    expect(Logger.prototype.warn).not.toHaveBeenCalledWith(expect.stringContaining(vendorName));
    expect(auditService.createEvent).not.toHaveBeenCalled();
  });

  it('runs without a savepoint outside a database transaction and audits at once', async () => {
    queryRunner.isTransactionActive = false;
    await insert(row());

    expect(manager.query.mock.calls.map(([sql]) => sql)).toEqual([
      expect.stringContaining('FROM subscription_payees'),
    ]);
    expect(auditService.createEvent).toHaveBeenCalledTimes(1);
  });
});
