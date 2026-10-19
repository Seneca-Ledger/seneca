import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { accessTokenOf, e2eTestingModule } from './helpers/e2e-app';

/**
 * The chart of accounts end to end: seeded on first read, extended by the
 * workspace owner, system accounts protected, and nothing visible across
 * workspaces.
 */
describe('Ledger chart of accounts (e2e)', () => {
  let app: INestApplication;

  interface Session {
    accessToken: string;
    workspaceId: string;
  }
  let owner: Session;
  let stranger: Session;

  interface AccountBody {
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    accountType: string;
    normalBalance: string;
    isPostable: boolean;
    isSystem: boolean;
  }

  const as = (session: Session, req: request.Test) =>
    req.set('Authorization', `Bearer ${session.accessToken}`).set('x-workspace-id', session.workspaceId);

  async function signUp(email: string): Promise<Session> {
    const server = app.getHttpServer();
    const register = await request(server)
      .post('/auth/register')
      .send({ email, password: 'Test123!@#', name: 'Ledger Tester' });
    const login = await request(server).post('/auth/login').send({ email, password: 'Test123!@#' });
    const cookieToken = ([] as string[])
      .concat(login.headers['set-cookie'] ?? [])
      .map(cookie => cookie.split(';')[0])
      .find(cookie => cookie.startsWith('access_token='))
      ?.slice('access_token='.length);
    const session = {
      accessToken: accessTokenOf(login) ?? cookieToken,
      workspaceId: login.body?.user?.workspaceId,
    };
    if (!(session.accessToken && session.workspaceId)) {
      throw new Error(
        `Auth setup failed for ${email}. register ${register.status}: ${JSON.stringify(register.body)} | ` +
          `login ${login.status}: ${JSON.stringify(login.body)}`,
      );
    }
    return session;
  }

  const listAccounts = async (session: Session): Promise<AccountBody[]> =>
    (await as(session, request(app.getHttpServer()).get('/ledger/accounts')).expect(200)).body;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    const suffix = Date.now();
    owner = await signUp(`ledger-owner-${suffix}@example.com`);
    stranger = await signUp(`ledger-stranger-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('seeds the default chart and one account per root category on first read', async () => {
    const accounts = await listAccounts(owner);
    const byCode = new Map(accounts.map(account => [account.code, account]));

    for (const code of ['ASSETS', 'ASSET_CASH', 'ASSET_SUSPENSE', 'LIABILITY_VAT_PAYABLE', 'EQUITY_OPENING_BALANCE', 'INCOME', 'EXPENSES']) {
      expect(byCode.get(code)).toMatchObject({ isSystem: true });
    }
    expect(byCode.get('EXPENSES')).toMatchObject({ isPostable: false, normalBalance: 'debit' });
    expect(byCode.get('LIABILITY_VAT_PAYABLE')).toMatchObject({ isPostable: true, normalBalance: 'credit' });

    // A fresh workspace gets system categories, so both sides have category accounts.
    const expenseAccounts = accounts.filter(account => /^EXPENSE_[0-9A-F]{8}$/.test(account.code));
    const incomeAccounts = accounts.filter(account => /^INCOME_[0-9A-F]{8}$/.test(account.code));
    expect(expenseAccounts.length).toBeGreaterThan(0);
    expect(incomeAccounts.length).toBeGreaterThan(0);
    for (const account of expenseAccounts) {
      expect(account.parentId).toBe(byCode.get('EXPENSES')?.id);
    }

    // Idempotent: a second read changes nothing.
    expect(await listAccounts(owner)).toEqual(accounts);
  });

  it('lets the owner add an account under a section header', async () => {
    const accounts = await listAccounts(owner);
    const cashHeader = accounts.find(account => account.code === 'ASSET_CASH');

    const created = await as(
      owner,
      request(app.getHttpServer())
        .post('/ledger/accounts')
        .send({ code: 'bank-eur', name: 'Main EUR account', accountType: 'asset', parentId: cashHeader?.id, currency: 'eur' }),
    ).expect(201);
    expect(created.body).toMatchObject({
      code: 'BANK-EUR',
      normalBalance: 'debit',
      isSystem: false,
      parentId: cashHeader?.id,
    });

    await as(
      owner,
      request(app.getHttpServer())
        .post('/ledger/accounts')
        .send({ code: 'BANK-EUR', name: 'Duplicate', accountType: 'asset' }),
    ).expect(409);

    await as(
      owner,
      request(app.getHttpServer())
        .patch(`/ledger/accounts/${created.body.id}`)
        .send({ name: 'Renamed EUR account' }),
    )
      .expect(200)
      .expect(res => expect(res.body.name).toBe('Renamed EUR account'));

    // Type is fixed at creation.
    await as(
      owner,
      request(app.getHttpServer())
        .patch(`/ledger/accounts/${created.body.id}`)
        .send({ accountType: 'expense' }),
    ).expect(400);

    await as(owner, request(app.getHttpServer()).delete(`/ledger/accounts/${created.body.id}`)).expect(200);
    expect((await listAccounts(owner)).some(account => account.id === created.body.id)).toBe(false);
  });

  it('refuses to delete or re-code a system account', async () => {
    const assets = (await listAccounts(owner)).find(account => account.code === 'ASSETS');

    await as(owner, request(app.getHttpServer()).delete(`/ledger/accounts/${assets?.id}`)).expect(400);
    await as(
      owner,
      request(app.getHttpServer()).patch(`/ledger/accounts/${assets?.id}`).send({ code: 'X' }),
    ).expect(400);
  });

  it('keeps each workspace chart to itself', async () => {
    const ownerAccount = (await listAccounts(owner)).find(account => account.code === 'EXPENSES');

    // The stranger's own chart holds different rows.
    const strangerAccounts = await listAccounts(stranger);
    expect(strangerAccounts.some(account => account.id === ownerAccount?.id)).toBe(false);

    // And the owner's account is not reachable from the stranger's workspace.
    await as(
      stranger,
      request(app.getHttpServer()).patch(`/ledger/accounts/${ownerAccount?.id}`).send({ name: 'Hijacked' }),
    ).expect(404);

    // Nor can the stranger claim the owner's workspace.
    await request(app.getHttpServer())
      .get('/ledger/accounts')
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .set('x-workspace-id', owner.workspaceId)
      .expect(403);
  });
});
