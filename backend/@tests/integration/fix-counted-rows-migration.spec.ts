/**
 * Integration test — the migration that repairs rows counted wrongly, against a real Postgres.
 *
 * Three kinds of past rows need fixing once income and spending count rows
 * without a statement: an approved receipt booked with an amount but neither
 * debit nor credit (it counted as nothing); a document filed twice, whose rows
 * count twice; and a receipt booked by hand whose bank or scan row also counts.
 * Every change is logged so the migration can be rolled back.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BankName,
  FileType,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Workspace,
} from '../../src/entities';
import { FixCountedRows1787230000000 } from '../../src/migrations/1787230000000-FixCountedRows';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_fix_counted_${process.pid}`;

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

describe('FixCountedRows migration (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let txRepo: Repository<Transaction>;
  let workspaceId: string;
  let userId: string;
  const migration = new FixCountedRows1787230000000();

  const statement = async (fileName: string, fileHash = randomUUID()) =>
    (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName,
          filePath: `/tmp/${randomUUID()}.pdf`,
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash,
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          currency: 'ILS',
        }),
      )
    ).id;

  const row = (fields: Partial<Transaction>) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        transactionDate: new Date('2026-10-03'),
        counterpartyName: 'Invoice FU6IOXCJ0012',
        paymentPurpose: 'Receipt',
        currency: 'ILS',
        transactionType: TransactionType.EXPENSE,
        amount: 289,
        debit: 289,
        credit: null,
        isVerified: true,
        ...fields,
      }),
    );

  const reload = (id: string) => txRepo.findOneByOrFail({ id });

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

    workspaceId = (await dataSource.getRepository(Workspace).save({ name: 'Fix WS', currency: 'ILS' }))
      .id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `fix-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Fix Tester',
          workspaceId,
        }),
      )
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
    await txRepo.query('DELETE FROM transaction_data_fixes');
  });

  /** The migration ran once on the empty schema; each test runs it on its own rows. */
  const runUp = async () => {
    const runner = dataSource.createQueryRunner();
    try {
      await migration.up(runner);
    } finally {
      await runner.release();
    }
  };
  const runDown = async () => {
    const runner = dataSource.createQueryRunner();
    try {
      await migration.down(runner);
    } finally {
      await runner.release();
    }
  };

  it('puts the amount of a booked receipt on its side', async () => {
    const expense = await row({ amount: 100, debit: null, credit: null });
    const income = await row({
      amount: 331.96,
      debit: null,
      credit: null,
      transactionType: TransactionType.INCOME,
    });

    await runUp();

    expect(await reload(expense.id)).toMatchObject({ debit: '100.00', credit: null });
    expect(await reload(income.id)).toMatchObject({ debit: null, credit: '331.96' });
  });

  it('keeps the first row of a document filed twice and flags the repeat', async () => {
    const first = await row({ statementId: await statement('Receipt-2333.pdf') });
    // Read again the day after: the parser landed on the next day.
    const again = await row({
      statementId: await statement('Receipt-2333.pdf'),
      transactionDate: new Date('2026-10-04'),
    });
    // Another document with the same price is not a repeat.
    const other = await row({ statementId: await statement('Another.pdf') });

    await runUp();

    expect(await reload(first.id)).toMatchObject({ isDuplicate: false });
    expect(await reload(again.id)).toMatchObject({ isDuplicate: true, duplicateOfId: first.id });
    expect(await reload(other.id)).toMatchObject({ isDuplicate: false });
  });

  it('flags the later of a hand-booked row and its statement row, once', async () => {
    const scanRow = await row({ statementId: await statement('Scan.pdf') });
    const bookedLater = await row({ amount: 289, debit: null, credit: null });
    // A second hand-booked row of the same price has no statement row left to repeat.
    const secondCoffee = await row({ amount: 289, debit: null, credit: null });

    await runUp();

    expect(await reload(scanRow.id)).toMatchObject({ isDuplicate: false });
    expect(await reload(bookedLater.id)).toMatchObject({ isDuplicate: true, duplicateOfId: scanRow.id });
    expect(await reload(secondCoffee.id)).toMatchObject({ isDuplicate: false, debit: '289.00' });
  });

  it('touches nothing on a second run', async () => {
    await row({ amount: 100, debit: null, credit: null });
    await row({ statementId: await statement('Twice.pdf') });
    await row({ statementId: await statement('Twice.pdf') });
    await runUp();
    const logged = await txRepo.query('SELECT COUNT(*)::int AS n FROM transaction_data_fixes');

    await runUp();

    expect(await txRepo.query('SELECT COUNT(*)::int AS n FROM transaction_data_fixes')).toEqual(
      logged,
    );
  });

  it('rolls every change back', async () => {
    const receipt = await row({ amount: 100, debit: null, credit: null });
    await row({ statementId: await statement('Twice.pdf') });
    const repeat = await row({ statementId: await statement('Twice.pdf') });

    await runUp();
    await runDown();

    expect(await reload(receipt.id)).toMatchObject({ debit: null, credit: null, amount: '100.00' });
    expect(await reload(repeat.id)).toMatchObject({ isDuplicate: false, duplicateOfId: null });
  });
});
