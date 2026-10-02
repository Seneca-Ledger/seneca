import { BalanceAccountType, CapitalRole, RiskLevel } from '@/entities/balance-account.entity';
import { NetWorthService } from '@/modules/net-worth/net-worth.service';

const WORKSPACE_ID = 'workspace-1';

interface AccountSeed {
  id: string;
  code: string;
  name: string;
  accountType: BalanceAccountType;
  parentId?: string | null;
  position?: number;
  capitalRole?: CapitalRole | null;
  riskLevel?: RiskLevel | null;
}

interface SnapshotSeed {
  accountId: string;
  snapshotDate: string;
  amount: number;
  currency?: string;
}

/** The default chart of accounts, trimmed to what these tests care about. */
const ACCOUNTS: AccountSeed[] = [
  { id: 'a-noncurrent', code: 'ASSET_NON_CURRENT', name: 'Внеоборотные', accountType: BalanceAccountType.ASSET, position: 0 },
  { id: 'a-fixed', code: 'ASSET_FIXED', name: 'Основные средства', accountType: BalanceAccountType.ASSET, parentId: 'a-noncurrent' },
  { id: 'a-cash', code: 'ASSET_CASH', name: 'Деньги', accountType: BalanceAccountType.ASSET, position: 2 },
  { id: 'l-borrowed', code: 'LIABILITY_BORROWED', name: 'Ссудный капитал', accountType: BalanceAccountType.LIABILITY, position: 1 },
  { id: 'e-section', code: 'EQUITY_SECTION', name: 'Собственный капитал', accountType: BalanceAccountType.EQUITY, position: 0 },
  { id: 'e-authorized', code: 'EQUITY_AUTHORIZED', name: 'Уставный капитал', accountType: BalanceAccountType.EQUITY, parentId: 'e-section' },
];

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function today(): string {
  return daysAgo(0);
}

function nextDay(date: string): string {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next.toISOString().split('T')[0];
}

function createService(options: {
  accounts?: AccountSeed[];
  snapshots?: SnapshotSeed[];
  /** Cash per currency; a function of the day when it has to move. */
  cash?: Record<string, number | ((date: string) => number)>;
  /** Money that came in, by day. */
  income?: Record<string, { amount: number; currency?: string }>;
  /** What was paid into an account during the window, by currency. */
  contributions?: Record<string, Record<string, number>>;
  /** Rate curve to KZT by currency; absent means no rate at all. */
  rates?: Record<string, number | Array<{ date: string; rate: number }>>;
}) {
  const accounts = (options.accounts ?? ACCOUNTS).map(account => ({
    parentId: null,
    position: 0,
    nameEn: null,
    nameKk: null,
    capitalRole: null,
    riskLevel: null,
    workspaceId: WORKSPACE_ID,
    ...account,
  }));

  const snapshots = (options.snapshots ?? []).map(snapshot => ({ currency: 'KZT', ...snapshot }));

  const snapshotQueryBuilder: any = {
    select: jest.fn(() => snapshotQueryBuilder),
    where: jest.fn(() => snapshotQueryBuilder),
    andWhere: jest.fn(() => snapshotQueryBuilder),
    orderBy: jest.fn(() => snapshotQueryBuilder),
    addOrderBy: jest.fn(() => snapshotQueryBuilder),
    getMany: jest.fn(async () => snapshots),
    getRawOne: jest.fn(async () => ({ earliest: snapshots[0]?.snapshotDate ?? null })),
  };

  const transactionQueryBuilder: any = {
    getRawOne: jest.fn(async () => ({ earliest: null })),
    // The income walk groups by day and currency; the earliest-date lookup
    // takes a single row. Both run through the same builder.
    getRawMany: jest.fn(async () =>
      Object.entries(options.income ?? {}).map(([date, row]) => ({
        date,
        currency: row.currency ?? 'KZT',
        credit: String(row.amount),
      })),
    ),
  };
  for (const method of [
    'select',
    'addSelect',
    'leftJoin',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
  ]) {
    transactionQueryBuilder[method] = jest.fn(() => transactionQueryBuilder);
  }

  const balanceService = {
    seedDefaultAccounts: jest.fn(async () => undefined),
    getCashSeries: jest.fn(async (_workspaceId: string, dates: string[]) => {
      const cash = options.cash ?? {};
      return new Map(
        dates.map(date => [
          date,
          new Map(
            Object.entries(cash).map(([code, amount]) => [
              code,
              typeof amount === 'function' ? amount(date) : amount,
            ]),
          ),
        ]),
      );
    }),
  } as any;

  const exchangeRates = {
    getRateCurve: jest.fn(async (from: string, _to: string, fromDate: string) => {
      const rate = options.rates?.[from];
      if (rate === undefined) {
        return [];
      }
      return typeof rate === 'number' ? [{ date: fromDate, rate }] : rate;
    }),
  } as any;

  const investments = {
    contributionsBetween: jest.fn(
      async () =>
        new Map(
          Object.entries(options.contributions ?? {}).map(([accountId, perCurrency]) => [
            accountId,
            new Map(Object.entries(perCurrency)),
          ]),
        ),
    ),
    valueByAssetClass: jest.fn(async () => new Map()),
  } as any;

  const service = new NetWorthService(
    { find: jest.fn(async () => accounts) } as any,
    { createQueryBuilder: jest.fn(() => snapshotQueryBuilder) } as any,
    { createQueryBuilder: jest.fn(() => transactionQueryBuilder) } as any,
    { findOne: jest.fn(async () => ({ currency: 'KZT' })) } as any,
    balanceService,
    exchangeRates,
    investments,
  );

  return { service, balanceService, exchangeRates, investments };
}

