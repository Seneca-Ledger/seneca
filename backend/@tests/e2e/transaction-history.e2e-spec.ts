vi.mock('franc', () => ({
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
 * A row's history in words: only the fields that changed, by name, with a way
 * back that stops once the field has moved on.
 */
describe('Transaction history (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `tx-history-${stamp}@example.com`,
    other: `tx-history-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let categories: Array<{ id: string; name: string }>;
  let rowId: string;

  const store = 'ACME Store';
  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const history = async (account = owner) =>
    (await as(account, request(server()).get(`/transactions/${rowId}/history`))).body;

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
    categories = (await as(owner, request(server()).get('/categories?type=expense')).expect(200))
      .body;
    const repository = dataSource.getRepository(Transaction);
    const row = await repository.save(
      repository.create({
        workspaceId: owner.workspaceId,
        transactionDate: new Date('2026-05-10'),
        counterpartyName: store,
        paymentPurpose: store,
        debit: 30,
        amount: 30,
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        isVerified: true,
        categoryId: categories[0].id,
      }),
    );
    rowId = row.id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('tells only what changed, with names instead of ids', async () => {
    expect((await history()).entries).toEqual([]);

    // The drawer saves the whole form: unchanged fields come along.
    await as(
      owner,
      request(server())
        .put(`/transactions/${rowId}`)
        .send({ categoryId: categories[1].id, counterpartyName: store, debit: 30 }),
    ).expect(200);

    const { entries, origin, currency } = await history();
    expect(currency).toBe('EUR');
    expect(origin.statementName).toBeNull();
    expect(entries).toEqual([
      expect.objectContaining({
        kind: 'changed',
        actor: { kind: 'you', name: null },
        changes: [{ field: 'category', before: categories[0].name, after: categories[1].name }],
        canUndo: true,
      }),
    ]);
  });

  it('puts a change back, and not once the field has moved on', async () => {
    await as(
      owner,
      request(server()).put(`/transactions/${rowId}`).send({ categoryId: categories[2].id }),
    ).expect(200);
    const [latest, earlier] = (await history()).entries;
    expect(earlier.canUndo).toBe(false);
    await as(
      owner,
      request(server()).post(`/transactions/${rowId}/history/${earlier.id}/undo`),
    ).expect(409);

    const after = (
      await as(
        owner,
        request(server()).post(`/transactions/${rowId}/history/${latest.id}/undo`),
      ).expect(201)
    ).body;
    const row = await dataSource.getRepository(Transaction).findOneByOrFail({ id: rowId });
    expect(row.categoryId).toBe(categories[1].id);
    // The undo is an edit of its own, at the top.
    expect(after.entries[0].changes).toEqual([
      { field: 'category', before: categories[2].name, after: categories[1].name },
    ]);
    // Only the newest change of a field can be put back, though an older one wrote the same value.
    expect(after.entries.map((entry: { canUndo: boolean }) => entry.canUndo)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('puts a payee back, by name', async () => {
    // The row was filed under its own name when it was booked.
    await as(
      owner,
      request(server()).put(`/transactions/${rowId}/payee`).send({ name: 'Example Cafe' }),
    ).expect(200);

    const [latest] = (await history()).entries;
    expect(latest.changes).toContainEqual({ field: 'payee', before: store, after: 'Example Cafe' });
    expect(latest.canUndo).toBe(true);

    await as(
      owner,
      request(server()).post(`/transactions/${rowId}/history/${latest.id}/undo`),
    ).expect(201);
    expect((await history()).entries[0].changes).toContainEqual({
      field: 'payee',
      before: 'Example Cafe',
      after: store,
    });
  });

  it("is not another workspace's to read", async () => {
    await as(other, request(server()).get(`/transactions/${rowId}/history`)).expect(404);
  });
});
