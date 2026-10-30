import { Transaction, TransactionCategorySource } from '@/entities/transaction.entity';
import { PayeeLearningService } from '@/modules/classification/suggestions/payee-learning.service';
import { PayeeLearningSubscriber } from '@/modules/classification/suggestions/payee-learning.subscriber';

const WORKSPACE = 'ws-1';
const PAYEE = 'payee-1';
const FOOD = 'cat-food';
const OTHER = 'cat-other';

describe('PayeeLearningService', () => {
  const build = (match: { categoryId: string; source: string; reason: string } | null) => {
    const wheres: string[] = [];
    const builder = {
      update: () => builder,
      set: vi.fn(() => builder),
      where: (sql: string) => (wheres.push(sql), builder),
      andWhere: (sql: string) => (wheres.push(sql), builder),
      returning: () => builder,
      execute: async () => ({ raw: [{ id: 't2' }, { id: 't3' }] }),
    };
    const classification = { categoryForPayee: vi.fn(async () => match) };
    const taxAssignment = { reassess: vi.fn(async () => 0) };
    const service = new PayeeLearningService(
      { createQueryBuilder: () => builder } as never,
      classification as never,
      taxAssignment as never,
    );
    return { service, builder, wheres, classification, taxAssignment };
  };

  it('suggests the payee’s category on its undecided, unconfirmed rows only', async () => {
    const match = { categoryId: FOOD, source: TransactionCategorySource.HISTORY, reason: 'Shop' };
    const { service, builder, wheres, taxAssignment } = build(match);

    await expect(service.learn(WORKSPACE, PAYEE)).resolves.toBe(2);

    expect(builder.set).toHaveBeenCalledWith({
      categoryId: FOOD,
      categorySource: TransactionCategorySource.HISTORY,
      categoryReason: 'Shop',
    });
    expect(wheres.join(' ')).toContain('is_verified = false');
    expect(wheres.join(' ')).toContain('category_source IN');
    expect(taxAssignment.reassess).toHaveBeenCalledWith(WORKSPACE, { ids: ['t2', 't3'] });
  });

  it('changes nothing when the payee has no history to go by', async () => {
    const { service, taxAssignment } = build(null);

    await expect(service.learn(WORKSPACE, PAYEE)).resolves.toBe(0);
    expect(taxAssignment.reassess).not.toHaveBeenCalled();
  });

  it('learns once from a burst of decisions on one payee', async () => {
    vi.useFakeTimers();
    const { service, classification } = build(null);

    service.schedule(WORKSPACE, PAYEE);
    service.schedule(WORKSPACE, PAYEE);
    await vi.runAllTimersAsync();

    expect(classification.categoryForPayee).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('PayeeLearningSubscriber', () => {
  const build = () => {
    const dataSource = { subscribers: [] as unknown[], query: vi.fn(async () => undefined) };
    const learning = { schedule: vi.fn() };
    const subscriber = new PayeeLearningSubscriber(dataSource as never, learning as never);
    return { subscriber, dataSource, learning };
  };
  const suggested = {
    workspaceId: WORKSPACE,
    payeeId: PAYEE,
    categoryId: FOOD,
    categorySource: TransactionCategorySource.BRAND,
    isVerified: false,
  } as Transaction;
  const update = (after: Partial<Transaction>) =>
    ({ entity: { ...suggested, ...after }, databaseEntity: suggested }) as never;

  it('counts a confirmed suggestion as accepted and teaches the payee', () => {
    const { subscriber, dataSource, learning } = build();

    subscriber.afterUpdate(update({ isVerified: true }));

    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('INSERT'), [
      WORKSPACE,
      TransactionCategorySource.BRAND,
      'accepted',
    ]);
    expect(learning.schedule).toHaveBeenCalledWith(WORKSPACE, PAYEE);
  });

  it('counts a suggestion replaced by hand as corrected', () => {
    const { subscriber, dataSource } = build();

    subscriber.afterUpdate(
      update({ categoryId: OTHER, categorySource: TransactionCategorySource.MANUAL }),
    );

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      WORKSPACE,
      TransactionCategorySource.BRAND,
      'corrected',
    ]);
  });

  it('neither counts nor learns when the system itself changes a suggestion', () => {
    const { subscriber, dataSource, learning } = build();

    subscriber.afterUpdate(
      update({ categoryId: OTHER, categorySource: TransactionCategorySource.HISTORY }),
    );

    expect(dataSource.query).not.toHaveBeenCalled();
    expect(learning.schedule).not.toHaveBeenCalled();
  });

  it('waits for the commit when the write is in a transaction, and drops it on rollback', () => {
    const { subscriber, dataSource } = build();
    const queryRunner = { isTransactionActive: true };
    const event = { ...update({ isVerified: true }), queryRunner } as never;

    subscriber.afterUpdate(event);
    expect(dataSource.query).not.toHaveBeenCalled();
    subscriber.afterTransactionRollback({ queryRunner } as never);
    subscriber.afterTransactionCommit({ queryRunner } as never);
    expect(dataSource.query).not.toHaveBeenCalled();

    subscriber.afterUpdate(event);
    subscriber.afterTransactionCommit({ queryRunner } as never);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });
});
