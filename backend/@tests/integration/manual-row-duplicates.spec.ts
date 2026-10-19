/**
 * Integration test — a bank row repeating one booked by hand, against a real Postgres.
 *
 * A cash payment or an approved receipt is a transaction without a statement.
 * When the bank statement with the same payment arrives later, its row is the
 * same money: counting both would double the spending. The fingerprint does not
 * see it (it includes the account, and a hand-booked row has none), so the
 * statement's rows are compared with the hand-booked ones by currency, side,
 * amount and date. A repeat is kept, flagged as a suspected duplicate of the
 * hand-booked row, so it stays out of every figure and waits in Review.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  CryptoWallet,
  Transaction,
  TransactionType,
  User,
  Wallet,
  Workspace,
} from '../../src/entities';
import { ManualRowDuplicateService } from '../../src/modules/transactions/services/manual-row-duplicate.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_manual_dupes_${process.pid}`;

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

describe('a statement row repeating a hand-booked one (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let txRepo: Repository<Transaction>;
  let service: ManualRowDuplicateService;
  let workspaceId: string;
  let otherWorkspaceId: string;
  let walletId: string;
  let cryptoWalletId: string;

  /** A row as the parser hands it over: not saved yet, on the statement being read. */
  const draft = (fields: Partial<Transaction>) =>
    txRepo.create({
      workspaceId,
      transactionDate: new Date('2026-09-10'),
      counterpartyName: 'LIDL 1234',
      paymentPurpose: 'Card payment',
      currency: 'EUR',
      transactionType: TransactionType.EXPENSE,
      amount: 42.5,
      debit: 42.5,
      credit: null,
      isVerified: false,
      ...fields,
    });

  /** A row booked by hand earlier: no statement, confirmed. */
  const booked = (fields: Partial<Transaction>) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        transactionDate: new Date('2026-09-09'),
        counterpartyName: 'Lidl',
        paymentPurpose: 'Receipt',
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        amount: 42.5,
        debit: 42.5,
        credit: null,
        isVerified: true,
        ...fields,
      }),
    );

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
    txRepo = dataSource.getRepository(Transaction);
    service = new ManualRowDuplicateService(txRepo);

    const workspaces = dataSource.getRepository(Workspace);
    workspaceId = (await workspaces.save({ name: 'Dupes WS', currency: 'EUR' })).id;
    otherWorkspaceId = (await workspaces.save({ name: 'Other WS', currency: 'EUR' })).id;
    const userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `dupes-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Dupes Tester',
          workspaceId,
        }),
      )
    ).id;
    walletId = (
      await dataSource
        .getRepository(Wallet)
        .save({ userId, workspaceId, name: 'Cash', currency: 'EUR' })
    ).id;
    cryptoWalletId = (
      await dataSource.getRepository(CryptoWallet).save({ workspaceId, address: '0xabc' })
    ).id;
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  beforeEach(async () => {
    await txRepo.query('DELETE FROM transactions');
  });

  it('flags the bank row of a payment already booked from its receipt', async () => {
    const receiptRow = await booked({});
    const bankRow = draft({});

    const flagged = await service.flagRepeats([bankRow], workspaceId);

    expect(flagged).toBe(1);
    expect(bankRow).toMatchObject({ isDuplicate: true, duplicateOfId: receiptRow.id });
  });

  it('matches income to income, within three days, in the same currency', async () => {
    await booked({ walletId, transactionType: TransactionType.INCOME, debit: null, credit: 300 });
    const sameDayIncome = draft({ transactionType: TransactionType.INCOME, debit: null, credit: 300 });
    const tooLate = draft({ transactionDate: new Date('2026-09-20') });
    const otherCurrency = draft({ currency: 'USD' });
    const otherAmount = draft({ debit: 42.49 });

    await service.flagRepeats([sameDayIncome, tooLate, otherCurrency, otherAmount], workspaceId);

    expect(sameDayIncome.isDuplicate).toBe(true);
    expect(tooLate.isDuplicate).toBeFalsy();
    expect(otherCurrency.isDuplicate).toBeFalsy();
    expect(otherAmount.isDuplicate).toBeFalsy();
  });

  it('pairs each hand-booked row with one bank row only', async () => {
    const receiptRow = await booked({});
    const first = draft({});
    const second = draft({ transactionDate: new Date('2026-09-11') });

    await service.flagRepeats([first, second], workspaceId);

    // Two coffees of the same price are two payments; one receipt covers one.
    expect(first).toMatchObject({ isDuplicate: true, duplicateOfId: receiptRow.id });
    expect(second.isDuplicate).toBeFalsy();
  });

  it('leaves a hand-booked row already paired by an earlier import to that pairing', async () => {
    const receiptRow = await booked({});
    await txRepo.save(draft({ isDuplicate: true, duplicateOfId: receiptRow.id }));

    const again = draft({});
    await service.flagRepeats([again], workspaceId);

    expect(again.isDuplicate).toBeFalsy();
  });

  it('ignores rows it must not pair with: unconfirmed, crypto, flagged, elsewhere', async () => {
    await booked({ isVerified: false });
    await booked({ cryptoWalletId, cryptoAsset: 'USDT' });
    await booked({ isDuplicate: true });
    await booked({ workspaceId: otherWorkspaceId });
    const bankRow = draft({});

    expect(await service.flagRepeats([bankRow], workspaceId)).toBe(0);
    expect(bankRow.isDuplicate).toBeFalsy();
  });

  it('keeps away from a draft already flagged by its fingerprint', async () => {
    const receiptRow = await booked({});
    const fingerprinted = draft({ isDuplicate: true, duplicateOfId: randomUUID() });
    const fresh = draft({});

    await service.flagRepeats([fingerprinted, fresh], workspaceId);

    expect(fingerprinted.duplicateOfId).not.toBe(receiptRow.id);
    expect(fresh.duplicateOfId).toBe(receiptRow.id);
  });
});
