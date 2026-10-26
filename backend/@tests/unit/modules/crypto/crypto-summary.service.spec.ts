import type { Mock } from 'vitest';
import { countedSql } from '@/common/utils/counted-transactions.util';
import { TransactionType } from '../../../../src/entities/transaction.entity';
import { CryptoService } from '../../../../src/modules/crypto/crypto.service';
import { CryptoHoldingsService } from '../../../../src/modules/crypto/crypto-holdings.service';

const WORKSPACE = 'ws-1';

type Prices = Record<string, number | null>;

function queryBuilder(result: { rows?: unknown[]; many?: unknown[] }) {
  const qb: Record<string, Mock> = {};
  for (const method of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'orderBy',
    'addOrderBy',
    'take',
  ]) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getRawMany = vi.fn(async () => result.rows ?? []);
  qb.getMany = vi.fn(async () => result.many ?? []);
  return qb;
}

function build(options: {
  balances?: { asset: string; amount: string }[];
  current?: Record<string, number>;
  yesterday?: Prices;
  transactions?: unknown[];
  /** The portfolio value the last sync before a day wrote. */
  valueBefore?: number;
}) {
  const walletRepo = {
    count: vi.fn(async () => 1),
    find: vi.fn(async () => [
      {
        id: 'w-1',
        label: 'Ledger',
        address: '0xabc',
        chainId: 1,
        balances: options.balances ?? [],
      },
    ]),
  };
  const transactionRepo = {
    createQueryBuilder: vi.fn(() =>
      queryBuilder({ rows: [], many: options.transactions ?? [] }),
    ),
  };
  const workspaceRepo = { findOne: vi.fn(async () => ({ id: WORKSPACE, currency: 'EUR' })) };
  const priceService = {
    getCurrentUsdPrices: vi.fn(async () => options.current ?? {}),
    getUsdPrice: vi.fn(async (asset: string) => {
      const price = options.yesterday?.[asset];
      if (price === undefined) {
        throw new Error('rate limited');
      }
      return price;
    }),
  };
  const exchangeRatesService = { getRate: vi.fn(async () => 0.5) };
  const balanceService = {
    writePortfolioSnapshot: vi.fn(),
    valueBefore: vi.fn(async () => options.valueBefore ?? 0),
  };

  // The portfolio side of the summary is the holdings service's answer; it is the
  // real one here, so the two stay in step.
  const holdingsService = new CryptoHoldingsService(
    walletRepo as never,
    transactionRepo as never,
    workspaceRepo as never,
    priceService as never,
    exchangeRatesService as never,
  );

  const service = new CryptoService(
    walletRepo as never,
    transactionRepo as never,
    {} as never,
    priceService as never,
    exchangeRatesService as never,
    { createEvent: vi.fn(), createBatchEvents: vi.fn() } as never,
    holdingsService,
    balanceService as never,
  );
  return { service, transactionRepo, balanceService };
}

