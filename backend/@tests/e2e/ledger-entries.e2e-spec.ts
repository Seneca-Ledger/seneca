import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../src/entities';
import { accessTokenOf, e2eTestingModule } from './helpers/e2e-app';

/**
 * The manual journal over HTTP: who may post, what the wire format of errors
 * is, and that a retried create does not open a second draft. The workflow
 * itself is covered against the database in
 * @tests/integration/ledger-manual-entries.spec.ts.
 */
describe('Ledger journal entries (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  interface Session {
    accessToken: string;
    workspaceId: string;
    userId: string;
  }
  let owner: Session;
  let viewer: Session;
  let accounts: Record<string, string>;

  const as = (session: Session, req: request.Test, workspaceId = session.workspaceId) =>
    req.set('Authorization', `Bearer ${session.accessToken}`).set('x-workspace-id', workspaceId);

  async function signUp(email: string): Promise<Session> {
    const server = app.getHttpServer();
    const register = await request(server)
      .post('/auth/register')
      .send({ email, password: 'Test123!@#', name: 'Journal Tester' });
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
      throw new Error(
        `Auth setup failed for ${email}. register ${register.status}: ${JSON.stringify(register.body)} | ` +
          `login ${login.status}: ${JSON.stringify(login.body)}`,
      );
    }
    return session;
  }

  const draft = (lines: Array<Record<string, string>>) => ({ entryDate: '2026-09-10', lines });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    dataSource = app.get(DataSource);

    const suffix = Date.now();
    owner = await signUp(`journal-owner-${suffix}@example.com`);
    viewer = await signUp(`journal-viewer-${suffix}@example.com`);

    // No enable endpoint yet (it arrives with the backfill); switch the ledger on directly.
    await dataSource.getRepository(Workspace).update(owner.workspaceId, { ledgerBaseCurrency: 'EUR' });
    await dataSource.getRepository(WorkspaceMember).save({
      workspaceId: owner.workspaceId,
      userId: viewer.userId,
      role: WorkspaceRole.VIEWER,
      invitedById: owner.userId,
    });

    const chart = await as(owner, request(app.getHttpServer()).get('/ledger/accounts')).expect(200);
    accounts = Object.fromEntries(
      (chart.body as Array<{ code: string; id: string }>).map(account => [account.code, account.id]),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs draft -> post -> reverse over HTTP', async () => {
    const server = app.getHttpServer();
    const created = await as(
      owner,
      request(server)
        .post('/ledger/entries')
        .send(
          draft([
            { accountId: accounts.ASSET_CASH_UNALLOCATED, side: 'debit', amount: '250.00' },
            { accountId: accounts.EQUITY_OPENING_BALANCE, side: 'credit', amount: '250.00' },
          ]),
        ),
    ).expect(201);
    expect(created.body).toMatchObject({ status: 'draft', totals: { difference: '0.00' } });

    const posted = await as(owner, request(server).post(`/ledger/entries/${created.body.id}/post`)).expect(200);
    expect(posted.body).toMatchObject({ status: 'posted', entryNo: '1' });

    const reversal = await as(
      owner,
      request(server).post(`/ledger/entries/${created.body.id}/reverse`).send({ date: '2026-09-11' }),
    ).expect(200);
    expect(reversal.body).toMatchObject({ reversalOfId: created.body.id, entryDate: '2026-09-11' });

    const list = await as(owner, request(server).get('/ledger/entries?status=reversed')).expect(200);
    expect(list.body.data.map((entry: { id: string }) => entry.id)).toEqual([created.body.id]);
  });

  it('answers with coded errors the frontend can translate', async () => {
    const server = app.getHttpServer();
    const unbalanced = await as(
      owner,
      request(server)
        .post('/ledger/entries')
        .send(draft([{ accountId: accounts.ASSET_SUSPENSE, side: 'debit', amount: '10.00' }])),
    ).expect(201);

    const refused = await as(owner, request(server).post(`/ledger/entries/${unbalanced.body.id}/post`)).expect(422);
    expect(refused.body.error).toMatchObject({ code: 'LEDGER_ENTRY_TOO_FEW_LINES' });

    const header = await as(
      owner,
      request(server)
        .post('/ledger/entries')
        .send(draft([{ accountId: accounts.ASSETS, side: 'debit', amount: '1.00' }])),
    ).expect(422);
    expect(header.body.error).toMatchObject({
      code: 'LEDGER_ACCOUNT_NOT_POSTABLE',
      message: 'Account ASSETS is a section header and takes no lines',
    });
  });

  it('refuses float amounts, unknown fields and bad dates at the door', async () => {
    const server = app.getHttpServer();
    for (const body of [
      draft([{ accountId: accounts.ASSET_SUSPENSE, side: 'debit', amount: '10.005' }]),
      draft([{ accountId: accounts.ASSET_SUSPENSE, side: 'debit', amount: '-5' }]),
      draft([{ accountId: accounts.ASSET_SUSPENSE, side: 'sideways', amount: '5' }]),
      { ...draft([]), entryDate: '2026-13-01' },
      { ...draft([]), status: 'posted' },
    ]) {
      await as(owner, request(server).post('/ledger/entries').send(body)).expect(400);
    }
  });

  it('returns the first draft when a create is retried with the same idempotency key', async () => {
    const server = app.getHttpServer();
    const send = () =>
      as(
        owner,
        request(server)
          .post('/ledger/entries')
          .set('idempotency-key', `journal-${Date.now()}`)
          .send(draft([{ accountId: accounts.ASSET_SUSPENSE, side: 'debit', amount: '3.00' }])),
      );
    const key = `journal-retry-${Date.now()}`;
    const first = await as(
      owner,
      request(server)
        .post('/ledger/entries')
        .set('idempotency-key', key)
        .send(draft([{ accountId: accounts.ASSET_SUSPENSE, side: 'debit', amount: '3.00' }])),
    ).expect(201);
    const second = await as(
      owner,
      request(server)
        .post('/ledger/entries')
        .set('idempotency-key', key)
        .send(draft([{ accountId: accounts.ASSET_SUSPENSE, side: 'debit', amount: '3.00' }])),
    ).expect(201);
    expect(second.body.id).toBe(first.body.id);
    // A different key is a different draft.
    expect((await send().expect(201)).body.id).not.toBe(first.body.id);
  });

  it('lets a workspace viewer read the journal but not post to it', async () => {
    const server = app.getHttpServer();
    await as(viewer, request(server).get('/ledger/entries'), owner.workspaceId).expect(200);
    await as(
      viewer,
      request(server)
        .post('/ledger/entries')
        .send(draft([{ accountId: accounts.ASSET_SUSPENSE, side: 'debit', amount: '1.00' }])),
      owner.workspaceId,
    ).expect(403);

    const target = (await as(owner, request(server).get('/ledger/entries?status=posted')).expect(200)).body
      .data[0].id;
    await as(viewer, request(server).post(`/ledger/entries/${target}/reverse`).send({}), owner.workspaceId).expect(403);
  });

  it('answers 404 for an entry of another workspace', async () => {
    const server = app.getHttpServer();
    const target = (await as(owner, request(server).get('/ledger/entries')).expect(200)).body.data[0].id;
    // The viewer's own workspace has the ledger off, but the lookup is scoped before that matters.
    await as(viewer, request(server).get(`/ledger/entries/${target}`)).expect(404);
  });
});
