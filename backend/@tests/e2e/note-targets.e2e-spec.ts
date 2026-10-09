jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Notes on the things a household actually argues about.
 *
 * "What was this?" is asked of a transaction, not of the file it arrived in,
 * and a budget or a goal is where two people disagree about a plan. The targets
 * each keep their own column and foreign key, so a note cannot point at two
 * things, cannot point at none, and goes away with whatever it was about.
 */
describe('Note targets (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `note-owner-${stamp}@example.com`,
    outsider: `note-outsider-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let outsider: E2eAccount;
  let transactionId: string;
  let goalId: string;

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

    owner = await registerAccount(app, emails.owner, 'Note Owner');
    outsider = await registerAccount(app, emails.outsider, 'Note Outsider');

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '40')
      .field('currency', 'EUR')
      .field('merchant', 'Hardware store')
      .field('categoryId', categories.body[0].id)
      .field('date', '2026-05-02')
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    transactionId = listed.body.data[0].id;

    const goal = await as(owner, request(server()).post('/goals'))
      .send({ name: `Holiday ${stamp}`, targetAmount: 2000, currency: 'EUR' })
      .expect(201);
    goalId = goal.body.id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('keeps a note on a transaction', async () => {
    await as(owner, request(server()).post('/notes'))
      .send({ entityType: 'transaction', entityId: transactionId, body: 'Was this the drill?' })
      .expect(201);

    const res = await as(
      owner,
      request(server()).get(`/notes?entityType=transaction&entityId=${transactionId}`),
    ).expect(200);
    expect(res.body.items.map((note: { body: string }) => note.body)).toEqual([
      'Was this the drill?',
    ]);
  });

  it('keeps a note on a goal', async () => {
    await as(owner, request(server()).post('/notes'))
      .send({ entityType: 'goal', entityId: goalId, body: 'Can we push this to spring?' })
      .expect(201);

    const res = await as(
      owner,
      request(server()).get(`/notes?entityType=goal&entityId=${goalId}`),
    ).expect(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('does not mix one target’s notes into another’s', async () => {
    const res = await as(
      owner,
      request(server()).get(`/notes?entityType=transaction&entityId=${transactionId}`),
    ).expect(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('counts the open ones per target for a list', async () => {
    const res = await as(owner, request(server()).post('/notes/counts'))
      .send({ entityType: 'transaction', entityIds: [transactionId] })
      .expect(201);
    expect(res.body.counts[transactionId]).toBe(1);
  });

  it('refuses a target from another workspace', () => {
    return as(outsider, request(server()).post('/notes'))
      .send({ entityType: 'transaction', entityId: transactionId, body: 'not mine to discuss' })
      .expect(404);
  });

  it('refuses a target type it does not know', () => {
    return as(owner, request(server()).post('/notes'))
      .send({ entityType: 'wallet', entityId: transactionId, body: 'nope' })
      .expect(400);
  });

  it('keeps the discussion while the goal is only soft-deleted', async () => {
    // Goals are soft-removed and can come back; their discussion has to come
    // back with them, so the cascade must not fire here.
    await as(owner, request(server()).delete(`/goals/${goalId}`)).expect(200);

    const left = await dataSource.query(
      'SELECT count(*)::int AS count FROM notes WHERE goal_id = $1',
      [goalId],
    );
    expect(left[0].count).toBe(1);
  });

  it('takes the discussion with a thing that is really gone', async () => {
    await as(owner, request(server()).delete(`/transactions/${transactionId}`)).expect(204);

    const left = await dataSource.query(
      'SELECT count(*)::int AS count FROM notes WHERE transaction_id = $1',
      [transactionId],
    );
    expect(left[0].count).toBe(0);
  });
});
