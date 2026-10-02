jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { generateKeyPairSync } from 'node:crypto';
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

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * A stand-in for Enable Banking. It checks that every call arrives with an
 * RS256 bearer naming the application, which is the part that would silently
 * break if the JWT were built wrong.
 */
async function standIn(url: string, init: RequestInit = {}): Promise<Response> {
  const authorization = (init.headers as Record<string, string> | undefined)?.authorization ?? '';
  const [header] = authorization.replace('Bearer ', '').split('.');
  const decoded = header ? JSON.parse(Buffer.from(header, 'base64url').toString()) : {};
  if (decoded.alg !== 'RS256' || decoded.kid !== 'app-1') {
    return new Response('', { status: 401 });
  }
  const path = url.replace('https://api.enablebanking.com', '');
  if (path === '/application') return json({ name: 'Lumio self-host' });
  if (path.startsWith('/aspsps')) {
    return json({
      aspsps: [{ name: 'Nordea', country: 'FI', maximum_consent_validity: 7_776_000 }],
    });
  }
  if (path === '/auth') return json({ url: 'https://nordea.example/consent?x=1' });
  if (path === '/sessions') {
    return json({
      session_id: 'sess-1',
      aspsp: { name: 'Nordea', country: 'FI' },
      access: { valid_until: '2026-12-01T00:00:00.000Z' },
      accounts: [{ uid: 'acc-1', name: 'Account', currency: 'EUR' }],
    });
  }
  if (path.startsWith('/sessions/sess-1')) {
    return json({
      session_id: 'sess-1',
      aspsp: { name: 'Nordea', country: 'FI' },
      access: { valid_until: '2026-12-01T00:00:00.000Z' },
      accounts: [{ uid: 'acc-1', name: 'Account', currency: 'EUR' }],
    });
  }
  if (path.startsWith('/accounts/acc-1/balances')) {
    return json({
      balances: [
        {
          balance_type: 'CLBD',
          balance_amount: { amount: '500.00', currency: 'EUR' },
          reference_date: new Date().toISOString().slice(0, 10),
        },
      ],
    });
  }
  if (path.startsWith('/accounts/acc-1/transactions')) {
    return json({
      transactions: [
        {
          entry_reference: 'EB-1',
          booking_date: '2026-09-20',
          credit_debit_indicator: 'DBIT',
          transaction_amount: { amount: '4.50', currency: 'EUR' },
          creditor: { name: 'Coffee Co' },
          remittance_information: ['EREF+coffee'],
        },
      ],
    });
  }
  return new Response('', { status: 404 });
}

describe('Bank sync through Enable Banking (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `eb-owner-${stamp}@example.com`;
  let owner: E2eAccount;
  let connectionId: string;
  let state: string;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] })
      .overrideProvider(BANK_SYNC_FETCH)
      .useValue(standIn)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'EB Owner');
  }, 180_000);

  afterAll(async () => {
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('offers both providers, naming how each one links', async () => {
    const res = await as(request(server()).get('/integrations/bank-sync/providers')).expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        { key: 'simplefin', linkStyle: 'token' },
        { key: 'enablebanking', linkStyle: 'redirect' },
      ]),
    );
  });

  it('refuses a setup token for a provider that authorizes in the browser', async () => {
    const res = await as(request(server()).post('/integrations/bank-sync/connections/token'))
      .send({ provider: 'enablebanking', setupToken: 'whatever' })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/browser/);
  });

  it('stores the application credentials only after the provider accepts them', async () => {
    await as(request(server()).post('/integrations/bank-sync/connections/redirect'))
      .send({ provider: 'enablebanking', secrets: { applicationId: 'wrong', privateKey: pem } })
      .expect(400);

    const res = await as(request(server()).post('/integrations/bank-sync/connections/redirect'))
      .send({
        provider: 'enablebanking',
        secrets: { applicationId: 'app-1', privateKey: pem },
        label: 'My Enable Banking app',
      })
      .expect(201);
    connectionId = res.body.id;
    expect(res.body).toMatchObject({ linkStyle: 'redirect', label: 'My Enable Banking app' });
    expect(res.body.config.links).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE KEY');

    const stored = await dataSource.query(
      `SELECT s.encrypted_secrets FROM open_protocol_settings s
       JOIN integrations i ON i.id = s.integration_id WHERE i.id = $1`,
      [connectionId],
    );
    expect(JSON.stringify(stored[0].encrypted_secrets)).not.toContain('PRIVATE KEY');
  });

  it('lists the banks of a country with their consent ceiling', async () => {
    const res = await as(
      request(server()).get(
        `/integrations/bank-sync/connections/${connectionId}/institutions?country=FI`,
      ),
    ).expect(200);
    expect(res.body).toEqual([
      { name: 'Nordea', country: 'FI', maxConsentValiditySeconds: 7_776_000, beta: false },
    ]);
  });

  it('starts the authorization and will only redeem the state it handed out', async () => {
    const begin = await as(
      request(server()).post(`/integrations/bank-sync/connections/${connectionId}/links/begin`),
    )
      .send({
        institution: 'Nordea',
        country: 'FI',
        redirectUrl: 'https://lumio.example/integrations/bank-sync/callback',
        maxConsentValiditySeconds: 7_776_000,
      })
      .expect(201);
    expect(begin.body.url).toBe('https://nordea.example/consent?x=1');
    state = begin.body.state;
    expect(state).toHaveLength(36);

    const forged = await as(
      request(server()).post(`/integrations/bank-sync/connections/${connectionId}/links/complete`),
    )
      .send({ code: 'code-1', state: 'not-the-state-we-issued' })
      .expect(400);
    expect(JSON.stringify(forged.body)).toMatch(/not started here/);
  });

  it('completes the link, lists its accounts and pulls one into a statement', async () => {
    const completed = await as(
      request(server()).post(`/integrations/bank-sync/connections/${connectionId}/links/complete`),
    )
      .send({ code: 'code-1', state })
      .expect(201);
    expect(completed.body.config.links).toEqual([
      {
        id: 'sess-1',
        institution: 'Nordea',
        country: 'FI',
        consentExpiresAt: '2026-12-01T00:00:00.000Z',
      },
    ]);
    // Accounts from a link the user just authorized start on.
    expect(completed.body.config.accounts).toEqual([
      expect.objectContaining({
        id: 'acc-1',
        org: 'Nordea',
        currency: 'EUR',
        enabled: true,
        linkId: 'sess-1',
        consentExpiresAt: '2026-12-01T00:00:00.000Z',
      }),
    ]);

    const pull = await as(
      request(server()).post(`/integrations/bank-sync/connections/${connectionId}/sync`),
    ).expect(201);
    expect(pull.body).toMatchObject({ imported: 1, statements: 1 });

    const statementId = pull.body.accounts[0].statementId as string;
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const res = await as(request(server()).get(`/statements/${statementId}`)).expect(200);
      if (res.body.status === 'completed') break;
      if (res.body.status === 'failed') throw new Error('statement failed to parse');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const rows = await as(
      request(server()).get(`/transactions?statementId=${statementId}`),
    ).expect(200);
    expect(rows.body.data).toHaveLength(1);
    expect(rows.body.data[0]).toMatchObject({ documentNumber: 'acc-1:EB-1' });
  }, 240_000);
});