describe('CryptoService.getSummary', () => {
  it('values a past month by the last snapshot before its end, not by today', async () => {
    const { service, balanceService } = build({
      balances: [{ asset: 'ETH', amount: '2' }],
      current: { ETH: 3000 },
      yesterday: { ETH: 3000 },
      valueBefore: 1234.567,
    });

    const summary = await service.getSummary(WORKSPACE, 30, '2024-02');

    expect(balanceService.valueBefore).toHaveBeenCalledWith(WORKSPACE, '2024-03-01');
    expect(summary).toMatchObject({
      portfolioValue: 1234.57,
      holdings: [],
      portfolioChangeSinceYesterday: null,
      cost: null,
      unrealized: null,
    });
  });

  it('values the month we are in by today', async () => {
    const { service, balanceService } = build({
      balances: [{ asset: 'ETH', amount: '2' }],
      current: { ETH: 3000 },
      yesterday: { ETH: 3000 },
    });

    const summary = await service.getSummary(WORKSPACE, 30, new Date().toISOString().slice(0, 7));

    expect(balanceService.valueBefore).not.toHaveBeenCalled();
    expect(summary.portfolioValue).toBe(3000);
  });

  it('prices one unit of each holding in the workspace currency', async () => {
    const { service } = build({
      balances: [{ asset: 'ETH', amount: '2' }],
      current: { ETH: 3000 },
      yesterday: { ETH: 3000 },
    });

    const summary = await service.getSummary(WORKSPACE);

    expect(summary.holdings).toEqual([
      // Nothing bought it on record, so the cost side stays empty instead of zero.
      expect.objectContaining({ asset: 'ETH', amount: '2', price: 1500, value: 3000 }),
    ]);
    expect(summary.holdings[0]).toMatchObject({ avgCost: null, cost: null, realized: 0 });
  });

  it('keeps a unit price below a cent and the gain percent from unrounded figures', async () => {
    const { service } = build({
      balances: [
        { asset: 'USDT', amount: '1000' },
        { asset: 'ETH', amount: '0.001308' },
      ],
      // Workspace currency at 0.5 per USD: USDT is worth 0.49955, ETH 1 183.20.
      current: { USDT: 0.9991, ETH: 2366.4 },
      yesterday: { USDT: 0.9991, ETH: 2366.4 },
      transactions: [
        {
          id: 'buy-eth',
          transactionDate: new Date('2026-01-01T00:00:00Z'),
          cryptoWalletId: 'w-1',
          transactionType: TransactionType.INCOME,
          cryptoAsset: 'ETH',
          cryptoAmount: '0.001308',
          // 954.25 a coin in the workspace currency.
          amount: '1.248159',
          currency: 'EUR',
        },
      ],
    });

    const summary = await service.getSummary(WORKSPACE);
    const usdt = summary.holdings.find(holding => holding.asset === 'USDT');
    const eth = summary.holdings.find(holding => holding.asset === 'ETH');

    expect(usdt?.price).toBe(0.49955);
    expect(eth?.avgCost).toBeCloseTo(954.25, 4);
    // Value 1.55 against a cost of 1.248159: +24.18%, not the +24.0% that
    // dividing the cent-rounded gain (0.30) by the cent-rounded cost (1.25) gives.
    expect(eth?.unrealizedPercent).toBe(24.18);
  });

  it('reports the price move since yesterday, weighted by value', async () => {
    const { service } = build({
      balances: [
        { asset: 'ETH', amount: '1' },
        { asset: 'USDC', amount: '1000' },
      ],
      current: { ETH: 2000, USDC: 1 },
      yesterday: { ETH: 1000, USDC: 1 },
    });

    const summary = await service.getSummary(WORKSPACE);

    // Now: 1000 + 500 EUR. Yesterday: 500 + 500 EUR. +50%.
    expect(summary.portfolioChangeSinceYesterday).toBe(50);
  });

  it('hides the change when one holding has no price for yesterday', async () => {
    const { service } = build({
      balances: [
        { asset: 'ETH', amount: '1' },
        { asset: 'LINK', amount: '10' },
      ],
      current: { ETH: 2000, LINK: 10 },
      yesterday: { ETH: 1000 },
    });

    const summary = await service.getSummary(WORKSPACE);

    expect(summary.portfolioChangeSinceYesterday).toBeNull();
    expect(summary.holdings).toHaveLength(2);
  });

  it('has no change for an empty portfolio', async () => {
    const { service } = build({});

    expect((await service.getSummary(WORKSPACE)).portfolioChangeSinceYesterday).toBeNull();
  });
});

describe('CryptoService.getSummary for a calendar month', () => {
  const flowQuery = (transactionRepo: { createQueryBuilder: Mock }) =>
    transactionRepo.createQueryBuilder.mock.results[0].value as Record<string, Mock>;

  it('limits the flows to that month instead of the rolling window', async () => {
    const { service, transactionRepo } = build({});

    await service.getSummary(WORKSPACE, 30, '2026-08');

    const qb = flowQuery(transactionRepo);
    expect(qb.andWhere).toHaveBeenCalledWith('t.transaction_date >= :since', {
      since: '2026-08-01',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.transaction_date < :until', {
      until: '2026-09-01',
    });
  });

  it('sums confirmed transfers only', async () => {
    const { service, transactionRepo } = build({});

    await service.getSummary(WORKSPACE, 30, '2026-08');

    expect(flowQuery(transactionRepo).andWhere).toHaveBeenCalledWith(countedSql('t'));
  });

  it('rolls December over into the next year', async () => {
    const { service, transactionRepo } = build({});

    await service.getSummary(WORKSPACE, 30, '2025-12');

    expect(flowQuery(transactionRepo).andWhere).toHaveBeenCalledWith(
      't.transaction_date < :until',
      { until: '2026-01-01' },
    );
  });

  it('keeps the open-ended rolling window without a month', async () => {
    const { service, transactionRepo } = build({});

    await service.getSummary(WORKSPACE, 30);

    expect(flowQuery(transactionRepo).andWhere).not.toHaveBeenCalledWith(
      't.transaction_date < :until',
      expect.anything(),
    );
  });
});

