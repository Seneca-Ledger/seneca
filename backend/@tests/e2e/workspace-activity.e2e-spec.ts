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

interface ActivityEntry {
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
}

/**
 * The household's own feed of who did what — YNAB calls it Recent Moves.
 *
 * Two things have to hold at once: a plain member can see it (otherwise nobody
 * but the owner ever learns the partner recategorised something), and it stays
 * clear of the full audit, which carries sign-ins, keys, member changes and the
 * before/after of every edit.
 */
describe('Workspace activity (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `act-owner-${stamp}@example.com`,
    partner: `act-partner-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let transactionId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  const activityFor = async (account: E2eAccount): Promise<ActivityEntry[]> => {
    const res = await as(account, request(server()).get('/audit-events/activity')).expect(200);
    return res.body.items;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Activity Owner');
    partner = await registerAccount(app, emails.partner, 'Activity Partner');

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

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '70')
      .field('currency', 'EUR')
      .field('merchant', 'Jewellery shop')
      .field('categoryId', categories.body[0].id)
      .field('date', '2026-12-14')
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    transactionId = listed.body.data[0].id;

    // The partner edits it: this is the move the other person should see.
    await as(partner, request(server()).put(`/transactions/${transactionId}`))
      .send({ paymentPurpose: 'Anniversary' })
      .expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('lets a plain member read the feed', async () => {
    const items = await activityFor(partner);
    expect(items.length).toBeGreaterThan(0);
  });

  it('names who made the move', async () => {
    const items = await activityFor(owner);
    const edit = items.find(
      item => item.entityId === transactionId && item.action === 'update',
    );
    expect(edit?.actorName).toBe('Activity Partner');
  });

  it('still refuses the full audit to a member', () => {
    return as(partner, request(server()).get('/audit-events')).expect(403);
  });

  it('carries nothing of what the row was', async () => {
    // A diff would hold the merchant and the amount, and a private row is
    // private from the rest of the household.
    const items = await activityFor(partner);
    expect(JSON.stringify(items)).not.toContain('Jewellery shop');
    expect(JSON.stringify(items)).not.toContain('Anniversary');
  });

  it('keeps security and administration out of it', async () => {
    // Inviting the partner wrote a workspace_member event; it belongs to the
    // owner's audit, not to the household's feed.
    const items = await activityFor(owner);
    expect(items.map(item => item.entityType)).not.toContain('workspace_member');

    const full = await as(
      owner,
      request(server()).get('/audit-events?entityType=workspace_member'),
    ).expect(200);
    expect(full.body.total).toBeGreaterThan(0);
  });

  it('shows the newest first and honours a limit', async () => {
    const res = await as(
      owner,
      request(server()).get('/audit-events/activity?limit=1'),
    ).expect(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('shows nothing from another workspace', async () => {
    const res = await request(server())
      .get('/audit-events/activity')
      .set('Authorization', `Bearer ${partner.token}`)
      .set('x-workspace-id', partner.workspaceId)
      .expect(200);
    expect(res.body.items.map((item: ActivityEntry) => item.entityId)).not.toContain(
      transactionId,
    );
  });
});
