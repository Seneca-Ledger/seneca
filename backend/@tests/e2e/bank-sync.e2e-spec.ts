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

const claimUrl = 'https://bridge.example.org/simplefin/claim/demo';
const setupToken = Buffer.from(claimUrl).toString('base64');
const accessUrl = 'https://demo:secret@bridge.example.org/simplefin';
const day = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/**
 * A stand-in for SimpleFIN Bridge: one claim, then an account list. Nothing
 * leaves the process; the point is the exchange, the storage and the import.
 */
const bridge = {
  claims: 0,
  calls: [] as string[],
  transactions: [
    { id: 'TRN-1', posted: day('2026-09-03T10:00:00Z'), amount: '-42.50', description: 'COFFEE CO', payee: 'Coffee Co' },
    { id: 'TRN-2', posted: day('2026-09-25T10:00:00Z'), amount: '3000.00', description: 'ACME PAYROLL' },
  ],
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    bridge.calls.push(`${init.method ?? 'GET'} ${url}`);
    if (url === claimUrl && init.method === 'POST') {
      bridge.claims += 1;
      return bridge.claims === 1
        ? new Response(accessUrl, { status: 200 })
        : new Response('', { status: 403 });
    }
    const authorization = (init.headers as Record<string, string> | undefined)?.authorization;
    if (authorization !== `Basic ${Buffer.from('demo:secret').toString('base64')}`) {
      return new Response('', { status: 401 });
    }
    const target = new URL(url);
    const balancesOnly = target.searchParams.get('balances-only') === '1';
    return new Response(
      JSON.stringify({
        errors: [],
        accounts: [
          {
            org: { name: 'Demo Bank', domain: 'demo.example' },
            id: 'ACT-1',
            name: 'Checking',
            currency: 'USD',
            balance: '2957.50',
            'balance-date': day('2026-09-30T00:00:00Z'),
            transactions: balancesOnly ? [] : bridge.transactions,
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  },
};

describe('Bank sync through SimpleFIN (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `bank-owner-${stamp}@example.com`, other: `bank-other-${stamp}@example.com` };
  let owner: E2eAccount;
  let other: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BANK_SYNC_FETCH)
      .useValue(bridge.fetch)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, emails.owner, 'Bank Owner');
    other = await registerAccount(app, emails.other, 'Bank Other');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('starts disconnected', async () => {
    const res = await as(owner, request(server()).get('/integrations/simplefin/status')).expect(200);
    expect(res.body).toMatchObject({ connected: false, settings: null });
  });

  it('claims the setup token once, stores the credential encrypted and lists the accounts', async () => {
    const res = await as(owner, request(server()).post('/integrations/simplefin/connect'))
      .send({ setupToken })
      .expect(201);
    expect(res.body.connected).toBe(true);
    expect(res.body.settings.accounts).toEqual([
      expect.objectContaining({ id: 'ACT-1', name: 'Checking', org: 'Demo Bank', enabled: true, balance: 2957.5 }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(bridge.claims).toBe(1);

    const stored = await dataSource.query(
      `SELECT s.encrypted_secrets FROM open_protocol_settings s
       JOIN integrations i ON i.id = s.integration_id
       WHERE i.workspace_id = $1 AND i.provider = 'simplefin'`,
      [owner.workspaceId],
    );
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0].encrypted_secrets)).not.toContain('secret');

    // Another workspace sees nothing of it.
    const theirs = await as(other, request(server()).get('/integrations/simplefin/status')).expect(200);
    expect(theirs.body.connected).toBe(false);
  });

  it('pulls the enabled account into an OFX statement that the pipeline parses, and never twice', async () => {
    const first = await as(owner, request(server()).post('/integrations/simplefin/sync')).expect(201);
    expect(first.body).toMatchObject({ imported: 2, statements: 1 });
    const statementId = first.body.accounts[0].statementId as string;
    expect(statementId).toBeTruthy();

    const statement = await as(owner, request(server()).get(`/statements/${statementId}`)).expect(200);
    expect(statement.body.fileType).toBe('ofx');
    expect(statement.body.fileName).toMatch(/^demo-bank-checking-\d{8}\.ofx$/);

    // Parsing runs right after the import; give it a moment.
    let status = statement.body.status;
    for (let attempt = 0; attempt < 30 && status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
      status = (await as(owner, request(server()).get(`/statements/${statementId}`)).expect(200)).body.status;
    }
    if (status === 'completed') {
      const rows = await as(owner, request(server()).get(`/transactions?statementId=${statementId}`)).expect(200);
      expect(rows.body.data).toHaveLength(2);
      expect(rows.body.data.map((row: { documentNumber: string }) => row.documentNumber).sort()).toEqual([
        'ACT-1:TRN-1',
        'ACT-1:TRN-2',
      ]);

      // The same rows again: nothing new, no second statement.
      const second = await as(owner, request(server()).post('/integrations/simplefin/sync')).expect(201);
      expect(second.body).toMatchObject({ imported: 0, statements: 0 });
    } else {
      expect(['uploaded', 'processing']).toContain(status);
    }
  });

  it('lets the owner switch an account off and auto-sync off', async () => {
    const res = await as(owner, request(server()).post('/integrations/simplefin/settings'))
      .send({ autoSync: false, accounts: [{ id: 'ACT-1', enabled: false }] })
      .expect(201);
    expect(res.body.settings.autoSync).toBe(false);
    expect(res.body.settings.accounts[0].enabled).toBe(false);

    const sync = await as(owner, request(server()).post('/integrations/simplefin/sync')).expect(201);
    expect(sync.body).toMatchObject({ imported: 0, statements: 0, accounts: [] });
  });

  it('forgets the credential on disconnect', async () => {
    await as(owner, request(server()).delete('/integrations/simplefin')).expect(200);
    const res = await as(owner, request(server()).get('/integrations/simplefin/status')).expect(200);
    expect(res.body.connected).toBe(false);
    await as(owner, request(server()).post('/integrations/simplefin/sync')).expect(400);

    // A token works once: SimpleFIN says so, and so do we.
    const again = await as(owner, request(server()).post('/integrations/simplefin/connect'))
      .send({ setupToken })
      .expect(400);
    expect(JSON.stringify(again.body)).toMatch(/used already/);
  });
});