describe('CryptoService.getRecentTransactions', () => {
  it('maps booked transfers to rows with their wallet and direction', async () => {
    const { service } = build({
      transactions: [
        {
          id: 't-1',
          transactionDate: new Date('2026-09-20T10:00:00Z'),
          cryptoWalletId: 'w-1',
          transactionType: TransactionType.EXPENSE,
          cryptoAsset: 'ETH',
          cryptoAmount: '0.1',
          amount: '150.25',
          currency: 'EUR',
          counterpartyAccount: '0xdef',
          counterpartyName: '0xdef…0000',
          cryptoTxHash: '0xhash',
        },
      ],
    });

    expect(await service.getRecentTransactions(WORKSPACE)).toEqual([
      {
        id: 't-1',
        date: '2026-09-20T10:00:00.000Z',
        walletId: 'w-1',
        walletLabel: 'Ledger',
        walletAddress: '0xabc',
        walletChainName: 'Ethereum',
        direction: 'out',
        asset: 'ETH',
        cryptoAmount: '0.1',
        amount: 150.25,
        currency: 'EUR',
        counterparty: '0xdef',
        txHash: '0xhash',
      },
    ]);
  });
});

describe('CryptoService.connect', () => {
  function connectService() {
    const saved: Record<string, unknown>[] = [];
    const walletRepo = {
      findOne: vi.fn(async () => null),
      create: vi.fn((row: Record<string, unknown>) => row),
      save: vi.fn(async (row: Record<string, unknown>) => {
        const stored = { id: 'w-new', ...row };
        saved.push(stored);
        return stored;
      }),
      find: vi.fn(async () => saved),
    };
    const transactionRepo = { createQueryBuilder: vi.fn(() => queryBuilder({})) };
    const syncService = { syncWallet: vi.fn(async () => ({ imported: 0, skipped: 0 })) };
    const service = new CryptoService(
      walletRepo as never,
      transactionRepo as never,
      syncService as never,
      {} as never,
      {} as never,
      { createEvent: vi.fn(), createBatchEvents: vi.fn() } as never,
      {} as never,
      { writePortfolioSnapshot: vi.fn() } as never,
    );
    return { service, saved };
  }

  it('reads Tron off a T… address and keeps its case', async () => {
    const { service, saved } = connectService();

    const [view] = await service.connect(WORKSPACE, 'u-1', {
      address: 'TLLU15qbiSEqv2y3DLfbHTHS5TVdjQ7hoJ',
    });

    expect(saved[0]).toMatchObject({
      address: 'TLLU15qbiSEqv2y3DLfbHTHS5TVdjQ7hoJ',
      chainId: 728126428,
    });
    expect(view.chainName).toBe('Tron');
  });

  it('stores an Ethereum address lowercase on chain 1', async () => {
    const { service, saved } = connectService();

    await service.connect(WORKSPACE, 'u-1', {
      address: '0x899CD926A9028AFE9056E76CC01F32EE859E7A65',
    });

    expect(saved[0]).toMatchObject({
      address: '0x899cd926a9028afe9056e76cc01f32ee859e7a65',
      chainId: 1,
    });
  });

  it('rejects a Tron address sent with the Ethereum chain id', async () => {
    const { service } = connectService();

    await expect(
      service.connect(WORKSPACE, 'u-1', {
        address: 'TLLU15qbiSEqv2y3DLfbHTHS5TVdjQ7hoJ',
        chainId: 1,
      }),
    ).rejects.toThrow('does not belong to the selected network');
  });

  it('creates one wallet per requested EVM network and syncs each', async () => {
    const { service, saved } = connectService();

    const views = await service.connect(WORKSPACE, 'u-1', {
      address: '0x899cd926a9028afe9056e76cc01f32ee859e7a65',
      chainIds: [1, 8453, 42161],
    });

    expect(saved.map(row => row.chainId)).toEqual([1, 8453, 42161]);
    expect(views.map(view => view.chainName)).toEqual(['Ethereum', 'Base', 'Arbitrum']);
  });

  it('rejects an EVM address on the Bitcoin network', async () => {
    const { service } = connectService();

    await expect(
      service.connect(WORKSPACE, 'u-1', {
        address: '0x899cd926a9028afe9056e76cc01f32ee859e7a65',
        chainIds: [1, 2_000_000_000],
      }),
    ).rejects.toThrow('does not belong to the selected network');
  });

  it('reads Bitcoin and Solana off their address formats', async () => {
    const { service, saved } = connectService();

    await service.connect(WORKSPACE, 'u-1', { address: 'BC1QXY2KGDYGJRSQTZQ2N0YRF2493P83KKFJHX0WLH' });
    await service.connect(WORKSPACE, 'u-1', {
      address: 'vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg',
    });

    expect(saved.map(row => [row.chainId, row.address])).toEqual([
      [2_000_000_000, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'],
      [2_000_000_501, 'vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg'],
    ]);
  });
});
