jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BANK_SYNC_FETCH } from '../../src/modules/bank-sync/bank-sync-provider.interface';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const day = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/**
 * Two stand-ins for SimpleFIN Bridge, so a feed can move from one provider
 * account to another the way a user moves a bank between providers.
 *
 * The second one reports the same two purchases with its own ids and one day
 * later — exactly how two aggregators disagree about the same card
 * transaction — plus one genuinely new row. Nothing leaves the process.
 */
const bridges = {
  a: {
    claimUrl: 'https://bridge-a.example.org/simplefin/claim/demo',
    accessUrl: 'https://demo:secret-a@bridge-a.example.org/simplefin',
    accountId: 'ACT-A',
    balance: '2957.50',
    transactions: [
      { id: 'A-1', posted: day('2026-09-03T10:00:00Z'), amount: '-42.50', description: 'COFFEE CO', payee: 'Coffee Co' },
      { id: 'A-2', posted: day('2026-09-25T10:00:00Z'), amount: '3000.00', description: 'ACME PAYROLL', payee: 'Acme Payroll' },
    ],
  },
  b: {
    claimUrl: 'https://bridge-b.example.org/simplefin/claim/demo',
    accessUrl: 'https://demo:secret-b@bridge-b.example.org/simplefin',
    accountId: 'ACT-B',
    balance: '2900.00',
    transactions: [
      { id: 'B-1', posted: day('2026-09-04T10:00:00Z'), amount: '-42.50', description: 'COFFEE CO', payee: 'Coffee Co' },
      { id: 'B-2', posted: day('2026-09-26T10:00:00Z'), amount: '3000.00', description: 'ACME PAYROLL', payee: 'Acme Payroll' },
      { id: 'B-3', posted: day('2026-09-28T10:00:00Z'), amount: '-15.00', description: 'BOOKSHOP', payee: 'Bookshop' },
    ],
  },
};

const tokenFor = (which: 'a' | 'b') => Buffer.from(bridges[which].claimUrl).toString('base64');

const calls: string[] = [];
const claims = { a: 0, b: 0 };

