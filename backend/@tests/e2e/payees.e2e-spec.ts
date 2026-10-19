jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Payees as in YNAB: every row gets one as it is booked, the user can rename,
 * merge and instruct them, and moving a row to another payee is remembered for
 * the next import of the same descriptor. Only real SQL settles these: the
 * subscriber, the alias upsert and the merge are all database writes.
 */
describe('Payees (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `payees-${stamp}@example.com`, other: `payees-other-${stamp}@example.com` };
  let owner: E2eAccount;
  let other: E2eAccount;
  let categoryIds: string[];

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const transactions = () => dataSource.getRepository(Transaction);

  const book = (counterpartyName: string, fields: Partial<Transaction> = {}) =>
    transactions().save(
      transactions().create({
        workspaceId: owner.workspaceId,
        transactionDate: new Date('2026-05-02'),
        counterpartyName,
        paymentPurpose: counterpartyName,
        debit: 10,
        amount: 10,
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        isVerified: false,
        ...fields,
      }),
    );

  const classify = async (id: string) => {
    await as(owner, request(server()).post(`/classification/transaction/${id}`)).expect(200);
    return transactions().findOneByOrFail({ id });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Payee Owner');
    other = await registerAccount(app, emails.other, 'Payee Other');
    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    categoryIds = categories.body.map((category: { id: string }) => category.id);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('gives every booked row a payee, one per shop whatever the terminal number', async () => {
    const first = await book('REWE SAGT DANKE 6334 //BERLIN/DE');
    const second = await book('REWE SAGT DANKE 1182 //BERLIN/DE');
    const nobody = await book('Invoice number 2955 6044 0015');

    expect(first.payeeId).toBeTruthy();
    expect(second.payeeId).toBe(first.payeeId);
    expect(nobody.payeeId).toBeNull();

    const listed = await as(owner, request(server()).get('/payees?search=rewe')).expect(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({
        id: first.payeeId,
        name: 'REWE SAGT DANKE 6334 //BERLIN/DE',
        mode: 'auto',
        transactionCount: 2,
      }),
    ]);
  });

  it('remembers a payee picked for a row, so the next import of it lands there', async () => {
    const raw = await book('RAILWAY*USAGE 77 SAN FRANCISCO');
    const named = await as(owner, request(server()).put(`/transactions/${raw.id}/payee`))
      .send({ name: 'Railway' })
      .expect(200);

    const next = await book('RAILWAY*USAGE 78 SAN FRANCISCO');

    expect(next.payeeId).toBe(named.body.payee.id);
    const earlier = await transactions().findOneByOrFail({ id: raw.id });
    expect(earlier.payeeId).toBe(named.body.payee.id);
  });

  it("files a row by its new payee's history once the payee changes", async () => {
    for (const day of ['01', '02']) {
      await book(`HETZNER ONLINE ${day}`, {
        categoryId: categoryIds[1],
        categorySource: TransactionCategorySource.MANUAL,
      });
    }
    const hetzner = await transactions().findOneByOrFail({
      workspaceId: owner.workspaceId,
      counterpartyName: 'HETZNER ONLINE 01',
    });
    const stray = await book('HTZ CLOUD SERVER');

    const moved = await as(owner, request(server()).put(`/transactions/${stray.id}/payee`))
      .send({ payeeId: hetzner.payeeId })
      .expect(200);

    expect(moved.body).toMatchObject({ categoryId: categoryIds[1], categorySource: 'history' });
  });

  it('merges two payees into one, history and descriptors together', async () => {
    const coffee = await book('BLUE BOTTLE COFFEE', {
      categoryId: categoryIds[2],
      isVerified: true,
    });
    const square = await book('SQ *BLUE BOTTLE OAKLAND', {
      categoryId: categoryIds[2],
      isVerified: true,
    });
    expect(square.payeeId).not.toBe(coffee.payeeId);

    const merged = await as(owner, request(server()).post(`/payees/${coffee.payeeId}/merge`))
      .send({ sourceIds: [square.payeeId] })
      .expect(201);
    expect(merged.body.merged).toBe(1);
    // Repeating it is harmless.
    await as(owner, request(server()).post(`/payees/${coffee.payeeId}/merge`))
      .send({ sourceIds: [square.payeeId] })
      .expect(201)
      .expect(res => expect(res.body.merged).toBe(0));

    const next = await book('SQ *BLUE BOTTLE OAKLAND');
    expect(next.payeeId).toBe(coffee.payeeId);
    const classified = await classify(next.id);
    expect(classified).toMatchObject({ categoryId: categoryIds[2], categorySource: 'history' });
  });

  it('obeys "always" and "never", and refuses "always" without a category', async () => {
    const pinned = await book('NETFLIX.COM 4471');
    await as(owner, request(server()).patch(`/payees/${pinned.payeeId}`))
      .send({ mode: 'always' })
      .expect(400);
    await as(owner, request(server()).patch(`/payees/${pinned.payeeId}`))
      .send({ mode: 'always', categoryId: categoryIds[3] })
      .expect(200);

    const classified = await classify((await book('NETFLIX.COM 4472')).id);

    expect(classified).toMatchObject({ categoryId: categoryIds[3], categorySource: 'learned' });
  });

  it('refuses a name another payee already has, pointing at it for a merge', async () => {
    const lidl = await book('LIDL DIENSTLEISTUNG');
    const aldi = await book('ALDI SUED');
    await as(owner, request(server()).patch(`/payees/${lidl.payeeId}`))
      .send({ name: 'Discounter' })
      .expect(200);

    const res = await as(owner, request(server()).patch(`/payees/${aldi.payeeId}`))
      .send({ name: 'discounter' })
      .expect(409);

    expect(JSON.stringify(res.body)).toContain(lidl.payeeId as string);
  });

  it('lists the rows of a payee still waiting whose category nobody chose', async () => {
    const decided = await book('SPAR MARKT 1', {
      categoryId: categoryIds[0],
      categorySource: TransactionCategorySource.MANUAL,
    });
    const guessed = await book('SPAR MARKT 2', {
      categoryId: categoryIds[1],
      categorySource: TransactionCategorySource.AI,
    });
    const open = await book('SPAR MARKT 3');
    const approved = await book('SPAR MARKT 4', { isVerified: true });

    const res = await as(
      owner,
      request(server())
        .get(`/payees/${decided.payeeId}/pending-review`)
        .query({ excludeTransactionId: open.id }),
    ).expect(200);

    expect(res.body.transactionIds).toEqual([guessed.id]);
    expect(res.body.transactionIds).not.toContain(approved.id);
  });

  it("shows another workspace nothing and refuses to touch its payees", async () => {
    const mine = await book('PRIVATE SHOP');

    const listed = await as(other, request(server()).get('/payees')).expect(200);
    expect(listed.body.data.map((payee: { id: string }) => payee.id)).not.toContain(mine.payeeId);
    await as(other, request(server()).patch(`/payees/${mine.payeeId}`))
      .send({ name: 'Mine now' })
      .expect(404);
    await as(other, request(server()).put(`/transactions/${mine.id}/payee`))
      .send({ name: 'Mine now' })
      .expect(404);
    await as(other, request(server()).get(`/payees/${mine.payeeId}/pending-review`)).expect(404);
  });
});
