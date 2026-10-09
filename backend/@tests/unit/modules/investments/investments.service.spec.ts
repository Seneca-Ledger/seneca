import { countedSql } from '@/common/utils/counted-transactions.util';
import { BalanceAccountKind } from '@/entities/balance-account.entity';
import { InvestmentsService } from '../../../../src/modules/investments/investments.service';

type Row = {
  accountId: string;
  date: string;
  currency: string;
  type: 'income' | 'expense';
  pairKind: 'investment' | 'transfer' | null;
  debit: string;
  credit: string;
};

function queryBuilder(rows: Row[] = []) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn(async () => rows);
  return qb;
}

function createService(
  options: {
    rows?: Row[];
    /** Rate to EUR by currency and day; absent means no rate. */
    rates?: Record<string, Array<{ date: string; rate: number }>>;
    accounts?: Array<{ id: string; name: string }>;
  } = {},
) {
  const qb = queryBuilder(options.rows);
  const transactionRepository = { createQueryBuilder: jest.fn(() => qb) };
  const exchangeRates = {
    getRateCurve: jest.fn(async (from: string) => options.rates?.[from] ?? []),
  };
  const accountRepository = {
    find: jest.fn(async () =>
      (options.accounts ?? []).map(account => ({
        ...account,
        accountKind: BalanceAccountKind.INVESTMENT,
      })),
    ),
  };
  const service = new InvestmentsService(
    accountRepository as never,
    { find: jest.fn(async () => []) } as never,
    transactionRepository as never,
    { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as never,
    { seedDefaultAccounts: jest.fn(async () => undefined) } as never,
    exchangeRates as never,
    {} as never,
  );
  return { service, qb };
}

const row = (overrides: Partial<Row>): Row => ({
  accountId: 'account-1',
  date: '2026-03-01',
  currency: 'EUR',
  type: 'expense',
  pairKind: 'investment',
  debit: '0',
  credit: '0',
  ...overrides,
});

describe('InvestmentsService flows', () => {
  it('counts only confirmed rows', async () => {
    const { service, qb } = createService();

    await service.loadFlows('ws-1', ['account-1']);

    expect(qb.andWhere).toHaveBeenCalledWith(countedSql('t'));
  });

  it('tells a contribution, a withdrawal and a dividend apart', async () => {
    const { service } = createService({
      rows: [
        row({ type: 'expense', pairKind: 'investment', debit: '1000' }),
        row({ type: 'income', pairKind: 'investment', credit: '300', date: '2026-04-01' }),
        row({ type: 'income', pairKind: null, credit: '25', date: '2026-05-01' }),
      ],
    });

    const flows = await service.loadFlows('ws-1', ['account-1']);

    expect(flows.map(flow => [flow.kind, flow.amount, flow.date])).toEqual([
      ['contribution', 1000, '2026-03-01'],
      ['withdrawal', 300, '2026-04-01'],
      ['income', 25, '2026-05-01'],
    ]);
  });

  it('values each flow at the rate of its own day, and names a currency it cannot value', async () => {
    const { service } = createService({
      rates: {
        USD: [
          { date: '2024-01-10', rate: 0.9 },
          { date: '2026-01-10', rate: 0.8 },
        ],
      },
    });

    const { flows, missing } = await service.valueFlows(
      'ws-1',
      [
        { accountId: 'a', date: '2024-01-10', amount: 100, currency: 'USD', kind: 'contribution' },
        { accountId: 'a', date: '2026-01-10', amount: 100, currency: 'USD', kind: 'contribution' },
        { accountId: 'a', date: '2026-01-10', amount: 100, currency: 'XYZ', kind: 'contribution' },
      ],
      'EUR',
    );

    expect(flows.map(flow => flow.value)).toEqual([90, 80, 0]);
    expect(missing).toEqual(['XYZ']);
  });

  it('counts a withdrawal against what is invested and a dividend as gain', async () => {
    const { service } = createService({
      accounts: [{ id: 'account-1', name: 'Broker' }],
      rows: [
        row({ type: 'expense', pairKind: 'investment', debit: '1000' }),
        row({ type: 'income', pairKind: 'investment', credit: '300' }),
        row({ type: 'income', pairKind: null, credit: '25' }),
      ],
    });

    const [account] = await service.listAccounts('ws-1');

    // No holdings: the account is worth nothing, so 700 still in it is lost.
    expect(account).toMatchObject({
      value: 0,
      contributed: 1000,
      withdrawn: 300,
      income: 25,
      netInvested: 700,
      gain: -675,
    });
  });
});

describe('InvestmentsService contributionsBetween', () => {
  it('nets withdrawals against contributions and leaves dividends out', async () => {
    const { service, qb } = createService();

    await service.contributionsBetween('ws-1', '2026-01-01', '2026-02-01');

    expect(qb.andWhere).toHaveBeenCalledWith('t.transfer_pair_kind = :kind', {
      kind: 'investment',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(countedSql('t'));
    expect(qb.addSelect).toHaveBeenCalledWith(
      'COALESCE(SUM(COALESCE(t.debit, 0) - COALESCE(t.credit, 0)), 0)',
      'total',
    );
  });
});
