jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Whose backlog the review queue shows.
 *
 * `reviewer=me` means mine plus everything nobody claimed, not strictly mine:
 * shared is the state every row starts in, so a strictly-mine queue would hide
 * the household's own backlog from both people.
 *
 * The counts matter as much as the list. A badge that counts someone else's
 * rows sends you to a queue that then refuses to show them — the complaint
 * Monarch users have about its "review some transactions" banner.
 */
describe('Review inbox reviewer (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `rev-owner-${stamp}@example.com`,
    partner: `rev-partner-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let ownerMemberId: string;
  let partnerMemberId: string;
  const ids: Record<string, string> = {};

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const transactions = () => dataSource.getRepository(Transaction);

  async function bookUndecided(merchant: string, categoryId: string): Promise<string> {
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '30')
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', '2026-06-01')
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    const id: string = listed.body.data[0].id;
    // Manual entries are born verified; these stand in for imported rows.
    await transactions().update(id, { isVerified: false });
    return id;
  }

  async function membershipId(userId: string): Promise<string> {
    const [row] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, userId],
    );
    return row.id;
  }

  const merchantsOf = (body: { items: Array<{ counterpartyName: string }> }) =>
    body.items.map(item => item.counterpartyName).sort();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Review Owner');
    partner = await registerAccount(app, emails.partner, 'Review Partner');

    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: partner.email, role: 'member', permissions: { canEditStatements: true } })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${partner.token}`)
      .expect(200);

    ownerMemberId = await membershipId(owner.userId);
    partnerMemberId = await membershipId(partner.userId);

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const categoryId: string = categories.body[0].id;

    ids.mine = await bookUndecided('Mine', categoryId);
    ids.theirs = await bookUndecided('Theirs', categoryId);
    ids.ours = await bookUndecided('Ours', categoryId);

    await transactions().update(ids.mine, { ownerMemberId });
    await transactions().update(ids.theirs, { ownerMemberId: partnerMemberId });
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('shows the whole household backlog when no reviewer is asked for', async () => {
    const res = await as(owner, request(server()).get('/review-inbox')).expect(200);
    expect(merchantsOf(res.body)).toEqual(['Mine', 'Ours', 'Theirs']);
    expect(res.body.counts.transaction).toBe(3);
  });

  it('keeps the partner’s rows out of my queue, and the shared ones in', async () => {
    const res = await as(owner, request(server()).get('/review-inbox?reviewer=me')).expect(200);
    expect(merchantsOf(res.body)).toEqual(['Mine', 'Ours']);
  });

  it('gives each person a different queue from the same data', async () => {
    const theirs = await as(
      partner,
      request(server()).get('/review-inbox?reviewer=me'),
    ).expect(200);
    expect(merchantsOf(theirs.body)).toEqual(['Ours', 'Theirs']);
  });

  it('counts what the queue will actually show', async () => {
    const res = await as(owner, request(server()).get('/review-inbox?reviewer=me')).expect(200);
    expect(res.body.counts.transaction).toBe(2);

    const counts = await as(
      owner,
      request(server()).get('/review-inbox/counts?reviewer=me'),
    ).expect(200);
    expect(counts.body).toMatchObject({ transaction: 2, total: 2 });
  });

  it('reports an empty queue when everything left is someone else’s', async () => {
    // The badge must go quiet here. Counting the partner's rows would send me
    // to a queue that shows nothing.
    await transactions().update([ids.mine, ids.ours], { isVerified: true });

    const counts = await as(
      owner,
      request(server()).get('/review-inbox/counts?reviewer=me'),
    ).expect(200);
    expect(counts.body).toMatchObject({ transaction: 0, total: 0 });

    const everyone = await as(owner, request(server()).get('/review-inbox/counts')).expect(200);
    expect(everyone.body.transaction).toBe(1);
  });

  it('rejects a reviewer value it does not know', () => {
    return as(owner, request(server()).get('/review-inbox?reviewer=somebody')).expect(400);
  });
});
