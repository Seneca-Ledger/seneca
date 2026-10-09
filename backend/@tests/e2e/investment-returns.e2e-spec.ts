jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * The returns page against a real database: a contribution, a withdrawal and
 * a dividend linked to one account, what each does to the account and to the
 * income figures, and the window arithmetic built on them.
 */
describe('Investment returns (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `returns-owner-${stamp}@example.com`,
    other: `returns-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let accountId: string;
  const rows: Record<'contribution' | 'withdrawal' | 'dividend', string> = {
    contribution: '',
    withdrawal: '',
    dividend: '',
  };

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };

  async function seedRow(input: { date: string; debit?: number; credit?: number }) {
    const repository = dataSource.getRepository(Transaction);
    const saved = await repository.save(
      repository.create({
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        transactionDate: new Date(input.date),
        paymentPurpose: 'Broker',
        counterpartyName: 'Broker AG',
        currency: 'USD',
        debit: input.debit ?? null,
        credit: input.credit ?? null,
        amount: input.debit ?? input.credit ?? 0,
        transactionType: input.debit ? TransactionType.EXPENSE : TransactionType.INCOME,
        isVerified: true,
      }),
    );
    return saved.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Returns Owner');
    other = await registerAccount(app, emails.other, 'Returns Other');
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);

    const account = await as(owner, request(server()).post('/investments/accounts'))
      .send({ name: 'Broker' })
      .expect(201);
    accountId = account.body.id;
    await as(owner, request(server()).post(`/investments/accounts/${accountId}/holdings`))
      .send({ name: 'World ETF', assetClass: 'etf', quantity: 10, price: 110, priceCurrency: 'USD' })
      .expect(201);

    rows.contribution = await seedRow({ date: daysAgo(400), debit: 1000 });
    rows.withdrawal = await seedRow({ date: daysAgo(100), credit: 300 });
    rows.dividend = await seedRow({ date: daysAgo(50), credit: 40 });
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('asks an income row whether it is a withdrawal or a dividend', async () => {
    await as(owner, request(server()).post('/investments/contributions'))
      .send({ transactionId: rows.withdrawal, accountId })
      .expect(400);
    await as(owner, request(server()).post('/investments/contributions'))
      .send({ transactionId: rows.withdrawal, accountId, role: 'gift' })
      .expect(400);
  });

  it('links a contribution, a withdrawal and a dividend', async () => {
    await as(owner, request(server()).post('/investments/contributions'))
      .send({ transactionId: rows.contribution, accountId })
      .expect(201);
    const withdrawal = await as(owner, request(server()).post('/investments/contributions'))
      .send({ transactionId: rows.withdrawal, accountId, role: 'withdrawal' })
      .expect(201);
    expect(withdrawal.body).toMatchObject({
      investmentAccountId: accountId,
      transferPairKind: 'investment',
    });
    const dividend = await as(owner, request(server()).post('/investments/contributions'))
      .send({ transactionId: rows.dividend, accountId, role: 'income' })
      .expect(201);
    expect(dividend.body).toMatchObject({
      investmentAccountId: accountId,
      transferPairId: null,
      transferPairKind: null,
    });
  });

  it('keeps the dividend in the income figures and takes the withdrawal out', async () => {
    const netWorth = await as(owner, request(server()).get('/reports/net-worth?range=1y')).expect(
      200,
    );
    expect(netWorth.body.savings.income).toBe(40);
  });

  it('counts the withdrawal against what is invested and the dividend as gain', async () => {
    const accounts = await as(owner, request(server()).get('/investments')).expect(200);
    // 1100 held + 40 paid out, against 1000 in less 300 back.
    expect(accounts.body[0]).toMatchObject({
      value: 1100,
      contributed: 1000,
      withdrawn: 300,
      income: 40,
      netInvested: 700,
      gain: 440,
    });
  });

  it('measures the whole history, with an annual rate for more than a year', async () => {
    const res = await as(owner, request(server()).get('/investments/returns?range=all')).expect(
      200,
    );

    expect(res.body.summary).toMatchObject({
      startValue: 0,
      endValue: 1100,
      contributions: 1000,
      withdrawals: 300,
      income: 40,
      gain: 440,
      netInvested: 700,
      method: 'modified_dietz',
      annualizedMethod: 'xirr',
    });
    expect(res.body.summary.returnPercent).toBeGreaterThan(0);
    expect(res.body.summary.annualizedPercent).toBeGreaterThan(0);
    expect(res.body.sources).toEqual([
      expect.objectContaining({ kind: 'account', id: accountId, includedInReturn: true }),
    ]);
    const last = res.body.series[res.body.series.length - 1];
    expect(last).toMatchObject({ date: daysAgo(0), value: 1100, netContributed: 700 });
    // A price typed in today is no reason to flag anything.
    expect(res.body.flags).toEqual([]);
  });

  it('leaves the account out of a month it has no opening value for', async () => {
    const res = await as(owner, request(server()).get('/investments/returns?range=30d')).expect(
      200,
    );

    expect(res.body.sources[0]).toMatchObject({ includedInReturn: false, returnPercent: null });
    expect(res.body.flags).toContainEqual({ code: 'opening_value_unknown', sourceId: accountId });
    expect(res.body.summary.annualizedPercent).toBeNull();
  });

  it('refuses a window it does not offer', async () => {
    await as(owner, request(server()).get('/investments/returns?range=90d')).expect(400);
  });

  it('shows nothing of one workspace to another', async () => {
    const own = await as(other, request(server()).get('/investments/returns')).expect(200);
    expect(own.body.sources).toEqual([]);

    await request(server())
      .get('/investments/returns')
      .set('Authorization', `Bearer ${other.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .expect(403);
  });

  it('unlinks a dividend without turning it into anything else', async () => {
    const res = await as(
      owner,
      request(server()).delete(`/investments/contributions/${rows.dividend}`),
    ).expect(200);
    expect(res.body).toMatchObject({ investmentAccountId: null, transferPairId: null });

    const netWorth = await as(owner, request(server()).get('/reports/net-worth?range=1y')).expect(
      200,
    );
    expect(netWorth.body.savings.income).toBe(40);
  });
});
