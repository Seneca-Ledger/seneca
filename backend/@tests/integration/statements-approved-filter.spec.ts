/**
 * Integration test — the Documents "Approved" filter, against a real Postgres.
 *
 * Approved means a person has confirmed the document: a statement is parsed and
 * Review holds none of its rows (no unconfirmed row, no unsettled duplicate).
 * The filter used to go by parse status alone, so a parsed statement whose rows
 * still waited in Review passed as approved.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BankName,
  Category,
  FileType,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Workspace,
  WorkspaceMember,
} from '../../src/entities';
import { StatementsService } from '../../src/modules/statements/statements.service';
import { StatementListService } from '../../src/modules/statements/statement-list.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_approved_filter_${process.pid}`;

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

describe('the Approved filter of the documents list (real Postgres)', () => {
  vi.setConfig({ testTimeout: 180_000 });

  let dataSource: DataSource;
  let txRepo: Repository<Transaction>;
  let service: StatementsService;
  let workspaceId: string;
  let otherWorkspaceId: string;
  let userId: string;

  const statement = async (name: string, status: StatementStatus, workspace = workspaceId) =>
    (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId: workspace,
          fileName: name,
          filePath: `/tmp/${randomUUID()}.pdf`,
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status,
          currency: 'USD',
        }),
      )
    ).id;

  const row = (statementId: string, fields: Partial<Transaction> = {}) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        statementId,
        transactionDate: new Date('2026-10-01'),
        counterpartyName: 'Shop',
        paymentPurpose: 'Shop',
        currency: 'USD',
        transactionType: TransactionType.EXPENSE,
        amount: 10,
        debit: 10,
        credit: null,
        isVerified: true,
        ...fields,
      }),
    );

  const names = async (approved: boolean) =>
    (await service.findAll(workspaceId, { approved })).data.map(item => item.fileName).sort();

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

    const unused = {} as never;
    const files = { getFileAvailability: async () => ({ onDisk: true, inDb: false }) } as never;
    service = new StatementsService(
      dataSource.getRepository(Statement),
      txRepo,
      dataSource.getRepository(User),
      dataSource.getRepository(WorkspaceMember),
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      new StatementListService(
        dataSource.getRepository(Statement),
        txRepo,
        dataSource.getRepository(Category),
        files,
      ),
    );

    const workspaces = dataSource.getRepository(Workspace);
    workspaceId = (await workspaces.save({ name: 'Approved WS', currency: 'USD' })).id;
    otherWorkspaceId = (await workspaces.save({ name: 'Other WS', currency: 'USD' })).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `approved-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Approved Tester',
          workspaceId,
        }),
      )
    ).id;

    const confirmed = await statement('confirmed.pdf', StatementStatus.COMPLETED);
    await row(confirmed);
    const waiting = await statement('waiting.pdf', StatementStatus.COMPLETED);
    await row(waiting);
    await row(waiting, { isVerified: false });
    const suspectedDuplicate = await statement('duplicate.pdf', StatementStatus.COMPLETED);
    await row(suspectedDuplicate, { isDuplicate: true, isVerified: false });
    // A duplicate the person marked by hand is settled; Review no longer asks.
    const markedDuplicate = await statement('marked.pdf', StatementStatus.COMPLETED);
    await row(markedDuplicate, {
      isDuplicate: true,
      isVerified: false,
      duplicateMatchType: 'manual',
    });
    await statement('uploading.pdf', StatementStatus.UPLOADED);
    await statement('balance-check.pdf', StatementStatus.NEEDS_REVIEW);
    await statement('foreign.pdf', StatementStatus.COMPLETED, otherWorkspaceId);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  it('keeps only parsed statements with nothing left in Review', async () => {
    expect(await names(true)).toEqual(['confirmed.pdf', 'marked.pdf']);
  });

  it('lists everything else as not approved, rows waiting in Review included', async () => {
    expect(await names(false)).toEqual([
      'balance-check.pdf',
      'duplicate.pdf',
      'uploading.pdf',
      'waiting.pdf',
    ]);
  });
});
