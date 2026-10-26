vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TransactionListPage, TransactionsOverview } from '../../src/contracts';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

interface Slice {
  key: string;
  name: string;
  value: number;
}

/**
 * The All transactions page: the pies by category, source and destination,
 * the month counts and each row's running wallet balance — within one
 * workspace, without another workspace's rows or a private row's merchant.
 */
describe('Transactions overview (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `tx-overview-owner-${stamp}@example.com`,
    other: `tx-overview-other-${stamp}@example.com`,
  };
  const checking = 'Checking Account';
  const savings = 'Savings Account';
  const merchant = 'ACME Store - Wireless Buds';
  const employer = 'Example Employer Ltd';
  let owner: E2eAccount;
  let other: E2eAccount;
  let checkingId: string;
  let savingsId: string;
  const ids: Record<'coffee' | 'gadget' | 'salary' | 'out' | 'in', string> = {
    coffee: '',
    gadget: '',
    salary: '',
    out: '',
    in: '',
  };

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const rows = () => dataSource.getRepository(Transaction);

  async function book(account: E2eAccount, amount: string, party: string, date: string) {
    const categories = await as(account, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const statement = await as(account, request(server()).post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', 'EUR')
      .field('merchant', party)
      .field('categoryId', categories.body[0].id)
      .field('date', date);
    if (statement.status !== 201) throw new Error(JSON.stringify(statement.body));
    const listed = await as(
      account,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    return listed.body.data[0].id as string;
  }

  async function wallet(name: string, initialBalance: number) {
    const res = await as(owner, request(server()).post('/wallets'))
      .send({ name, currency: 'EUR', initialBalance })
      .expect(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    checkingId = await wallet(checking, 1000);
    savingsId = await wallet(savings, 0);

    ids.coffee = await book(owner, '5', merchant, '2026-10-03');
    ids.gadget = await book(owner, '95', merchant, '2026-10-05');
    ids.salary = await book(owner, '2000', employer, '2026-10-10');
    ids.out = await book(owner, '300', savings, '2026-10-12');
    ids.in = await book(owner, '300', checking, '2026-10-12');
    await book(other, '777', merchant, '2026-10-04');
    await book(owner, '40', merchant, '2026-09-20');

    await rows().update([ids.coffee, ids.gadget, ids.out], { walletId: checkingId });
    await rows().update(ids.salary, {
      walletId: checkingId,
      transactionType: TransactionType.INCOME,
      debit: null,
      credit: 2000,
      amount: 2000,
    });
    // A transfer from checking to savings, both legs.
    const pairId = '00000000-0000-4000-8000-0000000000aa';
    await rows().update(ids.out, { transferPairId: pairId });
    await rows().update(ids.in, {
      walletId: savingsId,
      transferPairId: pairId,
      transactionType: TransactionType.INCOME,
      debit: null,
      credit: 300,
      amount: 300,
    });
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  const october = '/transactions/overview?dateFrom=2026-10-01&dateTo=2026-10-31&convertTo=EUR';
  const byName = (slices: Slice[]) => Object.fromEntries(slices.map(s => [s.name, s.value]));

  it('sums the period by source and destination, a transfer once', async () => {
    const res = await as(owner, request(server()).get(october)).expect(200);
    Schema.decodeUnknownSync(TransactionsOverview)(res.body);
    expect(byName(res.body.sources)).toEqual({ [checking]: 400, [employer]: 2000 });
    expect(byName(res.body.destinations)).toEqual({
      [merchant]: 100,
      [checking]: 2000,
      [savings]: 300,
    });
  });

  it('leaves transfers and other months out of the categories', async () => {
    const res = await as(owner, request(server()).get(october)).expect(200);
    const total = res.body.categories.reduce((sum: number, s: Slice) => sum + s.value, 0);
    expect(total).toBe(2100);
  });

  it('counts the rows of the twelve months to the period end', async () => {
    const res = await as(owner, request(server()).get(october)).expect(200);
    expect(res.body.months).toHaveLength(12);
    expect(res.body.months[0]).toEqual({ month: '2026-10', count: 5 });
    expect(res.body.months[1]).toEqual({ month: '2026-09', count: 1 });
  });

  it("shows another workspace's rows to nobody", async () => {
    const res = await as(other, request(server()).get(october)).expect(200);
    expect(res.body.months[0]).toEqual({ month: '2026-10', count: 1 });
    expect(byName(res.body.destinations)).toEqual({ [merchant]: 777 });
  });

  it("hides a private row's merchant from the pies, not its amount", async () => {
    await rows().update(ids.gadget, { isPrivate: true, ownerMemberId: null });
    try {
      const res = await as(owner, request(server()).get(october)).expect(200);
      expect(byName(res.body.destinations)).toMatchObject({ [merchant]: 5, '—': 95 });
    } finally {
      await rows().update(ids.gadget, { isPrivate: false });
    }
  });

  it('runs each wallet balance from its opening balance', async () => {
    const res = await as(
      owner,
      request(server()).get('/transactions?startDate=2026-10-01&endDate=2026-10-31&running_balance=1'),
    ).expect(200);
    Schema.decodeUnknownSync(TransactionListPage)(res.body);
    const byId = Object.fromEntries(
      res.body.data.map((row: { id: string; runningBalance: string | null }) => [
        row.id,
        row.runningBalance,
      ]),
    );
    expect(byId[ids.coffee]).toBe('995.00');
    expect(byId[ids.gadget]).toBe('900.00');
    expect(byId[ids.salary]).toBe('2900.00');
    expect(byId[ids.out]).toBe('2600.00');
    expect(byId[ids.in]).toBe('300.00');
    const outgoing = res.body.data.find((row: { id: string }) => row.id === ids.out);
    expect(outgoing.transferPairWallet).toEqual({ id: savingsId, name: savings });
  });
});
