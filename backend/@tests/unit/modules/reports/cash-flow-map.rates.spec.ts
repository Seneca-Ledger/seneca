import { TransactionType } from '@/entities/transaction.entity';
import { CashFlowMapService } from '@/modules/reports/cash-flow-map.service';

/**
 * The cash-flow map converts each amount at its own day's rate. A currency
 * without a rate is left out and named, never counted 1:1 and never dropped
 * without a word.
 */

const WORKSPACE = 'ws-1';
const SHOP = 'ACME Store';

function serviceOver(rows: unknown[], rate: (from: string, date?: string) => number | null) {
  const qb: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        if (prop === 'getRawMany') return async () => rows;
        return () => qb;
      },
    },
  );
  const exchangeRates = {
    getRateOrNull: vi.fn(async (from: string, _to: string, date?: string) => rate(from, date)),
  };
  const service = new CashFlowMapService(
    { createQueryBuilder: () => qb } as any,
    { find: async () => [{ id: 'cat-1', name: 'Groceries', parentId: null, type: 'expense' }] } as any,
    { findOne: async () => ({ currency: 'EUR' }) } as any,
    exchangeRates as any,
  );
  return { service, exchangeRates };
}

function spent(debit: string, currency: string, date = '2026-01-10') {
  return {
    type: TransactionType.EXPENSE,
    currency,
    credit: null,
    debit,
    transactionDate: date,
    categoryId: 'cat-1',
    counterpartyName: SHOP,
    transferPairId: null,
  };
}

const PERIOD = { dateFrom: '2026-01-01', dateTo: '2026-01-31' };

describe('cash-flow map exchange rates', () => {
  it('names the currency it could not convert instead of showing a smaller total', async () => {
    const { service } = serviceOver([spent('10', 'USD'), spent('40', 'CHF')], from =>
      from === 'USD' ? 2 : null,
    );

    const map = await service.getMap(WORKSPACE, PERIOD);

    expect(map.expense.total).toBe(20);
    expect(map.missingRates).toEqual(['CHF']);
  });

  it('converts each amount at the rate of its own day', async () => {
    const { service, exchangeRates } = serviceOver(
      [spent('10', 'USD', '2026-01-05'), spent('10', 'USD', '2026-01-20')],
      (_from, date) => (date === '2026-01-05' ? 2 : 3),
    );

    const map = await service.getMap(WORKSPACE, PERIOD);

    expect(map.expense.total).toBe(50);
    expect(exchangeRates.getRateOrNull).toHaveBeenCalledWith('USD', 'EUR', '2026-01-05', WORKSPACE);
    expect(map.missingRates).toEqual([]);
  });
});
