jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ExchangeRate } from '../../src/entities/exchange-rate.entity';
import { User, UserRole } from '../../src/entities/user.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A missing rate is reported, never a silent 1; a hand-entered rate fills the gap. */
describe('Exchange rates: coverage and manual rates (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `fx-owner-${stamp}@example.com`,
    other: `fx-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  // A code no provider knows, so the test never depends on the network.
  const EXOTIC = 'ZZX';

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'FX Owner');
    other = await registerAccount(app, emails.other, 'FX Other');
    await dataSource.getRepository(User).update({ email: emails.owner }, { role: UserRole.ADMIN });
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);
    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '100')
      .field('currency', EXOTIC)
      .field('merchant', 'Exotic shop')
      .field('categoryId', categories.body[0].id)
      .field('date', new Date().toISOString().slice(0, 10))
      .expect(201);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.getRepository(ExchangeRate).delete({ baseCurrency: EXOTIC });
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('says a rate is missing instead of pretending it is 1', async () => {
    const rate = await as(owner, request(server()).get(`/exchange-rates?from=${EXOTIC}&to=USD`)).expect(
      200,
    );
    expect(rate.body).toMatchObject({ rate: 1, missing: true });

    const coverage = await as(owner, request(server()).get('/exchange-rates/coverage')).expect(200);
    expect(coverage.body.currency).toBe('USD');
    expect(coverage.body.missing).toContain(EXOTIC);

    const dashboard = await as(owner, request(server()).get('/dashboard')).expect(200);
    const snapshot = dashboard.body.snapshot ?? dashboard.body.data?.snapshot;
    expect(snapshot.missingRates).toContain(EXOTIC);
  });

  it('takes a hand-entered rate and uses it from then on', async () => {
    await as(owner, request(server()).post('/exchange-rates/manual'))
      .send({ from: EXOTIC, to: 'USD', rate: 0.25 })
      .expect(201);

    const rate = await as(owner, request(server()).get(`/exchange-rates?from=${EXOTIC}&to=USD`)).expect(
      200,
    );
    expect(rate.body).toMatchObject({ rate: 0.25, missing: false });

    const coverage = await as(owner, request(server()).get('/exchange-rates/coverage')).expect(200);
    expect(coverage.body.missing).not.toContain(EXOTIC);
    expect(coverage.body.currencies.find((item: { currency: string }) => item.currency === EXOTIC)).toMatchObject({
      rate: 0.25,
    });
  });

  it('keeps a hand-entered rate inside the workspace that entered it', async () => {
    const rate = await as(other, request(server()).get(`/exchange-rates?from=${EXOTIC}&to=USD`)).expect(
      200,
    );
    expect(rate.body).toMatchObject({ rate: 1, missing: true });

    const converted = await as(other, request(server()).post('/exchange-rates/convert'))
      .send({ items: [{ amount: 100, currency: EXOTIC }], targetCurrency: 'USD' })
      .expect(201);
    expect(converted.body.results[0].converted).toBe(100);

    const own = await as(owner, request(server()).post('/exchange-rates/convert'))
      .send({ items: [{ amount: 100, currency: EXOTIC }], targetCurrency: 'USD' })
      .expect(201);
    expect(own.body.results[0].converted).toBe(25);
  });

  it('needs a workspace to quote a rate', () => {
    return request(server())
      .get(`/exchange-rates?from=${EXOTIC}&to=USD`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);
  });

  it('rejects a rate that is not positive', () => {
    return as(owner, request(server()).post('/exchange-rates/manual'))
      .send({ from: EXOTIC, to: 'USD', rate: 0 })
      .expect(400);
  });
});
