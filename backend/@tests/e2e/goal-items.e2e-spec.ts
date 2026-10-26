vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GoalItemsResponse } from '../../src/contracts';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Goal cost lines are the first routes validated by a contract from
 * packages/contracts instead of a class-validator DTO: the body goes through
 * the Effect Schema pipe and every answer must decode as GoalItemsResponse.
 */
describe('Goal items (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `goal-items-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let goalId: string;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const decode = Schema.decodeUnknownSync(GoalItemsResponse, { onExcessProperty: 'error' });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // As in main.ts: the global pipe must not get in the way of the schema.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, email, 'Goal Items Owner');
    const goal = await as(request(server()).post('/goals'))
      .send({ name: 'Move to Lisbon', targetAmount: 1000, currency: 'EUR' })
      .expect(201);
    goalId = goal.body.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('adds, edits and removes a line, answering with the whole list each time', async () => {
    const created = await as(request(server()).post(`/goals/${goalId}/items`))
      .send({ name: 'Visa', estimatedAmount: 120, dueMonth: '2026-11', note: null })
      .expect(201);
    const afterCreate = decode(created.body);
    expect(afterCreate.items).toEqual([
      expect.objectContaining({
        name: 'Visa',
        estimatedAmount: 120,
        actualAmount: null,
        currency: 'EUR',
        dueMonth: '2026-11',
        status: 'planned',
      }),
    ]);
    expect(afterCreate.summary).toMatchObject({ estimatedTotal: 120, unallocated: 880 });

    const itemId = afterCreate.items[0].id;
    const updated = await as(request(server()).patch(`/goals/${goalId}/items/${itemId}`))
      .send({ actualAmount: 150, status: 'paid' })
      .expect(200);
    expect(decode(updated.body).summary).toMatchObject({ committedTotal: 150, paidTotal: 150 });

    const listed = await as(request(server()).get(`/goals/${goalId}/items`)).expect(200);
    expect(decode(listed.body).items[0]).toMatchObject({ actualAmount: 150, status: 'paid' });

    const removed = await as(request(server()).delete(`/goals/${goalId}/items/${itemId}`)).expect(
      200,
    );
    expect(decode(removed.body).items).toEqual([]);
  });

  it('rejects what the contract does not allow, in the usual 400 shape', async () => {
    const res = await as(request(server()).post(`/goals/${goalId}/items`))
      .send({ name: '', estimatedAmount: -5, dueMonth: '2026-13', status: null, extra: 1 })
      .expect(400);

    expect(res.body.error.code).toBe('REQUEST_INVALID');
    expect(res.body.error.details.issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^name: /),
        expect.stringMatching(/^estimatedAmount: /),
        'dueMonth: dueMonth must be in YYYY-MM format',
        expect.stringMatching(/^status: /),
        expect.stringMatching(/^extra: /),
      ]),
    );
  });
});
