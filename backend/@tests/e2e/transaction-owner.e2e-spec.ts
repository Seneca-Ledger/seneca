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

interface ListedTransaction {
  id: string;
  ownerMemberId: string | null;
  counterpartyName: string;
}

/**
 * Who in the household a transaction belongs to: setting it, filtering by it,
 * and the tenant boundary around it.
 *
 * Shared is NULL rather than a value, so "our spending" is a real filter and not
 * the absence of one — that distinction is what the whole feature rests on.
 */
describe('Transaction ownership (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `own-owner-${stamp}@example.com`,
    partner: `own-partner-${stamp}@example.com`,
    outsider: `own-outsider-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let outsider: E2eAccount;
  let ownerMemberId: string;
  let partnerMemberId: string;
  let outsiderMemberId: string;
  const transactions: Record<string, string> = {};

  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const server = () => app.getHttpServer();
  const inWorkspace = (req: request.Test) => as(owner, req, owner.workspaceId);

  async function bookExpense(categoryId: string, merchant: string): Promise<string> {
    const statement = await inWorkspace(request(server()).post('/statements/manual-expense'))
      .field('amount', '100')
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', '2026-03-10')
      .expect(201);

    const listed = await inWorkspace(
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    return listed.body.data[0].id;
  }

  async function membershipId(workspaceId: string, userId: string): Promise<string> {
    const [row] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId],
    );
    return row.id;
  }

  const ownerOf = (body: { data: ListedTransaction[] }, merchant: string) =>
    body.data.find(tx => tx.counterpartyName === merchant)?.ownerMemberId;

  const merchants = (body: { data: ListedTransaction[] }) =>
    body.data.map(tx => tx.counterpartyName).sort();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Household Owner');
    partner = await registerAccount(app, emails.partner, 'Household Partner');
    outsider = await registerAccount(app, emails.outsider, 'Outsider');

    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: partner.email, role: 'member', permissions: { canEditStatements: true } })
      .expect(201);
    await as(
      partner,
      request(server()).post(`/workspaces/invitations/${invite.body.invitation.token}/accept`),
    ).expect(200);

    ownerMemberId = await membershipId(owner.workspaceId, owner.userId);
    partnerMemberId = await membershipId(owner.workspaceId, partner.userId);
    outsiderMemberId = await membershipId(outsider.workspaceId, outsider.userId);

    const categories = await inWorkspace(request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const categoryId: string = categories.body[0].id;

    transactions.mine = await bookExpense(categoryId, 'Mine');
    transactions.theirs = await bookExpense(categoryId, 'Theirs');
    transactions.ours = await bookExpense(categoryId, 'Ours');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  describe('setting an owner', () => {
    it('starts every row shared', async () => {
      const res = await inWorkspace(request(server()).get('/transactions')).expect(200);
      expect(res.body.data.map((tx: ListedTransaction) => tx.ownerMemberId)).toEqual([
        null,
        null,
        null,
      ]);
    });

    it('assigns one row to each person and leaves the third shared', async () => {
      await inWorkspace(request(server()).put(`/transactions/${transactions.mine}`))
        .send({ ownerMemberId })
        .expect(200);
      await inWorkspace(request(server()).put(`/transactions/${transactions.theirs}`))
        .send({ ownerMemberId: partnerMemberId })
        .expect(200);

      const res = await inWorkspace(request(server()).get('/transactions')).expect(200);
      expect(ownerOf(res.body, 'Mine')).toBe(ownerMemberId);
      expect(ownerOf(res.body, 'Theirs')).toBe(partnerMemberId);
      expect(ownerOf(res.body, 'Ours')).toBeNull();
    });

    it('hands a row back to the household with null', async () => {
      await inWorkspace(request(server()).put(`/transactions/${transactions.mine}`))
        .send({ ownerMemberId: null })
        .expect(200);
      const res = await inWorkspace(request(server()).get('/transactions')).expect(200);
      expect(ownerOf(res.body, 'Mine')).toBeNull();

      await inWorkspace(request(server()).put(`/transactions/${transactions.mine}`))
        .send({ ownerMemberId })
        .expect(200);
    });

    it('refuses a membership that belongs to another workspace', () => {
      return inWorkspace(request(server()).put(`/transactions/${transactions.ours}`))
        .send({ ownerMemberId: outsiderMemberId })
        .expect(400);
    });
  });

  describe('filtering by owner', () => {
    it('shows the whole workspace when no owner is asked for', async () => {
      const res = await inWorkspace(request(server()).get('/transactions')).expect(200);
      expect(merchants(res.body)).toEqual(['Mine', 'Ours', 'Theirs']);
    });

    it('resolves "me" to the caller, so each person sees their own', async () => {
      const mine = await inWorkspace(request(server()).get('/transactions?owner=me')).expect(200);
      expect(merchants(mine.body)).toEqual(['Mine']);

      const theirs = await as(
        partner,
        request(server()).get('/transactions?owner=me'),
        owner.workspaceId,
      ).expect(200);
      expect(merchants(theirs.body)).toEqual(['Theirs']);
    });

    it('treats "shared" as the rows nobody claimed, not as "everything"', async () => {
      const res = await inWorkspace(request(server()).get('/transactions?owner=shared')).expect(200);
      expect(merchants(res.body)).toEqual(['Ours']);
    });

    it('takes a membership id directly', async () => {
      const res = await inWorkspace(
        request(server()).get(`/transactions?owner=${partnerMemberId}`),
      ).expect(200);
      expect(merchants(res.body)).toEqual(['Theirs']);
    });

    it('carries the same filter into the reports', async () => {
      const all = await inWorkspace(
        request(server()).get('/reports/top-categories?dateFrom=2026-01-01&dateTo=2026-12-31'),
      ).expect(200);
      const shared = await inWorkspace(
        request(server()).get(
          '/reports/top-categories?dateFrom=2026-01-01&dateTo=2026-12-31&owner=shared',
        ),
      ).expect(200);

      const total = (body: { categories: Array<{ amount: number }> }) =>
        body.categories.reduce((sum, row) => sum + Number(row.amount), 0);
      expect(total(all.body)).toBe(300);
      expect(total(shared.body)).toBe(100);
    });
  });

  describe('bulk assignment', () => {
    it('moves several rows to one person in a single call', async () => {
      await inWorkspace(request(server()).post('/transactions/bulk-update'))
        .send({
          ids: [transactions.mine, transactions.ours],
          updates: { ownerMemberId: partnerMemberId },
        })
        .expect(200);

      const res = await inWorkspace(
        request(server()).get(`/transactions?owner=${partnerMemberId}`),
      ).expect(200);
      expect(merchants(res.body)).toEqual(['Mine', 'Ours', 'Theirs']);
    });
  });
});