describe('NetWorthService', () => {
  it('reports assets minus liabilities, ignoring equity', async () => {
    const { service } = createService({
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 1000 },
        { accountId: 'l-borrowed', snapshotDate: daysAgo(200), amount: 400 },
        { accountId: 'e-authorized', snapshotDate: daysAgo(200), amount: 900 },
      ],
      cash: { KZT: 200 },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

    // 1000 fixed + 200 cash − 400 borrowed. Equity is the balancing side of
    // the sheet, not a debt, so it must not move the number.
    expect(result.current).toBe(800);
    expect(result.assetsTotal).toBe(1200);
    expect(result.liabilitiesTotal).toBe(400);
  });

  it('holds an account at its last entered value until the next one', async () => {
    const { service } = createService({
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(80), amount: 500 },
        { accountId: 'a-fixed', snapshotDate: daysAgo(10), amount: 900 },
      ],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });
    const values = result.series.map(point => point.value);

    expect(values[0]).toBe(0); // before the first snapshot
    expect(values).toContain(500); // held between the two
    expect(values[values.length - 1]).toBe(900);
  });

  it('reads cash for every single day, not for a handful of sampled dates', async () => {
    const { service, balanceService } = createService({ cash: { KZT: 777 } });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '30d' });
    const dates: string[] = balanceService.getCashSeries.mock.calls[0][1];

    expect(dates[dates.length - 1]).toBe(today());
    expect(dates).toEqual([...new Set(dates)].sort());
    // Consecutive days: a gap would mean a movement nobody can see.
    for (let index = 1; index < dates.length; index += 1) {
      expect(dates[index]).toBe(nextDay(dates[index - 1]));
    }
    expect(result.current).toBe(777);
  });

  it('converts cash and snapshots in other currencies at the rate of each day', async () => {
    const { service, exchangeRates } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 10, currency: 'EUR' }],
      cash: { KZT: 100, USD: 2 },
      // The rate moves: today EUR is worth more than it was.
      rates: {
        EUR: [
          { date: daysAgo(400), rate: 500 },
          { date: today(), rate: 600 },
        ],
        USD: 450,
      },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

    expect(result.series[0].value).toBe(10 * 500 + 100 + 2 * 450);
    expect(result.current).toBe(10 * 600 + 100 + 2 * 450);
    expect(result.missingRates).toEqual([]);
  });

  it('asks for one rate curve per currency rather than a rate per day', async () => {
    const { service, exchangeRates } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 10, currency: 'EUR' }],
      cash: { KZT: 100, USD: 2 },
      rates: { EUR: 500, USD: 450 },
    });

    await service.getNetWorth(WORKSPACE_ID, { range: '1y' });

    // Two foreign currencies over a year: two calls, not seven hundred.
    expect(exchangeRates.getRateCurve).toHaveBeenCalledTimes(2);
    expect(exchangeRates.getRateCurve).toHaveBeenCalledWith(
      'EUR',
      'KZT',
      expect.any(String),
      today(),
      WORKSPACE_ID,
    );
  });

  it('leaves out an amount without a rate and names its currency', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(10), amount: 50, currency: 'CHF' }],
      cash: { KZT: 100 },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '30d' });

    expect(result.current).toBe(100);
    expect(result.missingRates).toEqual(['CHF']);
  });

  it('reports the change across the window and its percentage', async () => {
    const { service } = createService({
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 1000 },
        { accountId: 'a-fixed', snapshotDate: daysAgo(5), amount: 1500 },
      ],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

    expect(result.previous).toBe(1000);
    expect(result.current).toBe(1500);
    expect(result.change).toBe(500);
    expect(result.changePercent).toBe(50);
  });

  it('omits the percentage when there is nothing to take a percentage of', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(5), amount: 1500 }],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

    expect(result.previous).toBe(0);
    expect(result.changePercent).toBeNull();
  });

  it('groups the allocation by top-level section and drops empty ones', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(30), amount: 750 }],
      cash: { KZT: 250 },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

    expect(result.breakdown).toEqual([
      { code: 'ASSET_NON_CURRENT', name: 'Внеоборотные', amount: 750, percent: 75 },
      { code: 'ASSET_CASH', name: 'Деньги', amount: 250, percent: 25 },
    ]);
  });

  it('treats cash as low risk regardless of what is stored against it', async () => {
    const { service } = createService({
      accounts: [
        {
          id: 'a-cash',
          code: 'ASSET_CASH',
          name: 'Деньги',
          accountType: BalanceAccountType.ASSET,
          riskLevel: RiskLevel.HIGH,
        },
      ],
      cash: { KZT: 500 },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });
    const cash = result.assetLines.find(line => line.code === 'ASSET_CASH');

    expect(cash?.riskLevel).toBe(RiskLevel.LOW);
    expect(cash?.isClassifiable).toBe(false);
    expect(result.riskyPercent).toBe(0);
  });

  it('measures the risky share against all assets, not just classified ones', async () => {
    const { service } = createService({
      accounts: [
        {
          id: 'a-fixed',
          code: 'ASSET_FIXED',
          name: 'Основные средства',
          accountType: BalanceAccountType.ASSET,
          riskLevel: RiskLevel.HIGH,
        },
        {
          id: 'a-other',
          code: 'ASSET_INVENTORY',
          name: 'Запасы',
          accountType: BalanceAccountType.ASSET,
        },
      ],
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(30), amount: 300 },
        { accountId: 'a-other', snapshotDate: daysAgo(30), amount: 700 },
      ],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

    // 300 of 1000 is high risk; the unclassified 700 counts in the
    // denominator, so the share understates rather than invents risk.
    expect(result.riskyPercent).toBe(30);
    expect(result.byRisk).toEqual([
      { key: null, amount: 700, percent: 70 },
      { key: RiskLevel.HIGH, amount: 300, percent: 30 },
    ]);
  });

  it('groups assets by the role the user assigned them', async () => {
    const { service } = createService({
      accounts: [
        {
          id: 'a-fixed',
          code: 'ASSET_FIXED',
          name: 'Основные средства',
          accountType: BalanceAccountType.ASSET,
          capitalRole: CapitalRole.INCOME,
        },
        {
          id: 'a-other',
          code: 'ASSET_INVENTORY',
          name: 'Запасы',
          accountType: BalanceAccountType.ASSET,
          capitalRole: CapitalRole.DRAIN,
        },
      ],
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(30), amount: 600 },
        { accountId: 'a-other', snapshotDate: daysAgo(30), amount: 400 },
      ],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

    expect(result.byRole).toEqual([
      { key: CapitalRole.INCOME, amount: 600, percent: 60 },
      { key: CapitalRole.DRAIN, amount: 400, percent: 40 },
    ]);
  });

  // Several offsets on purpose: evenly spaced sampling happens to land on some
  // days, so a single offset can pass by luck. Only keeping the extremes of
  // each bucket survives all of them.
  it.each([900, 901, 902, 903, 907])(
    'keeps a one-day crash %i days back visible on a five-year chart',
    async (dipDay: number) => {
      const { service } = createService({
        snapshots: [
          { accountId: 'a-fixed', snapshotDate: daysAgo(1800), amount: 1000 },
          { accountId: 'a-fixed', snapshotDate: daysAgo(dipDay), amount: 300 },
          { accountId: 'a-fixed', snapshotDate: daysAgo(dipDay - 1), amount: 1000 },
        ],
      });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: 'all' });

      expect(Math.min(...result.series.map(point => point.value))).toBe(300);
      expect(result.series.length).toBeLessThanOrEqual(200);
    },
  );

  it('starts the series on the first day of the window and ends it today', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(400), amount: 1000 }],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '30d' });

    expect(result.series[0].date).toBe(daysAgo(30));
    expect(result.series[result.series.length - 1].date).toBe(today());
  });

  it('reports the all-time high on the day it happened, outside the window shown', async () => {
    const { service } = createService({
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(400), amount: 2000 },
        { accountId: 'a-fixed', snapshotDate: daysAgo(399), amount: 1000 },
      ],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '30d' });

    expect(result.allTimeHigh).toEqual({ value: 2000, date: daysAgo(400) });
    expect(result.current).toBe(1000);
  });

  it('charts the window the user picked instead of a preset', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(400), amount: 1000 }],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, {
      from: daysAgo(90),
      to: daysAgo(60),
    });

    expect(result.from).toBe(daysAgo(90));
    expect(result.to).toBe(daysAgo(60));
    expect(result.series[0].date).toBe(daysAgo(90));
    expect(result.series[result.series.length - 1].date).toBe(daysAgo(60));
  });

  it('never charts past today, whatever end date is asked for', async () => {
    const { service } = createService({ cash: { KZT: 100 } });

    const result = await service.getNetWorth(WORKSPACE_ID, { from: daysAgo(10), to: '2099-01-01' });

    expect(result.to).toBe(today());
  });

  it('starts the year-to-date window on the first of January', async () => {
    const { service } = createService({ cash: { KZT: 100 } });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: 'ytd' });

    expect(result.from).toBe(`${today().slice(0, 4)}-01-01`);
  });

  it('carries both sides of each day, not only the net', async () => {
    const { service } = createService({
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 1000 },
        { accountId: 'l-borrowed', snapshotDate: daysAgo(200), amount: 400 },
      ],
      cash: { KZT: 200 },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, { range: '30d' });
    const last = result.series[result.series.length - 1];

    // A net of 800 says nothing about whether the debt is growing.
    expect(last).toEqual({ date: today(), value: 800, assets: 1200, liabilities: 400 });
  });

  it('leaves an excluded line out of the curve, the totals and the allocation', async () => {
    const { service } = createService({
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(30), amount: 9000 },
        { accountId: 'l-borrowed', snapshotDate: daysAgo(30), amount: 400 },
      ],
      cash: { KZT: 1000 },
    });

    const withHouse = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });
    const withoutHouse = await service.getNetWorth(WORKSPACE_ID, {
      range: '90d',
      exclude: ['a-fixed'],
    });

    expect(withHouse.current).toBe(9600);
    // 1000 cash − 400 borrowed: the house is gone from every figure, not just
    // from the curve.
    expect(withoutHouse.current).toBe(600);
    expect(withoutHouse.assetsTotal).toBe(1000);
    expect(withoutHouse.breakdown.map(item => item.code)).toEqual(['ASSET_CASH']);
    expect(withoutHouse.assetLines.map(line => line.code)).toEqual(['ASSET_CASH']);
    expect(withoutHouse.excluded).toEqual(['a-fixed']);
  });

  describe('what made the change', () => {
    const sum = (rows: Array<{ amount: number }>) =>
      round2(rows.reduce((total, row) => total + row.amount, 0));
    const round2 = (value: number) => Math.round(value * 100) / 100;

    it('adds up to the change itself, by line and by cause', async () => {
      const { service } = createService({
        snapshots: [
          { accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 1000 },
          { accountId: 'a-fixed', snapshotDate: daysAgo(10), amount: 1750 },
          { accountId: 'l-borrowed', snapshotDate: daysAgo(200), amount: 400 },
          { accountId: 'l-borrowed', snapshotDate: daysAgo(5), amount: 250 },
        ],
        cash: { KZT: date => (date >= daysAgo(20) ? 1300 : 1000) },
      });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

      expect(sum(result.attribution.byAccount)).toBe(result.change);
      expect(sum(result.attribution.byKind)).toBe(result.change);
      // Paying a debt down raises the number, so the line counts positively.
      const debt = result.attribution.byAccount.find(row => row.code === 'LIABILITY_BORROWED');
      expect(debt?.amount).toBe(150);
    });

    it('tells the rate moving apart from the line moving', async () => {
      const { service } = createService({
        // The same ten euros all window; only the rate moves.
        snapshots: [
          { accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 10, currency: 'EUR' },
        ],
        rates: {
          EUR: [
            { date: daysAgo(400), rate: 500 },
            { date: today(), rate: 600 },
          ],
        },
      });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

      expect(result.change).toBe(1000);
      expect(result.attribution.byKind).toEqual([{ kind: 'fx', amount: 1000 }]);
    });

    it('does not blame the rate for a line it could not value at the start', async () => {
      const { service } = createService({
        snapshots: [
          { accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 10, currency: 'EUR' },
        ],
        // The provider only starts quoting EUR halfway through the window.
        rates: { EUR: [{ date: daysAgo(30), rate: 500 }] },
      });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });
      const byKind = Object.fromEntries(
        result.attribution.byKind.map(row => [row.kind, row.amount]),
      );

      // The line appeared in the figures because a rate appeared, not because
      // a rate moved: nothing may be charged to the currency.
      expect(result.change).toBe(5000);
      expect(byKind.fx ?? 0).toBe(0);
      expect(byKind.revaluation).toBe(5000);
    });

    it('calls money paid into an investment account a contribution, not a gain', async () => {
      const { service } = createService({
        accounts: [
          {
            id: 'a-cash',
            code: 'ASSET_CASH',
            name: 'Деньги',
            accountType: BalanceAccountType.ASSET,
          },
          {
            id: 'a-broker',
            code: 'CUSTOM_BROKER',
            name: 'Брокер',
            accountType: BalanceAccountType.ASSET,
          },
        ],
        snapshots: [
          { accountId: 'a-broker', snapshotDate: daysAgo(200), amount: 0 },
          { accountId: 'a-broker', snapshotDate: daysAgo(10), amount: 150 },
        ],
        cash: { KZT: date => (date >= daysAgo(10) ? 900 : 1000) },
        contributions: { 'a-broker': { KZT: 100 } },
      });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });
      const byKind = Object.fromEntries(
        result.attribution.byKind.map(row => [row.kind, row.amount]),
      );

      // 100 left cash and arrived in the account: the household is no richer
      // for it, and only the 50 the market added counts as a gain.
      expect(result.change).toBe(50);
      expect(byKind.money ?? 0).toBe(0);
      expect(byKind.revaluation).toBe(50);
    });

    it('names the line that moved, largest first', async () => {
      const { service } = createService({
        snapshots: [
          { accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 1000 },
          { accountId: 'a-fixed', snapshotDate: daysAgo(10), amount: 1050 },
        ],
        cash: { KZT: date => (date >= daysAgo(20) ? 1500 : 1000) },
      });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

      expect(result.attribution.byAccount.map(row => [row.code, row.amount])).toEqual([
        ['ASSET_CASH', 500],
        ['ASSET_FIXED', 50],
      ]);
    });

    it('says nothing happened when nothing did', async () => {
      const { service } = createService({ cash: { KZT: 1000 } });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

      expect(result.change).toBe(0);
      expect(result.attribution.byAccount).toEqual([]);
      expect(result.attribution.byKind).toEqual([]);
    });
  });

  describe('savings rate', () => {
    it('is the share of what came in that was still there at the end', async () => {
      const { service } = createService({
        income: { [daysAgo(20)]: { amount: 1000 } },
        // 1000 came in, 600 of it is still here.
        cash: { KZT: date => (date >= daysAgo(20) ? 1600 : 1000) },
      });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

      expect(result.savings.income).toBe(1000);
      expect(result.savings.kept).toBe(600);
      expect(result.savings.rate).toBe(60);
    });

    it('says nothing rather than zero when nothing came in', async () => {
      const { service } = createService({ cash: { KZT: 1000 } });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

      expect(result.savings).toEqual({ income: 0, kept: 0, rate: null });
    });

    it('counts a month of overspending as a negative rate, not as nothing', async () => {
      const { service } = createService({
        income: { [daysAgo(20)]: { amount: 1000 } },
        cash: { KZT: date => (date >= daysAgo(20) ? 800 : 1000) },
      });

      const result = await service.getNetWorth(WORKSPACE_ID, { range: '90d' });

      expect(result.savings.rate).toBe(-20);
    });
  });

  it('returns a flat zero series for a workspace with nothing in it', async () => {
    const { service } = createService({});

    const result = await service.getNetWorth(WORKSPACE_ID, { range: 'all' });

    expect(result.current).toBe(0);
    expect(result.breakdown).toEqual([]);
    expect(result.series.every(point => point.value === 0)).toBe(true);
  });
});
