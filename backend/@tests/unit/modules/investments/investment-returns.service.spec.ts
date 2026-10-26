import { InvestmentPriceSource } from '@/entities/investment-holding.entity';
import { InvestmentReturnsService } from '@/modules/investments/investment-returns.service';
import type { InvestmentFlow } from '@/modules/investments/investment-flows.service';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const fresh = { priceSource: InvestmentPriceSource.AUTO, pricedAt: new Date() };

interface AccountSeed {
  id: string;
  name?: string;
  value: number;
  holdings?: Array<{ name: string; priceSource: InvestmentPriceSource; pricedAt: Date | null }>;
}

function createService(
  options: {
    accounts?: AccountSeed[];
    flows?: Array<Omit<InvestmentFlow, 'currency'>>;
    history?: Record<string, Array<{ date: string; amount: number }>>;
    metals?: {
      accountId: string;
      value: number;
      lots: Array<{ name: string; cost: number | null; acquiredOn: string | null }>;
      sales?: Array<{
        lotName: string;
        proceeds: number;
        costBasis: number | null;
        soldOn: string;
        acquiredOn: string | null;
      }>;
    };
    crypto?: {
      holdings: Array<{ value: number; cost: number | null; realized: number; basisIncomplete: boolean }>;
      unpriced?: Array<{ asset: string; amount: string }>;
    };
  } = {},
) {
  const investments = {
    workspaceCurrency: vi.fn(async () => 'EUR'),
    listAccounts: vi.fn(async () =>
      (options.accounts ?? []).map(account => ({
        id: account.id,
        name: account.name ?? account.id,
        value: account.value,
        holdings: account.holdings ?? [{ name: 'Fund', ...fresh }],
      })),
    ),
    loadFlows: vi.fn(async () =>
      (options.flows ?? []).map(flow => ({ ...flow, currency: 'EUR' })),
    ),
    // Everything is already in euros: the dated conversion has its own tests.
    valueFlows: vi.fn(async (_ws: string, flows: InvestmentFlow[]) => ({
      flows: flows.map(flow => ({ ...flow, value: flow.amount })),
      missing: [],
    })),
  };
  const metals = {
    getSummary: vi.fn(async () => ({
      accountId: options.metals?.accountId ?? null,
      value: options.metals?.value ?? 0,
      lots: (options.metals?.lots ?? []).map(lot => ({ ...lot, ...fresh })),
      sales: options.metals?.sales ?? [],
    })),
  };
  const crypto = {
    getHoldings: vi.fn(async () => ({
      currency: 'EUR',
      holdings: options.crypto?.holdings ?? [],
      unpriced: options.crypto?.unpriced ?? [],
    })),
  };
  const balance = {
    getAccountHistory: vi.fn(async (_ws: string, accountId: string) =>
      (options.history?.[accountId] ?? []).map(point => ({ ...point, currency: 'EUR' })),
    ),
  };
  const exchangeRates = { getRateCurve: vi.fn(async () => []) };

  return new InvestmentReturnsService(
    investments as never,
    investments as never,
    metals as never,
    crypto as never,
    balance as never,
    exchangeRates as never,
  );
}

