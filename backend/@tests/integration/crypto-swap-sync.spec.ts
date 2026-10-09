/**
 * Integration test — what a wallet sync writes into the ledger.
 *
 * The point of the suite is the arithmetic a user sees: a swap must not read as
 * income, a transfer's amount must not include its gas, and a synced row must
 * count without anybody confirming it. Those answers come out of real tables and
 * the real unique index, so this runs against a scratch database with the real
 * migrations; the chain and the price feed are the only things stubbed.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BalanceAccount,
  BalanceAccountKind,
  BalanceSnapshot,
  BankName,
  CryptoWallet,
  FileType,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Workspace,
} from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { BalanceService } from '../../src/modules/balance/balance.service';
import { BitcoinClient } from '../../src/modules/crypto/bitcoin.client';
import { CryptoService } from '../../src/modules/crypto/crypto.service';
import { CryptoBalanceService } from '../../src/modules/crypto/crypto-balance.service';
import { CryptoHoldingsService } from '../../src/modules/crypto/crypto-holdings.service';
import { CryptoImportService } from '../../src/modules/crypto/crypto-import.service';
import { CryptoPriceService } from '../../src/modules/crypto/crypto-price.service';
import { CryptoSyncService } from '../../src/modules/crypto/crypto-sync.service';
import { SolanaRpcClient } from '../../src/modules/crypto/solana-rpc.client';
import { TronGridClient } from '../../src/modules/crypto/tron-grid.client';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { TransferPairingService } from '../../src/modules/transactions/services/transfer-pairing.service';

const BASE_URL = process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_crypto_swap_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/** Loaded by hand: TypeORM's glob loader bypasses Jest's transform. */
function loadMigrations(): Function[] {
  const dir = path.resolve(__dirname, '../../src/migrations');
  return fs
    .readdirSync(dir)
    .filter(file => file.endsWith('.ts'))
    .sort()
    .flatMap(file =>
      Object.values(require(path.join(dir, file))).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
}

const ADDRESS = '0x1111111111111111111111111111111111111111';
const ROUTER = '0x3333333333333333333333333333333333333333';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const SWAP_HASH = '0xaaa1';
const SEND_HASH = '0xbbb2';
const BUY_HASH = '0xccc3';
const TIMESTAMP = '1767225600'; // 2026-01-01
const PRICES: Record<string, number> = { ETH: 2000, USDC: 1, BTC: 60000, SOL: 100 };

/**
 * The account key of the BIP-84 test vector. Its first two receiving addresses
 * are the ones this stub pretends have been used.
 */
const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
const USED_BTC_ADDRESSES = [
  'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
  'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g',
];

/** mempool.space, with two addresses of the key funded and the rest untouched. */
const bitcoinStub = {
  getAddress: jest.fn(async (address: string) =>
    USED_BTC_ADDRESSES.includes(address)
      ? { chain_stats: { funded_txo_sum: 100_000, spent_txo_sum: 0, tx_count: 1 } }
      : { chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 } },
  ),
  getTransactions: jest.fn(async (address: string) =>
    USED_BTC_ADDRESSES.includes(address)
      ? [
          {
            txid: `tx-${address.slice(-4)}`,
            status: { confirmed: true, block_time: 1767225600 },
            vin: [{ prevout: { scriptpubkey_address: 'bc1qstranger', value: 100_000 } }],
            vout: [{ scriptpubkey_address: address, value: 100_000 }],
          },
        ]
      : [],
  ),
};

/** 21 000 gas at 1 gwei: the fee both transactions pay. */
const GAS = { gasUsed: '21000', gasPrice: '1000000000', fee: '0.000021' };

