jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction } from '../../src/entities/transaction.entity';
import { SubscriptionDetectionService } from '../../src/modules/subscriptions/subscription-detection.service';
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

    it('hides the merchant on every other way to the row, not only the list', async () => {
      const [{ statement_id: statementId }] = await dataSource.query(
        'SELECT statement_id FROM transactions WHERE id = $1',
        [ids.gift],
      );
      const viaFile = await as(partner, request(server()).get(`/storage/files/${statementId}`)).expect(
        200,
      );
      const viaStatement = await as(partner, request(server()).get(`/statements/${statementId}`)).expect(
        200,
      );
      for (const rows of [viaFile.body.transactions, viaStatement.body.transactions]) {
        const row = rows.find((tx: ListedTransaction) => tx.id === ids.gift);
        expect(row.counterpartyName).toBe('—');
        expect(row.paymentPurpose).toBe('—');
        expect(Number(row.amount)).toBe(70);
      }
      // Still the owner's to read in full.
      const own = await as(owner, request(server()).get(`/storage/files/${statementId}`)).expect(200);
      expect(own.body.transactions.find((tx: ListedTransaction) => tx.id === ids.gift).counterpartyName).toBe(
        'Jewellery shop',
      );
    });

    it('keeps the row out of the partner’s search, which would match it by the hidden merchant', async () => {
      const search = (account: E2eAccount) =>
        as(account, request(server()).get('/search?q=jewellery')).expect(200);

      const theirs = await search(partner);
      // The answer echoes the query, so only the results are looked at.
      expect(JSON.stringify(theirs.body.results)).not.toMatch(/jewellery/i);
      expect(theirs.body.results.map((hit: { id: string }) => hit.id)).not.toContain(ids.gift);

      const own = await search(owner);
      const hit = own.body.results.find((result: { id: string }) => result.id === ids.gift);
      expect(hit?.title).toBe('Jewellery shop');
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

  /**
   * Everything that is not the list itself: the routes that hand a row back,
   * the aggregates keyed by merchant, the exports. None of them may name the
   * owner's private merchant to the partner; the ones that are only ever read
   * by their caller still name it to the owner.
   */
  describe('every other way to the merchant', () => {
    const named = (res: request.Response, pattern = /jewellery/i): boolean =>
      pattern.test(res.text ?? JSON.stringify(res.body ?? null));
    let statementId: string;
    let privateCategoryId: string;
    let refundId: string;

    /** Same request as the owner and as the partner, owner first so a shared cache would show. */
    const both = async (
      send: (account: E2eAccount) => request.Test,
    ): Promise<{ mine: request.Response; theirs: request.Response }> => {
      const mine = await send(owner);
      const theirs = await send(partner);
      expect(mine.status).toBeLessThan(300);
      expect(theirs.status).toBeLessThan(300);
      return { mine, theirs };
    };

    async function makePrivate(id: string): Promise<void> {
      await as(owner, request(server()).put(`/transactions/${id}`))
        .send({ ownerMemberId })
        .expect(200);
      await as(owner, request(server()).put(`/transactions/${id}`))
        .send({ isPrivate: true })
        .expect(200);
    }

    beforeAll(async () => {
      [{ statement_id: statementId, category_id: privateCategoryId }] = await dataSource.query(
        'SELECT statement_id, category_id FROM transactions WHERE id = $1',
        [ids.gift],
      );
      // Money coming back the same week: the transfer and reimbursement pickers start from it.
      refundId = await bookExpense('Refund desk', '15');
      await as(owner, request(server()).put(`/transactions/${refundId}`))
        .send({ debit: 0, credit: 15 })
        .expect(200);
    });

    it('hands the row back redacted from every transaction route', async () => {
      // A second copy of the gift, so the duplicate finder has a group to show.
      const repo = dataSource.getRepository(Transaction);
      const { id: _id, ...gift } = await repo.findOneByOrFail({ id: ids.gift });
      const copy = await repo.save(repo.create({ ...gift, createdAt: undefined }));

      const routes: Array<(account: E2eAccount) => request.Test> = [
        account => as(account, request(server()).get(`/transactions/${ids.gift}/split`)),
        account => as(account, request(server()).put(`/transactions/${ids.gift}`)).send({}),
        account => as(account, request(server()).get('/transactions/duplicates/detect')),
        account =>
          as(account, request(server()).get(`/transactions/${refundId}/transfer-candidates`)),
        account =>
          as(account, request(server()).get(`/transactions/${refundId}/reimbursement-candidates`)),
      ];
      try {
        for (const route of routes) {
          const { mine, theirs } = await both(route);
          expect(theirs.text).toContain(ids.gift);
          expect(named(theirs)).toBe(false);
          expect(named(mine)).toBe(true);
        }
        // The rule preview leaves another member's private row out altogether: even
        // a rule on the amount would otherwise say the row is there and what it cost.
        const preview = await both(account =>
          as(account, request(server()).post('/categorization-rules/test')).send({
            conditions: [{ field: 'amount', operator: 'greater_than', value: -1 }],
            transactionIds: [ids.gift],
          }),
        );
        expect(preview.mine.body.matchedTransactions).toBe(1);
        expect(named(preview.mine)).toBe(true);
        expect(preview.theirs.body.matchedTransactions).toBe(0);
        expect(preview.theirs.text).not.toContain(ids.gift);
        // The rule test cannot be turned into a yes/no question about the merchant either.
        const probe = await as(partner, request(server()).post('/categorization-rules/test'))
          .send({
            conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'Jewel' }],
            transactionIds: [ids.gift],
          })
          .expect(200);
        expect(probe.body.matchedTransactions).toBe(0);
      } finally {
        await repo.delete({ id: copy.id });
      }
    });

    it('keeps the merchant out of the search box, the receipt picker and the documents list', async () => {
      const search = await both(account =>
        as(account, request(server()).get('/search?q=jewel')),
      );
      expect(named(search.theirs)).toBe(false);
      expect(named(search.mine)).toBe(true);

      const [{ id: receiptId }] = await dataSource.query(
        `INSERT INTO receipts
           (user_id, workspace_id, source, subject, sender, received_at, parsed_data, status)
         VALUES ($1, $2, 'scan', 'probe.jpg', 'scan', now(), $3::jsonb, 'draft')
         RETURNING id`,
        [
          owner.userId,
          owner.workspaceId,
          JSON.stringify({ amount: 70, currency: 'EUR', date: '2026-12-14', vendor: 'Shop' }),
        ],
      );
      const matches = await both(account =>
        as(account, request(server()).get(`/receipts/${receiptId}/transaction-matches`)),
      );
      expect(matches.theirs.text).toContain(ids.gift);
      expect(named(matches.theirs)).toBe(false);
      expect(named(matches.mine)).toBe(true);

      const description = (res: request.Response) =>
        res.body.data.find((row: { id: string }) => row.id === statementId)?.transactionSummary
          ?.description;
      const statements = await both(account =>
        as(account, request(server()).get('/statements?limit=100')),
      );
      expect(description(statements.mine)).toBe('Jewellery shop');
      expect(description(statements.theirs) ?? '').not.toMatch(/jewellery/i);
    });

    it('fills a custom table and a statement export without it', async () => {
      // A table is read by the whole workspace, so not even the owner's own fill names it.
      const preview = await as(owner, request(server()).post('/custom-tables/source-preview'))
        .send({ kind: 'transactions', filters: { ids: [ids.gift] } })
        .expect(201);
      expect(preview.body.count).toBe(1);
      expect(named(preview)).toBe(false);

      const csv = await both(account =>
        as(account, request(server()).get(`/storage/files/${statementId}/transactions/export`)),
      );
      expect(named(csv.theirs)).toBe(false);
      expect(named(csv.mine)).toBe(true);
    });

    it('rolls the private money up under a placeholder in the goal flow and the payee list', async () => {
      const goal = await as(owner, request(server()).post('/goals'))
        .send({ name: 'Anniversary', targetAmount: 500 })
        .expect(201);
      await as(owner, request(server()).post('/budgets'))
        .send({
          name: 'Hidden',
          categoryId: privateCategoryId,
          limitAmount: 100,
          periodType: 'monthly',
          goalId: goal.body.id,
        })
        .expect(201);
      const flow = await both(account =>
        as(account, request(server()).get(`/goals/${goal.body.id}/flow?month=2026-12`)),
      );
      expect(named(flow.theirs)).toBe(false);
      expect(named(flow.mine)).toBe(true);
      // Same money either way: only the name went.
      expect(flow.theirs.body.actualTotal).toBe(flow.mine.body.actualTotal);

      const payee = (res: request.Response) =>
        res.body.data.find((row: { name: string }) => /jewellery/i.test(row.name));
      const payees = await both(account =>
        as(account, request(server()).get('/payees?search=Jewel')),
      );
      expect(payee(payees.mine)).toMatchObject({ transactionCount: 1, lastSeen: '2026-12-14' });
      expect(payee(payees.theirs)).toMatchObject({ transactionCount: 0, lastSeen: null });
    });

    it('detects no subscription named after a private merchant', async () => {
      for (const date of ['2026-08-14', '2026-09-14']) {
        const statement = await as(owner, request(server()).post('/statements/manual-expense'))
          .field('amount', '9.99')
          .field('currency', 'EUR')
          .field('merchant', 'Secret Streaming')
          .field('categoryId', giftsCategoryId)
          .field('date', date)
          .expect(201);
        const [{ id }] = await dataSource.query(
          'SELECT id FROM transactions WHERE statement_id = $1',
          [statement.body.id],
        );
        await makePrivate(id);
      }

      await app.get(SubscriptionDetectionService).runDetection(owner.workspaceId);

      const subscriptions = await as(owner, request(server()).get('/subscriptions')).expect(200);
      expect(named(subscriptions, /secret streaming/i)).toBe(false);
    });

    it('keeps it off the dashboard, the reports and the exports', async () => {
      const month = { dateFrom: '2026-12-01', dateTo: '2026-12-31' };
      // Each names expense merchants to the owner; the daily report and the
      // cash-flow map only name income and categories, so they just must not leak.
      const quiet: Array<(account: E2eAccount) => request.Test> = [
        account => as(account, request(server()).get('/reports/daily?date=2026-12-14')),
        account =>
          as(account, request(server()).get('/reports/cash-flow-map?dateFrom=2026-12-01&dateTo=2026-12-31')),
      ];
      for (const route of quiet) {
        expect(named((await both(route)).theirs)).toBe(false);
      }
      const owned: Array<(account: E2eAccount) => request.Test> = [
        account => as(account, request(server()).get('/dashboard?range=month&date=2026-12-14')),
        account => as(account, request(server()).get('/reports/monthly?year=2026&month=12')),
        account =>
          as(account, request(server()).post('/reports/custom')).send({
            ...month,
            groupBy: 'counterparty',
          }),
        account => as(account, request(server()).get('/reports/statements/summary?days=3650')),
        account =>
          as(account, request(server()).get('/reports/spend-flow?dateFrom=2026-12-01&dateTo=2026-12-31')),
        account =>
          as(account, request(server()).post('/reports/workspace-export')).send({ format: 'csv' }),
      ];
      for (const route of owned) {
        const { mine, theirs } = await both(route);
        expect(named(theirs)).toBe(false);
        expect(named(mine)).toBe(true);
      }

      // A filter cannot ask about it either: the keyword finds nothing for the partner.
      const keyword = await both(account =>
        as(
          account,
          request(server()).get(
            '/reports/top-categories?dateFrom=2026-12-01&dateTo=2026-12-31&keywords=jewel',
          ),
        ),
      );
      expect(keyword.mine.body.categories.length).toBeGreaterThan(0);
      expect(keyword.theirs.body.categories).toEqual([]);

      // A generated report stays in the workspace's history: nobody's private details in it.
      const register = await both(account =>
        as(account, request(server()).post('/reports/preview')).send({
          templateId: 'transaction-register',
          ...month,
          format: 'csv',
        }),
      );
      expect(register.mine.text).toContain('70');
      expect(named(register.mine)).toBe(false);
      expect(named(register.theirs)).toBe(false);
    });

    it('counts only what the partner may see in the DATEV mapping', async () => {
      const privateCount = (res: request.Response) =>
        res.body.categories.find((row: { categoryId: string }) => row.categoryId === privateCategoryId)
          ?.transactionCount ?? 0;
      const mapping = await both(account =>
        as(account, request(server()).get('/tax/datev/mapping?year=2026')),
      );
      expect(privateCount(mapping.mine)).toBeGreaterThan(0);
      expect(privateCount(mapping.theirs)).toBe(0);
    });

    it('keeps the notes on a private row between the owner and the row', async () => {
      await as(owner, request(server()).post('/notes'))
        .send({ entityType: 'transaction', entityId: ids.gift, body: 'Necklace, anniversary' })
        .expect(201);
      const own = await as(
        owner,
        request(server()).get(`/notes?entityType=transaction&entityId=${ids.gift}`),
      ).expect(200);
      expect(own.body.items).toHaveLength(1);

      await as(
        partner,
        request(server()).get(`/notes?entityType=transaction&entityId=${ids.gift}`),
      ).expect(404);
      await as(partner, request(server()).post('/notes'))
        .send({ entityType: 'transaction', entityId: ids.gift, body: 'what was it?' })
        .expect(404);
    });

    it('files the tax of a private row on the VAT return without its counterparty', async () => {
      await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
        .send({ currency: 'EUR' })
        .expect(200);
      await as(owner, request(server()).put('/tax/settings/jurisdiction'))
        .send({ code: 'DE', effectiveFrom: '2025-01-01' })
        .expect(200);
      const statement = await as(owner, request(server()).post('/statements/manual-expense'))
        .field('amount', '119')
        .field('currency', 'EUR')
        .field('merchant', 'Secret Pharmacy')
        .field('categoryId', giftsCategoryId)
        .field('date', '2026-03-10')
        .expect(201);
      const [{ id }] = await dataSource.query(
        'SELECT id FROM transactions WHERE statement_id = $1',
        [statement.body.id],
      );
      await makePrivate(id);

      const returns = await both(account =>
        as(
          account,
          request(server()).get('/tax/returns/preview?periodStart=2026-03-01&periodEnd=2026-03-31'),
        ),
      );
      for (const res of [returns.mine, returns.theirs]) {
        expect(res.body.lines.map((line: { transactionId: string }) => line.transactionId)).toContain(
          id,
        );
        expect(named(res, /pharmacy/i)).toBe(false);
      }
      expect(returns.theirs.body.inputTax).toBe(returns.mine.body.inputTax);
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
