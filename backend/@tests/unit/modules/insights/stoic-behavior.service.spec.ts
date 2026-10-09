import { countedSql } from '@/common/utils/counted-transactions.util';
import { SubscriptionFrequency } from '@/entities/subscription.entity';
import { StoicBehaviorService } from '@/modules/insights/stoic/stoic-behavior.service';

/** Each query builder answers with the next prepared result, in call order. */
function transactionRepository(results: unknown[][]) {
  const queue = [...results];
  return {
    createQueryBuilder: jest.fn(() => {
      const rows = queue.shift() ?? [];
      const qb: any = {};
      for (const method of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy']) {
        qb[method] = jest.fn(() => qb);
      }
      qb.getRawMany = jest.fn(async () => rows);
      return qb;
    }),
  };
}

const exchangeRates = { getRate: jest.fn(async (from: string) => (from === 'USD' ? 0.5 : 1)) };

describe('StoicBehaviorService', () => {
  it('merges merchants across categories and currencies, and splits weekends', async () => {
    const transactions = transactionRepository([
      [
        { name: 'Cafe', categoryId: 'fun', currency: 'EUR', count: '6', total: '30' },
        { name: 'Cafe', categoryId: 'food', currency: 'USD', count: '2', total: '20' },
      ],
      [{ name: 'Cafe', count: '11' }],
      [
        { categoryId: 'fun', currency: 'EUR', weekend: true, total: '40' },
        { categoryId: 'fun', currency: 'EUR', weekend: false, total: '10' },
      ],
      [
        { month: '2026-09', type: 'income', currency: 'EUR', total: '1000' },
        { month: '2026-09', type: 'expense', currency: 'USD', total: '400' },
        { month: '2026-08', type: 'income', currency: 'EUR', total: '900' },
      ],
    ]);
    const service = new StoicBehaviorService(
      transactions as any,
      {
        find: jest.fn(async () => [
          { amount: '10', currency: 'EUR', frequency: SubscriptionFrequency.MONTHLY },
          { amount: '120', currency: 'EUR', frequency: SubscriptionFrequency.ANNUAL },
        ]),
      } as any,
      exchangeRates as any,
    );

    const behavior = await service.load('ws-1', 'EUR', new Date(2026, 8, 1));

    expect(behavior.merchants).toEqual([{ name: 'Cafe', categoryId: 'fun', count: 8, total: 40 }]);
    expect(behavior.previousCounts).toEqual({ Cafe: 11 });
    expect(behavior.weekendByCategory).toEqual({ fun: 40 });
    expect(behavior.totalByCategory).toEqual({ fun: 50 });
    expect(behavior.cashFlow.slice(0, 2)).toEqual([
      { month: '2026-09', income: 1000, expense: 200 },
      { month: '2026-08', income: 900, expense: 0 },
    ]);
    expect(behavior.cashFlow).toHaveLength(8);
    expect(behavior.subscriptions).toEqual({ count: 2, monthlyTotal: 20 });
  });

  it('reads every query from confirmed transactions only', async () => {
    const transactions = transactionRepository([]);
    const service = new StoicBehaviorService(
      transactions as any,
      { find: jest.fn(async () => []) } as any,
      exchangeRates as any,
    );

    await service.load('ws-1', 'EUR', new Date(2026, 8, 1));

    const builders = transactions.createQueryBuilder.mock.results.map(result => result.value);
    expect(builders).toHaveLength(4);
    for (const qb of builders) {
      expect(qb.andWhere).toHaveBeenCalledWith(countedSql('t'));
    }
  });
});
