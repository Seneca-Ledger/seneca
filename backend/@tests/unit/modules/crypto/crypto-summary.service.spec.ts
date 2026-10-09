import { countedSql } from '@/common/utils/counted-transactions.util';
import { TransactionType } from '../../../../src/entities/transaction.entity';
import { CryptoService } from '../../../../src/modules/crypto/crypto.service';
import { CryptoHoldingsService } from '../../../../src/modules/crypto/crypto-holdings.service';

const WORKSPACE = 'ws-1';

type Prices = Record<string, number | null>;

function queryBuilder(result: { rows?: unknown[]; many?: unknown[] }) {
  const qb: Record<string, jest.Mock> = {};
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
    qb[method] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn(async () => result.rows ?? []);
  qb.getMany = jest.fn(async () => result.many ?? []);
  return qb;
}

function build(options: {
  balances?: { asset: string; amount: string }[];
  current?: Record<string, number>;
  yesterday?: Prices;
  transactions?: unknown[];
}) {
  const walletRepo = {
    count: jest.fn(async () => 1),
    find: jest.fn(async () => [
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
    createQueryBuilder: jest.fn(() =>
      queryBuilder({ rows: [], many: options.transactions ?? [] }),
    ),
  };
  const workspaceRepo = { findOne: jest.fn(async () => ({ id: WORKSPACE, currency: 'EUR' })) };
  const priceService = {
    getCurrentUsdPrices: jest.fn(async () => options.current ?? {}),
    getUsdPrice: jest.fn(async (asset: string) => {
      const price = options.yesterday?.[asset];
      if (price === undefined) {
        throw new Error('rate limited');
      }
      return price;
    }),
  };
  const exchangeRatesService = { getRate: jest.fn(async () => 0.5) };

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
    { createEvent: jest.fn(), createBatchEvents: jest.fn() } as never,
    holdingsService,
    { writePortfolioSnapshot: jest.fn() } as never,
  );
  return { service, transactionRepo };
}

describe('CryptoService.getSummary', () => {
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
  const flowQuery = (transactionRepo: { createQueryBuilder: jest.Mock }) =>
    transactionRepo.createQueryBuilder.mock.results[0].value as Record<string, jest.Mock>;

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
      findOne: jest.fn(async () => null),
      create: jest.fn((row: Record<string, unknown>) => row),
      save: jest.fn(async (row: Record<string, unknown>) => {
        const stored = { id: 'w-new', ...row };
        saved.push(stored);
        return stored;
      }),
      find: jest.fn(async () => saved),
    };
    const transactionRepo = { createQueryBuilder: jest.fn(() => queryBuilder({})) };
    const syncService = { syncWallet: jest.fn(async () => ({ imported: 0, skipped: 0 })) };
    const service = new CryptoService(
      walletRepo as never,
      transactionRepo as never,
      syncService as never,
      {} as never,
      {} as never,
      { createEvent: jest.fn(), createBatchEvents: jest.fn() } as never,
      {} as never,
      { writePortfolioSnapshot: jest.fn() } as never,
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