describe('InvestmentReturnsService', () => {
  it('measures the whole history against the money put in', async () => {
    const service = createService({
      accounts: [{ id: 'broker', value: 1100 }],
      flows: [{ accountId: 'broker', date: daysAgo(400), amount: 1000, kind: 'contribution' }],
      history: { broker: [{ date: daysAgo(400), amount: 1000 }] },
    });

    const result = await service.getReturns('ws', 'all');

    expect(result.summary).toMatchObject({
      startValue: 0,
      endValue: 1100,
      contributions: 1000,
      gain: 100,
      netInvested: 1000,
      method: 'modified_dietz',
    });
    expect(result.summary.returnPercent).toBeCloseTo(10, 1);
    // Over a year: the annual rate is on offer, and a little under the total.
    expect(result.summary.annualizedMethod).toBe('xirr');
    expect(result.summary.annualizedPercent).toBeGreaterThan(8);
    expect(result.summary.annualizedPercent).toBeLessThan(10);
  });

  it('counts a dividend as return and a withdrawal as money taken back', async () => {
    const service = createService({
      accounts: [{ id: 'broker', value: 800 }],
      flows: [
        { accountId: 'broker', date: daysAgo(200), amount: 1000, kind: 'contribution' },
        { accountId: 'broker', date: daysAgo(100), amount: 300, kind: 'withdrawal' },
        { accountId: 'broker', date: daysAgo(50), amount: 40, kind: 'income' },
      ],
      history: { broker: [{ date: daysAgo(200), amount: 1000 }] },
    });

    const result = await service.getReturns('ws', 'all');

    // 800 held + 300 back + 40 paid out, against 1000 put in.
    expect(result.summary).toMatchObject({
      contributions: 1000,
      withdrawals: 300,
      income: 40,
      gain: 140,
      netInvested: 700,
    });
  });

  it('leaves a line out when its value at the start of the window is unknown', async () => {
    const service = createService({
      accounts: [
        { id: 'old', value: 5000 },
        { id: 'new', value: 1050 },
      ],
      flows: [
        { accountId: 'old', date: daysAgo(100), amount: 4000, kind: 'contribution' },
        { accountId: 'new', date: daysAgo(10), amount: 1000, kind: 'contribution' },
      ],
      history: { new: [{ date: daysAgo(10), amount: 1000 }] },
    });

    const result = await service.getReturns('ws', '30d');

    const old = result.sources.find(source => source.id === 'old');
    expect(old).toMatchObject({ includedInReturn: false, returnPercent: null });
    expect(old?.flags).toContain('opening_value_unknown');
    expect(result.flags).toContainEqual({ code: 'opening_value_unknown', sourceId: 'old' });
    expect(result.summary).toMatchObject({ startValue: 0, endValue: 1050, gain: 50 });
    // Thirty days is no year: no annual rate is extrapolated from it.
    expect(result.summary.annualizedPercent).toBeNull();
  });

  it('opens a window at the value entered by then', async () => {
    const service = createService({
      accounts: [{ id: 'broker', value: 1200 }],
      flows: [{ accountId: 'broker', date: daysAgo(100), amount: 1000, kind: 'contribution' }],
      history: {
        broker: [
          { date: daysAgo(100), amount: 1000 },
          { date: daysAgo(40), amount: 1100 },
        ],
      },
    });

    const result = await service.getReturns('ws', '30d');

    expect(result.summary).toMatchObject({ startValue: 1100, endValue: 1200, gain: 100 });
    expect(result.summary.returnPercent).toBeCloseTo(9.09, 2);
  });

  it('does not take a value nobody paid for as a gain', async () => {
    const service = createService({ accounts: [{ id: 'gift', value: 3000 }] });

    const result = await service.getReturns('ws', 'all');

    expect(result.sources[0]).toMatchObject({ includedInReturn: false });
    expect(result.flags).toContainEqual({ code: 'no_contributions', sourceId: 'gift' });
    expect(result.summary.endValue).toBe(0);
  });

  it('keeps metals out of the return while a lot has no cost, and names it', async () => {
    const service = createService({
      metals: {
        accountId: 'metals-account',
        value: 4000,
        lots: [
          { name: 'Krugerrand', cost: 1800, acquiredOn: daysAgo(300) },
          { name: 'Silver bar', cost: null, acquiredOn: null },
        ],
      },
    });

    const result = await service.getReturns('ws', 'all');

    expect(result.sources[0]).toMatchObject({ kind: 'metals', includedInReturn: false });
    expect(result.flags).toContainEqual({
      code: 'metal_cost_missing',
      sourceId: 'metals-account',
      detail: 'Silver bar',
    });
  });

  it('counts a metal sale as the original cost going in and the proceeds coming out', async () => {
    const service = createService({
      metals: {
        accountId: 'metals-account',
        value: 2000,
        lots: [{ name: 'Bar', cost: 1500, acquiredOn: daysAgo(300) }],
        sales: [
          {
            lotName: 'Bar',
            proceeds: 900,
            costBasis: 500,
            soldOn: daysAgo(20),
            acquiredOn: daysAgo(300),
          },
        ],
      },
    });

    const result = await service.getReturns('ws', 'all');

    // 2000 left + 900 back, against 2000 paid.
    expect(result.summary).toMatchObject({ contributions: 2000, withdrawals: 900, gain: 900 });
  });

  it('lists crypto on its whole history and keeps it out of the return', async () => {
    const service = createService({
      accounts: [{ id: 'broker', value: 1000 }],
      flows: [{ accountId: 'broker', date: daysAgo(10), amount: 1000, kind: 'contribution' }],
      crypto: {
        holdings: [
          { value: 3000, cost: 2000, realized: 500, basisIncomplete: false },
          { value: 100, cost: null, realized: 0, basisIncomplete: true },
        ],
        unpriced: [{ asset: 'XYZ', amount: '5' }],
      },
    });

    const result = await service.getReturns('ws', 'all');

    const crypto = result.sources.find(source => source.kind === 'crypto');
    // Net in: 2000 held at cost less 500 already taken as profit.
    expect(crypto).toMatchObject({
      scope: 'all_time',
      endValue: 3100,
      contributions: 1500,
      gain: 1600,
      includedInReturn: false,
    });
    expect(crypto?.flags).toEqual([
      'crypto_not_in_return',
      'crypto_basis_incomplete',
      'crypto_unpriced',
    ]);
    expect(result.summary.endValue).toBe(1000);
  });

  it('says which prices the figures stand on are old', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    const service = createService({
      accounts: [
        {
          id: 'broker',
          value: 1000,
          holdings: [
            { name: 'ACME', priceSource: InvestmentPriceSource.AUTO, pricedAt: old },
            { name: 'House fund', priceSource: InvestmentPriceSource.MANUAL, pricedAt: old },
          ],
        },
      ],
      flows: [{ accountId: 'broker', date: daysAgo(30), amount: 900, kind: 'contribution' }],
    });

    const result = await service.getReturns('ws', 'all');

    // An automatic quote is stale after days; a hand-entered one only after a month.
    expect(result.flags).toContainEqual({
      code: 'stale_price',
      sourceId: 'broker',
      detail: 'ACME',
    });
    expect(result.flags.some(flag => flag.code === 'manual_price')).toBe(false);
    expect(result.sources[0].includedInReturn).toBe(true);
  });

  it('draws the value against the net money in, ending on today’s value', async () => {
    const service = createService({
      accounts: [{ id: 'broker', value: 1300 }],
      flows: [
        { accountId: 'broker', date: daysAgo(20), amount: 1000, kind: 'contribution' },
        { accountId: 'broker', date: daysAgo(10), amount: 200, kind: 'contribution' },
      ],
      history: {
        broker: [
          { date: daysAgo(20), amount: 1000 },
          { date: daysAgo(10), amount: 1250 },
        ],
      },
    });

    const result = await service.getReturns('ws', '30d');

    const at = (date: string) => result.series.find(point => point.date === date);
    expect(at(daysAgo(25))).toMatchObject({ value: 0, netContributed: 0 });
    expect(at(daysAgo(15))).toMatchObject({ value: 1000, netContributed: 1000 });
    expect(at(daysAgo(5))).toMatchObject({ value: 1250, netContributed: 1200 });
    expect(result.series[result.series.length - 1]).toMatchObject({
      date: daysAgo(0),
      value: 1300,
      netContributed: 1200,
    });
  });
});
