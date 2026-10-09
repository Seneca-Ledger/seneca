import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  BankName,
  Category,
  CategoryType,
  FileType,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  WorkspaceMember,
  WorkspaceRole,
} from '../../src/entities';
import { accessTokenOf, e2eTestingModule } from './helpers/e2e-app';

/**
 * Switching the ledger on over HTTP and watching the real BullMQ worker book
 * the history: settings -> queue -> worker -> integrity report.
 */
describe('Ledger sync (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  interface Session {
    accessToken: string;
    workspaceId: string;
    userId: string;
  }
  let owner: Session;
  let viewer: Session;

  const as = (session: Session, req: request.Test, workspaceId = owner.workspaceId) =>
    req.set('Authorization', `Bearer ${session.accessToken}`).set('x-workspace-id', workspaceId);

  async function signUp(email: string): Promise<Session> {
    const server = app.getHttpServer();
    await request(server).post('/auth/register').send({ email, password: 'Test123!@#', name: 'Sync' });
    const login = await request(server).post('/auth/login').send({ email, password: 'Test123!@#' });
    const cookieToken = ([] as string[])
      .concat(login.headers['set-cookie'] ?? [])
      .map(cookie => cookie.split(';')[0])
      .find(cookie => cookie.startsWith('access_token='))
      ?.slice('access_token='.length);
    const session = {
      accessToken: accessTokenOf(login) ?? cookieToken,
      workspaceId: login.body?.user?.workspaceId,
      userId: login.body?.user?.id,
    };
    if (!(session.accessToken && session.workspaceId && session.userId)) {
      throw new Error(`Auth setup failed for ${email}: ${JSON.stringify(login.body)}`);
    }
    return session;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    dataSource = app.get(DataSource);

    const suffix = Date.now();
    owner = await signUp(`sync-owner-${suffix}@example.com`);
    viewer = await signUp(`sync-viewer-${suffix}@example.com`);
    await dataSource.getRepository(WorkspaceMember).save({
      workspaceId: owner.workspaceId,
      userId: viewer.userId,
      role: WorkspaceRole.VIEWER,
      invitedById: owner.userId,
    });

    const statement = await dataSource.getRepository(Statement).save(
      dataSource.getRepository(Statement).create({
        userId: owner.userId,
        workspaceId: owner.workspaceId,
        fileName: 'june.pdf',
        filePath: '/tmp/june.pdf',
        fileType: FileType.PDF,
        fileSize: 1,
        fileHash: randomUUID(),
        bankName: BankName.OTHER,
        status: StatementStatus.COMPLETED,
        accountNumber: 'DE12 3456',
        currency: 'EUR',
        balanceStart: 500,
        balanceEnd: 500 + 1200 - 80,
        statementDateFrom: new Date('2026-06-01'),
        statementDateTo: new Date('2026-06-30'),
      }),
    );
    const expense = await dataSource
      .getRepository(Category)
      .findOneByOrFail({ workspaceId: owner.workspaceId, type: CategoryType.EXPENSE });
    const income = await dataSource
      .getRepository(Category)
      .findOneByOrFail({ workspaceId: owner.workspaceId, type: CategoryType.INCOME });
    const txRepo = dataSource.getRepository(Transaction);
    const base = {
      workspaceId: owner.workspaceId,
      statementId: statement.id,
      currency: 'EUR',
      transactionDate: new Date('2026-06-15'),
      counterpartyName: 'Counterparty',
      paymentPurpose: 'Purpose',
      // The ledger books only rows a person confirmed.
      isVerified: true,
    };
    await txRepo.save([
      txRepo.create({
        ...base,
        transactionType: TransactionType.INCOME,
        amount: 1200,
        credit: 1200,
        categoryId: income.id,
      }),
      txRepo.create({
        ...base,
        transactionType: TransactionType.EXPENSE,
        amount: 80,
        debit: 80,
        categoryId: expense.id,
      }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('suggests a base currency and shows the backlog before the ledger is on', async () => {
    const settings = await as(owner, request(app.getHttpServer()).get('/ledger/settings')).expect(200);
    expect(settings.body).toEqual({
      baseCurrency: null,
      enabled: false,
      suggestedBaseCurrency: 'EUR',
      pendingTransactions: 2,
    });
  });

  it('lets only the owner switch it on', async () => {
    await as(viewer, request(app.getHttpServer()).put('/ledger/settings').send({ baseCurrency: 'EUR' })).expect(403);
    await as(owner, request(app.getHttpServer()).put('/ledger/settings').send({ baseCurrency: 'EURO' })).expect(400);
  });

  it('books the history through the queue and reports the ledger up to date', async () => {
    const enabled = await as(
      owner,
      request(app.getHttpServer()).put('/ledger/settings').send({ baseCurrency: 'eur' }),
    ).expect(200);
    expect(enabled.body).toMatchObject({ baseCurrency: 'EUR', enabled: true });

    let integrity: request.Response | undefined;
    for (let attempt = 0; attempt < 60; attempt++) {
      integrity = await as(owner, request(app.getHttpServer()).get('/ledger/integrity')).expect(200);
      if (integrity.body.upToDate) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    expect(integrity?.body).toMatchObject({
      baseCurrency: 'EUR',
      pendingTransactions: 0,
      failingTransactions: 0,
      unbalancedEntries: 0,
      upToDate: true,
    });
    expect(integrity?.body.cashAccounts).toEqual([
      expect.objectContaining({ ledgerBalance: '1620.00', statementBalance: '1620.00', difference: '0.00' }),
    ]);

    const entries = await as(owner, request(app.getHttpServer()).get('/ledger/entries?source=transaction')).expect(200);
    expect(entries.body.total).toBe(2);
  });

  it('serves the reports from what the worker booked', async () => {
    const server = app.getHttpServer();
    const range = 'dateFrom=2026-01-01&dateTo=2026-12-31';

    const tb = await as(owner, request(server).get(`/ledger/reports/trial-balance?${range}`)).expect(200);
    expect(tb.body).toMatchObject({ baseCurrency: 'EUR', balanced: true, freshness: { upToDate: true } });
    expect(tb.body.totals.debit).toBe(tb.body.totals.credit);

    const pnl = await as(owner, request(server).get(`/ledger/reports/profit-and-loss?${range}`)).expect(200);
    expect(pnl.body.totals).toEqual({ income: '1200.00', expenses: '80.00', netIncome: '1120.00' });

    const sheet = await as(owner, request(server).get('/ledger/reports/balance-sheet?date=2026-12-31')).expect(200);
    expect(sheet.body).toMatchObject({
      balanced: true,
      totals: { assets: '1620.00', liabilitiesAndEquity: '1620.00' },
    });

    const cash = (tb.body.rows as Array<{ accountId: string; code: string }>).find(row =>
      row.code.startsWith('CASH_'),
    );
    const card = await as(
      owner,
      request(server).get(`/ledger/reports/accounts/${cash?.accountId}?${range}&limit=10`),
    ).expect(200);
    expect(card.body).toMatchObject({ closingBalance: '1620.00', total: 3 });

    await as(owner, request(server).get('/ledger/reports/trial-balance?dateFrom=2026-12-31&dateTo=2026-01-01')).expect(400);
    await as(owner, request(server).get('/ledger/reports/trial-balance?allowStale=maybe')).expect(400);
  });

  it('keeps the base currency once entries exist', async () => {
    const refused = await as(
      owner,
      request(app.getHttpServer()).put('/ledger/settings').send({ baseCurrency: 'USD' }),
    ).expect(409);
    expect(refused.body.error).toMatchObject({ code: 'LEDGER_BASE_CURRENCY_LOCKED' });
    await as(owner, request(app.getHttpServer()).post('/ledger/sync')).expect(202);
    await as(viewer, request(app.getHttpServer()).get('/ledger/integrity')).expect(200);
  });
});
