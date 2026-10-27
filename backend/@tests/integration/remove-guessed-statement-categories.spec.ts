/**
 * Integration test — the migration that removes the categories statement
 * processing used to make up ("Доходы: Griffith"), against a real Postgres.
 * Bank statements lose them; a receipt keeps its own; a category anything else
 * still points at stays; a category a person created is never touched.
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BankName,
  Category,
  CategorySource,
  CategoryType,
  FileType,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Workspace,
} from '../../src/entities';
import { RemoveGuessedStatementCategories1787490000000 } from '../../src/migrations/1787490000000-RemoveGuessedStatementCategories';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_guessed_categories_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/** Loaded through Vite: TypeORM's glob loader would bypass the test transform. */
function loadMigrations(): Function[] {
  const modules = import.meta.glob<Record<string, unknown>>('../../src/migrations/*.ts', {
    eager: true,
  });
  return Object.keys(modules)
    .sort()
    .flatMap(file =>
      Object.values(modules[file]).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
}

describe('RemoveGuessedStatementCategories migration (real Postgres)', () => {
  vi.setConfig({ testTimeout: 180_000 });

  let dataSource: DataSource;
  let workspaceId: string;
  let userId: string;

  const category = async (name: string, source = CategorySource.PARSING) =>
    (
      await dataSource.getRepository(Category).save(
        dataSource.getRepository(Category).create({
          name,
          type: name.startsWith('Доходы') ? CategoryType.INCOME : CategoryType.EXPENSE,
          source,
          userId,
          workspaceId,
        }),
      )
    ).id;

  const statement = async (categoryId: string, detectedBy?: string) =>
    (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName: 'statement.pdf',
          filePath: `/tmp/${randomUUID()}.pdf`,
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          currency: 'USD',
          categoryId,
          parsingDetails: detectedBy ? ({ detectedBy } as Statement['parsingDetails']) : null,
        }),
      )
    ).id;

  const categoryOf = async (statementId: string) =>
    (await dataSource.getRepository(Statement).findOneByOrFail({ id: statementId })).categoryId;
  const exists = async (categoryId: string) =>
    (await dataSource.getRepository(Category).countBy({ id: categoryId })) > 0;

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

    workspaceId = (
      await dataSource.getRepository(Workspace).save({ name: 'Guess WS', currency: 'USD' })
    ).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `guess-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Guess Tester',
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

  it('removes guesses from bank statements and deletes the ones nothing else uses', async () => {
    const onlyOnStatement = await category('Доходы: Example');
    const usedByRow = await category('Расходы: Card');
    const onReceipt = await category('Расходы: Coffee');
    const chosenByPerson = await category('Расходы: Rent', CategorySource.USER);

    const bank = await statement(onlyOnStatement);
    const bankWithUsedGuess = await statement(usedByRow);
    const receipt = await statement(onReceipt, 'receipt-scan');
    const bankWithOwnChoice = await statement(chosenByPerson);
    await dataSource.getRepository(Transaction).save(
      dataSource.getRepository(Transaction).create({
        workspaceId,
        statementId: bankWithUsedGuess,
        categoryId: usedByRow,
        transactionDate: new Date('2026-10-03'),
        counterpartyName: 'ACME Store',
        paymentPurpose: 'Card purchase',
        currency: 'USD',
        transactionType: TransactionType.EXPENSE,
        amount: 12.5,
        debit: 12.5,
      }),
    );

    const runner = dataSource.createQueryRunner();
    try {
      await new RemoveGuessedStatementCategories1787490000000().up(runner);
    } finally {
      await runner.release();
    }

    expect(await categoryOf(bank)).toBeNull();
    expect(await exists(onlyOnStatement)).toBe(false);
    expect(await categoryOf(bankWithUsedGuess)).toBeNull();
    expect(await exists(usedByRow)).toBe(true);
    expect(await categoryOf(receipt)).toBe(onReceipt);
    expect(await exists(onReceipt)).toBe(true);
    expect(await categoryOf(bankWithOwnChoice)).toBe(chosenByPerson);
    expect(await exists(chosenByPerson)).toBe(true);
  });
});
