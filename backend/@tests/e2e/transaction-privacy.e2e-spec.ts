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
  counterpartyName: string;
  paymentPurpose: string;
  amount: number;
  isPrivate: boolean;
  categoryId: string | null;
  privateCategoryId: string | null;
}

/**
 * A private transaction hides what it was, never that it happened.
 *
 * The invariant the whole feature rests on: what a person is shown must add up
 * to what they can see. If a total counted a row that its list refused to show,
 * the difference between the two would be the hidden amount — privacy anyone
 * could undo with a subtraction. So the money stays visible to the household
 * and only the merchant, the purpose and the category go away.
 */
describe('Private transactions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `priv-owner-${stamp}@example.com`,
    partner: `priv-partner-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let ownerMemberId: string;
  let partnerMemberId: string;
  let giftsCategoryId: string;
  const ids: Record<string, string> = {};

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  async function bookExpense(merchant: string, amount: string): Promise<string> {
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', giftsCategoryId)
      .field('date', '2026-12-14')
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    return listed.body.data[0].id;
  }

  async function membershipId(userId: string): Promise<string> {
    const [row] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, userId],
    );
    return row.id;
  }

  const listFor = async (account: E2eAccount): Promise<ListedTransaction[]> => {
    const res = await as(account, request(server()).get('/transactions')).expect(200);
    return res.body.data;
  };

  const categoryTotals = async (
    account: E2eAccount,
  ): Promise<Array<{ name: string; amount: number }>> => {
    const res = await as(
      account,
      request(server()).get('/reports/top-categories?dateFrom=2026-01-01&dateTo=2026-12-31'),
    ).expect(200);
    return res.body.categories
      .map((row: { name: string; amount: number }) => ({
        name: row.name,
        amount: Number(row.amount),
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Privacy Owner');
    partner = await registerAccount(app, emails.partner, 'Privacy Partner');

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
    giftsCategoryId = categories.body[0].id;

    ids.gift = await bookExpense('Jewellery shop', '70');
    ids.shared = await bookExpense('Bakery', '30');

    await as(owner, request(server()).put(`/transactions/${ids.gift}`))
      .send({ ownerMemberId })
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

  describe('making a row private', () => {
    it('refuses a row that belongs to the household', () => {
      // Nobody to keep a secret from.
      return as(owner, request(server()).put(`/transactions/${ids.shared}`))
        .send({ isPrivate: true })
        .expect(400);
    });

    it('refuses a row that belongs to someone else', async () => {
      await as(owner, request(server()).put(`/transactions/${ids.shared}`))
        .send({ ownerMemberId: partnerMemberId })
        .expect(200);

      await as(owner, request(server()).put(`/transactions/${ids.shared}`))
        .send({ isPrivate: true })
        .expect(400);

      await as(owner, request(server()).put(`/transactions/${ids.shared}`))
        .send({ ownerMemberId: null })
        .expect(200);
    });

    it('moves the row into the workspace’s Private category', async () => {
      await as(owner, request(server()).put(`/transactions/${ids.gift}`))
        .send({ isPrivate: true })
        .expect(200);

      const mine = (await listFor(owner)).find(tx => tx.id === ids.gift);
      expect(mine?.isPrivate).toBe(true);
      expect(mine?.categoryId).not.toBe(giftsCategoryId);
      // The owner keeps the category it really belongs to.
      expect(mine?.privateCategoryId).toBe(giftsCategoryId);
    });
  });

  describe('what each person sees', () => {
    it('shows the owner their own row in full', async () => {
      const mine = (await listFor(owner)).find(tx => tx.id === ids.gift);
      expect(mine?.counterpartyName).toBe('Jewellery shop');
    });

    it('hides the merchant, the purpose and the real category from the partner', async () => {
      const theirs = (await listFor(partner)).find(tx => tx.id === ids.gift);
      expect(theirs?.counterpartyName).toBe('—');
      expect(theirs?.paymentPurpose).toBe('—');
      expect(theirs?.privateCategoryId).toBeNull();
    });

    it('keeps the row, its date and its amount in the partner’s list', async () => {
      const theirs = (await listFor(partner)).find(tx => tx.id === ids.gift);
      expect(theirs).toBeDefined();
      expect(Number(theirs?.amount)).toBe(70);
    });
  });

  describe('the totals still add up', () => {
    it('counts the same money for both people', async () => {
      const [mine, theirs] = await Promise.all([categoryTotals(owner), categoryTotals(partner)]);
      const sum = (rows: Array<{ amount: number }>) =>
        rows.reduce((total, row) => total + row.amount, 0);

      expect(sum(mine)).toBe(100);
      expect(sum(theirs)).toBe(sum(mine));
    });

    it('files the hidden money under Private for everyone, so no category has a gap', async () => {
      // This is the subtraction that must not work: if the gift still counted
      // towards Gifts for one of them, that category would differ between the
      // two views by exactly 70.
      const [mine, theirs] = await Promise.all([categoryTotals(owner), categoryTotals(partner)]);
      expect(theirs).toEqual(mine);

      const privateBucket = theirs.find(row => row.name === 'Private');
      expect(privateBucket?.amount).toBe(70);
    });

    it('shows the partner a total that matches the rows they can see', async () => {
      const rows = await listFor(partner);
      const visible = rows.reduce((total, row) => total + Math.abs(Number(row.amount)), 0);
      const reported = (await categoryTotals(partner)).reduce(
        (total, row) => total + row.amount,
        0,
      );

      expect(visible).toBe(reported);
    });
  });

  describe('turning privacy off', () => {
    it('gives the row its own category back', async () => {
      await as(owner, request(server()).put(`/transactions/${ids.gift}`))
        .send({ isPrivate: false })
        .expect(200);

      const mine = (await listFor(owner)).find(tx => tx.id === ids.gift);
      expect(mine?.isPrivate).toBe(false);
      expect(mine?.categoryId).toBe(giftsCategoryId);
      expect(mine?.privateCategoryId).toBeNull();

      const theirs = (await listFor(partner)).find(tx => tx.id === ids.gift);
      expect(theirs?.counterpartyName).toBe('Jewellery shop');
    });
  });
});