describe('crypto wallet sync (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let sync: CryptoSyncService;
  let crypto: CryptoService;
  let importer: CryptoImportService;
  let txRepo: Repository<Transaction>;
  let walletRepo: Repository<CryptoWallet>;
  let workspaceId: string;
  let userId: string;
  let wallet: CryptoWallet;
  /** The card payment that bought the coin, as a bank import would have left it. */
  let cardRowId: string;

  function explorerAnswer(url: string): unknown {
    if (url.includes('action=txlist')) {
      return {
        status: '1',
        result: [
          // The swap: one ETH leaves, USDC arrives, in a single transaction.
          {
            hash: SWAP_HASH,
            timeStamp: TIMESTAMP,
            from: ADDRESS,
            to: ROUTER,
            value: '1000000000000000000',
            ...GAS,
          },
          // An ordinary payment to a stranger, with its own gas.
          {
            hash: SEND_HASH,
            timeStamp: TIMESTAMP,
            from: ADDRESS,
            to: ROUTER,
            value: '500000000000000000',
            ...GAS,
          },
          // Coin bought on an exchange and sent to the wallet: 0.25 ETH, 500 USD.
          {
            hash: BUY_HASH,
            timeStamp: TIMESTAMP,
            from: ROUTER,
            to: ADDRESS,
            value: '250000000000000000',
            gasUsed: '0',
            gasPrice: '0',
          },
        ],
      };
    }
    if (url.includes('action=tokentx')) {
      return {
        status: '1',
        result: [
          {
            hash: SWAP_HASH,
            timeStamp: TIMESTAMP,
            from: ROUTER,
            to: ADDRESS,
            value: '2000000000',
            contractAddress: USDC,
            tokenDecimal: '6',
          },
        ],
      };
    }
    if (url.includes('action=balance')) {
      return { status: '1', result: '1500000000000000000' };
    }
    if (url.includes('action=tokenlist')) {
      return {
        status: '1',
        result: [{ balance: '2000000000', contractAddress: USDC, decimals: '6', type: 'ERC-20' }],
      };
    }
    throw new Error(`Unexpected explorer call: ${url}`);
  }

  beforeAll(async () => {
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      url: scratchUrl(SCRATCH_DB),
      entities: ENTITIES,
      migrations: loadMigrations(),
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const priceStub = {
      getUsdPrice: jest.fn(async (asset: string) => PRICES[asset] ?? null),
      getCurrentUsdPrices: jest.fn(async (assets: string[]) =>
        Object.fromEntries(assets.filter(asset => PRICES[asset]).map(a => [a, PRICES[a]])),
      ),
      primeHistoricalPrices: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CryptoSyncService,
        CryptoService,
        CryptoHoldingsService,
        CryptoBalanceService,
        CryptoImportService,
        BalanceService,
        TransferPairingService,
        { provide: CryptoPriceService, useValue: priceStub },
        {
          provide: ExchangeRatesService,
          useValue: {
            getRate: jest.fn(async () => 1),
            getRateOrNull: jest.fn(async () => 1),
          },
        },
        {
          provide: AuditService,
          useValue: {
            createEvent: jest.fn(),
            createBatchEvents: jest.fn(),
            logAction: jest.fn(),
          },
        },
        { provide: TronGridClient, useValue: {} },
        { provide: BitcoinClient, useValue: bitcoinStub },
        { provide: SolanaRpcClient, useValue: {} },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();

    sync = moduleRef.get(CryptoSyncService);
    crypto = moduleRef.get(CryptoService);
    importer = moduleRef.get(CryptoImportService);
    txRepo = dataSource.getRepository(Transaction);
    walletRepo = dataSource.getRepository(CryptoWallet);

    workspaceId = (
      await dataSource.getRepository(Workspace).save({ name: 'Crypto WS', currency: 'USD' })
    ).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `crypto-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Crypto Tester',
          workspaceId,
        }),
      )
    ).id;
    wallet = await walletRepo.save(
      walletRepo.create({
        workspaceId,
        address: ADDRESS,
        chainId: 1,
        label: 'Test',
        connectedByUserId: userId,
      }),
    );

    // The fiat side of the purchase: 505 USD on a card — the exchange's cut is the
    // one per cent between it and the 500 USD of coin that arrived.
    const statementId = (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName: 'card.pdf',
          filePath: '/tmp/card.pdf',
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          accountNumber: 'DE00 9999 8888',
          currency: 'USD',
          statementDateFrom: new Date('2026-01-01'),
          statementDateTo: new Date('2026-01-31'),
        }),
      )
    ).id;
    cardRowId = (
      await txRepo.save(
        txRepo.create({
          workspaceId,
          statementId,
          transactionDate: new Date('2026-01-01'),
          counterpartyName: 'Crypto exchange',
          paymentPurpose: 'ETH purchase',
          amount: 505,
          debit: 505,
          currency: 'USD',
          transactionType: TransactionType.EXPENSE,
          isVerified: true,
        }),
      )
    ).id;

    global.fetch = jest.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      status: 200,
      json: async () => explorerAnswer(String(input)),
    })) as unknown as typeof fetch;

    await sync.syncWallet(wallet);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  const rows = () =>
    txRepo.find({ where: { workspaceId }, order: { cryptoAsset: 'ASC', cryptoLeg: 'ASC' } });

  it('books the swap as two legs, the payment as one, and each fee once', async () => {
    const all = (await rows()).filter(row => row.cryptoWalletId);
    // ETH out (swap), ETH out (payment, fee folded in), ETH in (purchase),
    // USDC in (swap), and the swap's own fee.
    expect(all).toHaveLength(5);
    expect(all.filter(row => row.cryptoLeg === 'fee')).toHaveLength(1);
  });

  it('confirms synced rows without anybody clicking through Review', async () => {
    expect((await rows()).filter(row => row.cryptoWalletId).every(row => row.isVerified)).toBe(
      true,
    );
  });

  it('keeps gas out of the amount that was sent and records it beside it', async () => {
    const payment = (await rows()).find(row => row.cryptoTxHash === SEND_HASH);

    expect(payment).toMatchObject({
      cryptoAmount: '0.500000000000000000',
      cryptoFeeAsset: 'ETH',
    });
    expect(Number(payment?.cryptoFeeAmount)).toBeCloseTo(Number(GAS.fee), 9);
    // 0.5 ETH at 2000 plus the fee: the money that left the wallet, all of it.
    expect(Number(payment?.amount)).toBeCloseTo(1000.04, 2);
  });

  it('links the two legs of the swap so neither is income or spending', async () => {
    const legs = (await rows()).filter(
      row => row.cryptoTxHash === SWAP_HASH && row.cryptoLeg === 'value',
    );

    expect(legs).toHaveLength(2);
    expect(legs[0].transferPairId).not.toBeNull();
    expect(legs[0].transferPairId).toBe(legs[1].transferPairId);
    expect(legs.map(leg => leg.transactionType).sort()).toEqual([
      TransactionType.EXPENSE,
      TransactionType.INCOME,
    ]);
  });

  it('leaves the swap’s fee countable: the swap nets out, the fee does not', async () => {
    const fee = (await rows()).find(row => row.cryptoTxHash === SWAP_HASH && row.cryptoLeg === 'fee');

    expect(fee?.transferPairId).toBeNull();
    expect(Number(fee?.amount)).toBeCloseTo(0.04, 2);
  });

  it('reports no income from a swap, and spending that is the payment plus both fees', async () => {
    const summary = await crypto.getSummary(workspaceId, 3650);

    expect(summary.income).toBe(0);
    // 0.5 ETH + its fee (1000.04) and the swap's fee (0.04).
    expect(summary.expense).toBeCloseTo(1000.08, 2);
  });

  it('pairs the card payment with the coin that arrived, within the exchange’s cut', async () => {
    const card = await txRepo.findOneByOrFail({ id: cardRowId });
    const arrival = (await rows()).find(row => row.cryptoTxHash === BUY_HASH);

    expect(card.transferPairId).not.toBeNull();
    expect(arrival?.transferPairId).toBe(card.transferPairId);
  });

  it('puts the portfolio on the balance sheet, where net worth reads it', async () => {
    const account = await dataSource
      .getRepository(BalanceAccount)
      .findOneByOrFail({ workspaceId, accountKind: BalanceAccountKind.CRYPTO });
    const snapshot = await dataSource
      .getRepository(BalanceSnapshot)
      .findOneByOrFail({ workspaceId, accountId: account.id });
    const summary = await crypto.getSummary(workspaceId, 3650);

    // 1.5 ETH at 2000 plus 2000 USDC at 1.
    expect(summary.portfolioValue).toBeCloseTo(5000, 2);
    expect(Number(snapshot.amount)).toBeCloseTo(summary.portfolioValue, 2);
  });

  it('prices the coins the swap bought against what they cost', async () => {
    const summary = await crypto.getSummary(workspaceId, 3650);
    const usdc = summary.holdings.find(holding => holding.asset === 'USDC');

    // 2 000 USDC arrived in the swap, worth 2 000 that day and 2 000 now.
    expect(usdc).toMatchObject({ avgCost: 1, cost: 2000, unrealized: 0, basisIncomplete: false });
  });

  it('admits the basis is partial when more was sent than was ever received', async () => {
    const summary = await crypto.getSummary(workspaceId, 3650);
    const eth = summary.holdings.find(holding => holding.asset === 'ETH');

    // The wallet sent 1.5 ETH and only ever received 0.25 on record.
    expect(eth?.basisIncomplete).toBe(true);
  });

  it('takes a hand-kept holding at the price the user typed', async () => {
    await crypto.upsertManualHolding(workspaceId, userId, {
      asset: 'btc',
      amount: '0.5',
      costPerUnit: 30000,
    });

    const summary = await crypto.getSummary(workspaceId, 3650);
    const btc = summary.holdings.find(holding => holding.asset === 'BTC');

    expect(btc).toMatchObject({ amount: '0.5', avgCost: 30000, cost: 15000 });
    // Priced at today's 60 000 (the stub), it is worth 30 000: 15 000 of profit.
    expect(btc?.unrealized).toBeCloseTo(15000, 2);

    await crypto.removeManualHolding(workspaceId, userId, 'BTC');
    const after = await crypto.getSummary(workspaceId, 3650);
    expect(after.holdings.find(holding => holding.asset === 'BTC')).toBeUndefined();
  });

  describe('a Coinbase export', () => {
    const CSV = [
      'You can use this transaction report to inform your likely tax obligations.',
      '',
      'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes',
      'cb1,2026-01-05T10:00:00Z,Buy,SOL,10,USD,100,1000,1010,10,Bought 10 SOL',
      'cb2,2026-02-05T10:00:00Z,Sell,SOL,4,USD,100,400,396,4,Sold 4 SOL',
      'cb3,2026-03-05T10:00:00Z,Receive,SOL,2,USD,100,,,,Received 2 SOL',
      'cb4,2026-04-05T10:00:00Z,Staking Income,SOL,1,USD,100,100,100,0,',
    ].join('\n');

    let result: Awaited<ReturnType<CryptoImportService['importCsv']>>;

    beforeAll(async () => {
      result = await importer.importCsv(workspaceId, userId, CSV);
    });

    it('creates one wallet for the exchange and books every row once', () => {
      expect(result).toMatchObject({ exchange: 'Coinbase', imported: 4, skipped: 0 });
    });

    it('holds what the file adds up to', async () => {
      const wallet = await walletRepo.findOneByOrFail({ id: result.walletId });

      // 10 bought, 4 sold, 2 received, 1 earned.
      expect(wallet.balances).toEqual([{ asset: 'SOL', amount: '9' }]);
      expect(wallet.kind).toBe('exchange');
    });

    it('calls the staking payout income and leaves trades out of it', async () => {
      const summary = await crypto.getSummary(workspaceId, 3650);

      // 1 SOL at 100 USD. The buy, the sell and the transfer are not income.
      expect(summary.income).toBeCloseTo(100, 2);
    });

    it('takes what the file says was paid, not the price of the day', async () => {
      const summary = await crypto.getSummary(workspaceId, 3650);
      const sol = summary.holdings.find(holding => holding.asset === 'SOL');

      // Ten coins cost 1 010 with the fee — 101 each, not the 100 they were worth
      // that day; four of them were sold, and the one the staking paid came in at
      // 100, so what is left averages 100.86.
      expect(sol?.avgCost).toBeCloseTo(100.86, 2);
      // Sold four of them for 396: four euro short of what they cost.
      expect(sol?.realized).toBeCloseTo(-8, 2);
    });

    it('is idempotent: the same export twice writes nothing new', async () => {
      const again = await importer.importCsv(workspaceId, userId, CSV);

      expect(again.imported).toBe(0);
      expect(again.skipped).toBe(4);
    });

    it('refuses a file that is not an exchange export', async () => {
      await expect(
        importer.importCsv(workspaceId, userId, 'date,amount\n2026-01-01,5'),
      ).rejects.toThrow();
    });
  });

  describe('a Bitcoin wallet given as an extended key', () => {
    let btcWallet: CryptoWallet;

    beforeAll(async () => {
      bitcoinStub.getAddress.mockClear();
      btcWallet = await walletRepo.save(
        walletRepo.create({
          workspaceId,
          address: ZPUB,
          chainId: 2_000_000_000,
          label: 'Cold storage',
          connectedByUserId: userId,
        }),
      );
      await sync.syncWallet(btcWallet);
    });

    it('adds up every address the key has used, not just the first', async () => {
      const saved = await walletRepo.findOneByOrFail({ id: btcWallet.id });

      // 100 000 sat on each of the two used addresses.
      expect(saved.balances).toEqual([{ asset: 'BTC', amount: '0.002' }]);
    });

    it('stops after the gap rather than walking the key forever', () => {
      // Two used addresses, then twenty empty ones on each of the two branches.
      expect(bitcoinStub.getAddress.mock.calls.length).toBeLessThanOrEqual(60);
    });

    it('books what arrived at either address', async () => {
      const rows = await txRepo.find({ where: { workspaceId, cryptoWalletId: btcWallet.id } });

      expect(rows).toHaveLength(2);
      expect(rows.every(row => row.transactionType === TransactionType.INCOME)).toBe(true);
    });
  });

  describe('the gains report', () => {
    it('lists the sale the exchange export recorded, against what it cost', async () => {
      const report = await crypto.getGains(workspaceId, {});
      const sale = report.disposals.find(disposal => disposal.asset === 'SOL');

      // 4 SOL fetched 396 and had cost 404 with the fee: eight short, 31 days held.
      expect(sale).toMatchObject({
        date: '2026-02-05',
        amount: 4,
        proceeds: 396,
        cost: 404,
        gain: -8,
        acquiredOn: '2026-01-05',
        heldDays: 31,
      });
    });

    it('keeps a year to itself', async () => {
      const report = await crypto.getGains(workspaceId, { from: '2027-01-01', to: '2027-12-31' });

      expect(report.disposals).toEqual([]);
      expect(report.gain).toBe(0);
    });

    it('totals what every sale fetched and what it had cost', async () => {
      const report = await crypto.getGains(workspaceId, {});

      expect(report.proceeds).toBeCloseTo(
        report.disposals.reduce((sum, disposal) => sum + disposal.proceeds, 0),
        2,
      );
      expect(report.currency).toBe('USD');
    });
  });

  it('is idempotent: a second sync writes nothing new', async () => {
    const before = (await rows()).length;
    const result = await sync.syncWallet(wallet);

    expect(result.imported).toBe(0);
    expect((await rows()).length).toBe(before);
  });
});