async function standIn(url: string, init: RequestInit = {}): Promise<Response> {
  calls.push(`${init.method ?? 'GET'} ${url}`);
  for (const which of ['a', 'b'] as const) {
    const bridge = bridges[which];
    if (url === bridge.claimUrl && init.method === 'POST') {
      claims[which] += 1;
      // A setup token works once: SimpleFIN says so, and so do we.
      return claims[which] === 1
        ? new Response(bridge.accessUrl, { status: 200 })
        : new Response('', { status: 403 });
    }
    const secret = new URL(bridge.accessUrl).password;
    const expected = `Basic ${Buffer.from(`demo:${secret}`).toString('base64')}`;
    const authorization = (init.headers as Record<string, string> | undefined)?.authorization;
    if (url.startsWith(new URL(bridge.accessUrl).origin) && authorization === expected) {
      const target = new URL(url);
      const balancesOnly = target.searchParams.get('balances-only') === '1';
      const start = Number(target.searchParams.get('start-date') ?? 0);
      return new Response(
        JSON.stringify({
          errors: [],
          accounts: [
            {
              org: { name: 'Demo Bank', domain: 'demo.example' },
              id: bridge.accountId,
              name: 'Checking',
              currency: 'USD',
              balance: bridge.balance,
              'balance-date': day('2026-09-30T00:00:00Z'),
              transactions: balancesOnly
                ? []
                : bridge.transactions.filter(row => row.posted >= start),
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
  }
  return new Response('', { status: 401 });
}

describe('Bank sync (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `bank-owner-${stamp}@example.com`,
    other: `bank-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let connectionA: string;
  let connectionB: string;
  let walletId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  /** The OFX import parses in the background; the rows have to be there before dedupe can see them. */
  const awaitParsed = async (statementId: string) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const res = await as(owner, request(server()).get(`/statements/${statementId}`)).expect(200);
      if (res.body.status === 'completed') return res.body;
      if (res.body.status === 'failed') throw new Error(`statement ${statementId} failed to parse`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`statement ${statementId} never finished parsing`);
  };

  const rowsOf = async (statementId: string): Promise<string[]> => {
    const res = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statementId}`),
    ).expect(200);
    return res.body.data.map((row: { documentNumber: string }) => row.documentNumber).sort();
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BANK_SYNC_FETCH)
      .useValue(standIn)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, emails.owner, 'Bank Owner');
    other = await registerAccount(app, emails.other, 'Bank Other');
  }, 180_000);

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('has no connections to begin with', async () => {
    const res = await as(owner, request(server()).get('/integrations/bank-sync/connections')).expect(200);
    expect(res.body).toEqual([]);
  });

  it('claims the setup token once, stores the credential encrypted and lists the accounts', async () => {
    const res = await as(owner, request(server()).post('/integrations/bank-sync/connections/token'))
      .send({ provider: 'simplefin', setupToken: tokenFor('a'), label: 'Bridge A' })
      .expect(201);
    connectionA = res.body.id;
    expect(res.body).toMatchObject({ provider: 'simplefin', linkStyle: 'token', label: 'Bridge A' });
    expect(res.body.config.accounts).toEqual([
      expect.objectContaining({ id: 'ACT-A', name: 'Checking', org: 'Demo Bank', enabled: true, balance: 2957.5 }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain('secret-a');
    expect(claims.a).toBe(1);

    const stored = await dataSource.query(
      `SELECT s.encrypted_secrets FROM open_protocol_settings s
       JOIN integrations i ON i.id = s.integration_id
       WHERE i.workspace_id = $1 AND i.provider = 'simplefin'`,
      [owner.workspaceId],
    );
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0].encrypted_secrets)).not.toContain('secret-a');

    // Another workspace sees nothing of it.
    const theirs = await as(other, request(server()).get('/integrations/bank-sync/connections')).expect(200);
    expect(theirs.body).toEqual([]);
  });

  it('pulls the enabled account into an OFX statement the pipeline parses, and never twice', async () => {
    const wallet = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Checking', currency: 'USD' })
      .expect(201);
    walletId = wallet.body.id;
    await as(
      owner,
      request(server()).patch(`/integrations/bank-sync/connections/${connectionA}/accounts/ACT-A`),
    )
      .send({ walletId })
      .expect(200);

    const first = await as(
      owner,
      request(server()).post(`/integrations/bank-sync/connections/${connectionA}/sync`),
    ).expect(201);
    expect(first.body).toMatchObject({ imported: 2, statements: 1 });

    const statementId = first.body.accounts[0].statementId as string;
    const statement = await awaitParsed(statementId);
    expect(statement.fileType).toBe('ofx');
    expect(statement.fileName).toMatch(/^demo-bank-checking-\d{8}\.ofx$/);
    expect(await rowsOf(statementId)).toEqual(['ACT-A:A-1', 'ACT-A:A-2']);

    const second = await as(
      owner,
      request(server()).post(`/integrations/bank-sync/connections/${connectionA}/sync`),
    ).expect(201);
    expect(second.body).toMatchObject({ imported: 0, statements: 0 });
  }, 240_000);

  it('holds a second connection to the same provider alongside the first', async () => {
    const res = await as(owner, request(server()).post('/integrations/bank-sync/connections/token'))
      .send({ provider: 'simplefin', setupToken: tokenFor('b'), label: 'Bridge B' })
      .expect(201);
    connectionB = res.body.id;
    const list = await as(owner, request(server()).get('/integrations/bank-sync/connections')).expect(200);
    expect(list.body.map((item: { label: string }) => item.label)).toEqual(['Bridge A', 'Bridge B']);
  });

  it('refuses to point a second feed at a wallet that already has one', async () => {
    const res = await as(
      owner,
      request(server()).patch(`/integrations/bank-sync/connections/${connectionB}/accounts/ACT-B`),
    )
      .send({ walletId })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/switch it instead/);
  });

  it('moves the feed to the other provider without duplicating history', async () => {
    const switched = await as(owner, request(server()).post('/integrations/bank-sync/feeds/switch'))
      .send({ walletId, toConnectionId: connectionB, toAccountId: 'ACT-B' })
      .expect(201);
    expect(switched.body.from).toEqual({ connectionId: connectionA, accountId: 'ACT-A' });
    // The day after the wallet's last row.
    expect(switched.body.syncFrom).toBe('2026-09-26T00:00:00.000Z');

    const pull = await as(
      owner,
      request(server()).post(`/integrations/bank-sync/connections/${connectionB}/sync`),
    ).expect(201);

    // B-1 is below the floor. B-2 is the payroll the wallet already holds, one
    // day off and under another id: the tolerant pass has to recognise it.
    // Only B-3 is genuinely new.
    expect(pull.body).toMatchObject({ imported: 1, statements: 1 });
    const statementId = pull.body.accounts[0].statementId as string;
    await awaitParsed(statementId);
    expect(await rowsOf(statementId)).toEqual(['ACT-B:B-3']);

    // The old connection stopped feeding the wallet and went quiet.
    const list = await as(owner, request(server()).get('/integrations/bank-sync/connections')).expect(200);
    const a = list.body.find((item: { id: string }) => item.id === connectionA);
    expect(a.config.accounts[0]).toMatchObject({ walletId: null, enabled: false });
  }, 240_000);

  it('lets the owner switch an account off and auto-sync off', async () => {
    const connection = await as(
      owner,
      request(server()).patch(`/integrations/bank-sync/connections/${connectionB}`),
    )
      .send({ autoSync: false })
      .expect(200);
    expect(connection.body.config.autoSync).toBe(false);

    await as(
      owner,
      request(server()).patch(`/integrations/bank-sync/connections/${connectionB}/accounts/ACT-B`),
    )
      .send({ enabled: false })
      .expect(200);

    const sync = await as(
      owner,
      request(server()).post(`/integrations/bank-sync/connections/${connectionB}/sync`),
    ).expect(201);
    expect(sync.body).toMatchObject({ imported: 0, statements: 0, accounts: [] });
  });

  it('forgets the credential on disconnect and keeps the imported rows', async () => {
    await as(
      owner,
      request(server()).delete(`/integrations/bank-sync/connections/${connectionB}`),
    ).expect(200);

    const list = await as(owner, request(server()).get('/integrations/bank-sync/connections')).expect(200);
    expect(list.body.map((item: { id: string }) => item.id)).toEqual([connectionA]);

    await as(
      owner,
      request(server()).post(`/integrations/bank-sync/connections/${connectionB}/sync`),
    ).expect(400);

    const rows = await as(owner, request(server()).get('/transactions?limit=100')).expect(200);
    expect(rows.body.data.length).toBeGreaterThanOrEqual(3);
  });
});
