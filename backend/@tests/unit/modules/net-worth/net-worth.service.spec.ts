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

function createService(options: {
  accounts?: AccountSeed[];
  snapshots?: SnapshotSeed[];
  /** Cash per currency, the same at every sample date. */
  cash?: Record<string, number>;
  /** Rate to KZT by currency; absent means no rate. */
  rates?: Record<string, number | ((date: string) => number)>;
  /** Spot price of one ounce, by day; absent means that day has no quote. */
  metalRate?: number | ((date: string) => number | null);
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
    select: jest.fn(() => transactionQueryBuilder),
    where: jest.fn(() => transactionQueryBuilder),
    andWhere: jest.fn(() => transactionQueryBuilder),
    getRawOne: jest.fn(async () => ({ earliest: null })),
  };

  const balanceService = {
    seedDefaultAccounts: jest.fn(async () => undefined),
    getCashSeries: jest.fn(
      async (_workspaceId: string, dates: string[]) =>
        new Map(dates.map(date => [date, new Map(Object.entries(options.cash ?? {}))])),
    ),
  } as any;

  const exchangeRates = {
    getRateOrNull: jest.fn(async (from: string, _to: string, date: string) => {
      const rate = options.rates?.[from];
      return typeof rate === 'function' ? rate(date) : (rate ?? null);
    }),
    getRateQuote: jest.fn(async (_from: string, _to: string, date: string) => {
      const spot =
        typeof options.metalRate === 'function' ? options.metalRate(date) : (options.metalRate ?? null);
      return spot ? { rate: spot, rateDate: date, stale: false } : null;
    }),
  } as any;

  const service = new NetWorthService(
    { find: jest.fn(async () => accounts) } as any,
    { createQueryBuilder: jest.fn(() => snapshotQueryBuilder) } as any,
    { createQueryBuilder: jest.fn(() => transactionQueryBuilder) } as any,
    { findOne: jest.fn(async () => ({ currency: 'KZT' })) } as any,
    balanceService,
    exchangeRates,
  );

  return { service, balanceService, exchangeRates, transactionQueryBuilder };
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

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');

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

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');
    const values = result.series.map(point => point.value);

    expect(values[0]).toBe(0); // before the first snapshot
    expect(values).toContain(500); // held between the two
    expect(values[values.length - 1]).toBe(900);
  });

  it('ends the window on a past day when asked, ignoring what came later', async () => {
    const { service } = createService({
      snapshots: [
        { accountId: 'a-fixed', snapshotDate: daysAgo(80), amount: 500 },
        { accountId: 'a-fixed', snapshotDate: daysAgo(10), amount: 900 },
      ],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '30d', undefined, undefined, daysAgo(40));

    expect(result.series[result.series.length - 1].date).toBe(daysAgo(40));
    expect(result.current).toBe(500);
    expect(result.byAssetClass).toEqual([]);
  });

  it('reads a day after today as today', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(10), amount: 900 }],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '30d', undefined, undefined, '2999-01-31');

    expect(result.series[result.series.length - 1].date).toBe(daysAgo(0));
    expect(result.current).toBe(900);
  });

  it('reads cash for every sample date from the balance sheet', async () => {
    const { service, balanceService } = createService({ cash: { KZT: 777 } });

    const result = await service.getNetWorth(WORKSPACE_ID, '30d');

    expect(balanceService.getCashSeries).toHaveBeenCalledWith(
      WORKSPACE_ID,
      result.series.map(point => point.date),
    );
    expect(result.current).toBe(777);
  });

  it('converts cash and snapshots in other currencies at the rate of each date', async () => {
    const lastDate = new Date().toISOString().split('T')[0];
    const { service, exchangeRates } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 10, currency: 'EUR' }],
      cash: { KZT: 100, USD: 2 },
      // The rate moves: today EUR is worth more than it was.
      rates: { EUR: date => (date === lastDate ? 600 : 500), USD: 450 },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');

    expect(result.series[0].value).toBe(10 * 500 + 100 + 2 * 450);
    expect(result.current).toBe(10 * 600 + 100 + 2 * 450);
    expect(result.missingRates).toEqual([]);
    expect(exchangeRates.getRateOrNull).toHaveBeenCalledWith('EUR', 'KZT', lastDate, 'workspace-1');
  });

  it('leaves out an amount without a rate and names its currency', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(10), amount: 50, currency: 'CHF' }],
      cash: { KZT: 100 },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '30d');

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

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');

    expect(result.previous).toBe(1000);
    expect(result.current).toBe(1500);
    expect(result.change).toBe(500);
    expect(result.changePercent).toBe(50);
  });

  it('omits the percentage when there is nothing to take a percentage of', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(5), amount: 1500 }],
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');

    expect(result.previous).toBe(0);
    expect(result.changePercent).toBeNull();
  });

  it('groups the allocation by top-level section and drops empty ones', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(30), amount: 750 }],
      cash: { KZT: 250 },
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');

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

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');
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

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');

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

    const result = await service.getNetWorth(WORKSPACE_ID, '90d');

    expect(result.byRole).toEqual([
      { key: CapitalRole.INCOME, amount: 600, percent: 60 },
      { key: CapitalRole.DRAIN, amount: 400, percent: 40 },
    ]);
  });

  it('starts the all-time chart at the first confirmed transaction', async () => {
    const { service, transactionQueryBuilder } = createService({});

    await service.getNetWorth(WORKSPACE_ID, 'all');

    expect(transactionQueryBuilder.andWhere).toHaveBeenCalledWith('transaction.isVerified = true');
  });

  it('starts the year-to-date chart on the first of January', async () => {
    const { service } = createService({});

    const result = await service.getNetWorth(WORKSPACE_ID, 'ytd');

    const today = new Date().toISOString().split('T')[0];
    expect(result.series[0].date).toBe(`${today.slice(0, 4)}-01-01`);
    expect(result.series[result.series.length - 1].date).toBe(today);
  });

  it('returns a flat zero series for a workspace with nothing in it', async () => {
    const { service } = createService({});

    const result = await service.getNetWorth(WORKSPACE_ID, 'all');

    expect(result.current).toBe(0);
    expect(result.breakdown).toEqual([]);
    expect(result.series.every(point => point.value === 0)).toBe(true);
  });

  it('measures the same net worth in ounces, each point at its own day', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 80_000 }],
      // Gold doubles over the window: the same money is worth half the ounces.
      metalRate: (date: string) => (date < daysAgo(15) ? 2_000 : 4_000),
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '30d', undefined, 'XAU' as never);

    expect(result.current).toBe(80_000);
    expect(result.denominated).toMatchObject({ metal: 'XAU', unit: 'ozt' });
    expect(result.denominated?.series[0]?.value).toBe(40);
    expect(result.denominated?.current).toBe(20);
    expect(result.denominated?.change).toBe(-20);
  });

  it('offers no ounce figures at all when no day has a quote', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 80_000 }],
      metalRate: () => null,
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '30d', undefined, 'XAU' as never);
    expect(result.denominated).toBeNull();
  });

  it('says nothing about metal unless it is asked to', async () => {
    const { service } = createService({
      snapshots: [{ accountId: 'a-fixed', snapshotDate: daysAgo(200), amount: 80_000 }],
      metalRate: 4_000,
    });

    const result = await service.getNetWorth(WORKSPACE_ID, '30d');
    expect(result.denominated).toBeNull();
  });
});
