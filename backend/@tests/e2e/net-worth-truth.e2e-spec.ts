vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction, TransactionType, TransferPairKind } from '../../src/entities/transaction.entity';
import { Wallet } from '../../src/entities/wallet.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * What the net worth chart must get right before anything is built on it: a
 * point for every day, extremes that survive the thinning, a transfer that
 * does not punch a hole in the line, and a history that can be corrected.
 */
describe('Net worth truth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `net-worth-owner-${stamp}@example.com` };
  let owner: E2eAccount;
  let fixedAssetsId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };

  async function seedWallet(name: string, initialBalance: number): Promise<Wallet> {
    return dataSource.getRepository(Wallet).save(
      dataSource.getRepository(Wallet).create({
        userId: owner.userId,
        workspaceId: owner.workspaceId,
        name,
        currency: 'KZT',
        initialBalance,
        isActive: true,
      }),
    );
  }

  async function seedLeg(input: {
    walletId: string;
    date: string;
    debit?: number;
    credit?: number;
    pairId: string;
    kind: TransferPairKind;
  }): Promise<void> {
    const repository = dataSource.getRepository(Transaction);
    await repository.save(
      repository.create({
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        walletId: input.walletId,
        transactionDate: new Date(input.date),
        paymentPurpose: 'Between my own accounts',
        counterpartyName: 'Own account',
        currency: 'KZT',
        debit: input.debit ?? null,
        credit: input.credit ?? null,
        amount: input.debit ?? input.credit ?? 0,
        transactionType: input.debit ? TransactionType.EXPENSE : TransactionType.INCOME,
        transferPairId: input.pairId,
        transferPairKind: input.kind,
        // Confirmed, or the cash walk leaves the leg out and there is nothing to align.
        isVerified: true,
      }),
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Net Worth Owner');
    // A new workspace no longer defaults to tenge; every figure here is in it.
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'KZT' })
      .expect(200);

    // The accounts are seeded on the first read of the sheet.
    const accounts = await as(owner, request(server()).get('/reports/balance/accounts')).expect(200);
    fixedAssetsId = findAccountId(accounts.body, 'ASSET_FIXED');
    expect(fixedAssetsId).toBeTruthy();
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, emails.owner);
    }
    await app.close();
  });

  it('has a point for every day of the window, from its first to today', async () => {
    const res = await as(owner, request(server()).get('/reports/net-worth?range=30d')).expect(200);

    expect(res.body.series[0].date).toBe(daysAgo(30));
    expect(res.body.series[res.body.series.length - 1].date).toBe(daysAgo(0));
    expect(res.body.series).toHaveLength(31);
  });

  it('keeps a one-day crash visible on the five-year chart', async () => {
    const put = (date: string, amount: number) =>
      as(owner, request(server()).put('/reports/balance/snapshot'))
        .send({ accountId: fixedAssetsId, amount, currency: 'KZT', date })
        .expect(200);

    await put(daysAgo(1800), 1000);
    await put(daysAgo(901), 300);
    await put(daysAgo(900), 1000);

    const res = await as(owner, request(server()).get('/reports/net-worth?range=all')).expect(200);
    const values = res.body.series.map((point: { value: number }) => point.value);

    expect(Math.min(...values)).toBe(300);
    expect(res.body.series.length).toBeLessThanOrEqual(200);
    expect(res.body.allTimeHigh).toEqual({ value: 1000, date: expect.any(String) });
  });

  it('does not dip when a transfer lands a day after it left', async () => {
    const from = await seedWallet('Everyday', 1000);
    const to = await seedWallet('Savings', 0);
    const pairId = randomUUID();
    await seedLeg({
      walletId: from.id,
      date: daysAgo(10),
      debit: 300,
      pairId,
      kind: TransferPairKind.TRANSFER,
    });
    await seedLeg({
      walletId: to.id,
      date: daysAgo(9),
      credit: 300,
      pairId,
      kind: TransferPairKind.TRANSFER,
    });

    const res = await as(owner, request(server()).get('/reports/net-worth?range=30d')).expect(200);
    const window = res.body.series.filter(
      (point: { date: string }) => point.date >= daysAgo(11) && point.date <= daysAgo(8),
    );

    const values = window.map((point: { value: number }) => point.value);
    // Four days around the transfer, and the line does not move on any of them:
    // the money never left the household, only one account.
    expect(values).toHaveLength(4);
    expect(new Set(values).size).toBe(1);
  });

  it('shows the history of a line, imports one and takes a wrong day back out', async () => {
    const csv = ['Date,Amount', `${daysAgo(400)},5000`, `${daysAgo(399)},0`].join('\n');

    const imported = await as(
      owner,
      request(server()).post(`/reports/balance/accounts/${fixedAssetsId}/history`),
    )
      .attach('file', Buffer.from(csv, 'utf8'), 'history.csv')
      .expect(201);
    expect(imported.body.imported).toBe(2);

    const valueOn = (body: { series: Array<{ date: string; value: number }> }, date: string) =>
      body.series.filter(point => point.date <= date).pop()?.value ?? 0;

    // The zero of the next day took the line straight back down.
    const withBadDay = await as(
      owner,
      request(server()).get('/reports/net-worth?range=all'),
    ).expect(200);
    expect(valueOn(withBadDay.body, daysAgo(400))).toBeGreaterThanOrEqual(5000);
    expect(valueOn(withBadDay.body, daysAgo(398))).toBeLessThan(5000);

    await as(
      owner,
      request(server()).delete(
        `/reports/balance/accounts/${fixedAssetsId}/history/${daysAgo(399)}`,
      ),
    ).expect(200);

    const history = await as(
      owner,
      request(server()).get(`/reports/balance/accounts/${fixedAssetsId}/history`),
    ).expect(200);
    expect(history.body.map((point: { date: string }) => point.date)).not.toContain(daysAgo(399));

    // The zero is gone, so the line no longer falls off a cliff the day after.
    const after = await as(owner, request(server()).get('/reports/net-worth?range=all')).expect(200);
    expect(valueOn(after.body, daysAgo(398))).toBeGreaterThanOrEqual(5000);
  });

  it('lays a household workspace out in its own words, keeping what it holds', async () => {
    const home = await as(owner, request(server()).post('/workspaces'))
      .send({ name: `Household ${stamp}`, profile: 'home' })
      .expect(201);
    const homeWorkspaceId = home.body.id ?? home.body.data?.id;
    const asHome = (req: request.Test) =>
      req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', homeWorkspaceId);

    // A new household workspace is already in its own words.
    const sheet = await asHome(request(server()).get('/reports/balance/sheet')).expect(200);
    const codes = sheet.body.assets.sections.map((section: { code: string }) => section.code);
    expect(codes).toEqual(
      expect.arrayContaining(['ASSET_CASH', 'ASSET_REAL_ESTATE', 'ASSET_VEHICLES']),
    );
    expect(codes).not.toContain('ASSET_NON_CURRENT');
    expect(sheet.body.personalLayoutAvailable).toBe(false);
  });

  it('offers the household layout to a workspace still filed as a company, and moves it', async () => {
    // Seeded as a business, then turned into a household: the sheet is still
    // the accounting one, and that is exactly the case the switch is for.
    const created = await as(owner, request(server()).post('/workspaces'))
      .send({ name: `Was business ${stamp}` })
      .expect(201);
    const workspaceId = created.body.id ?? created.body.data?.id;
    const asIt = (req: request.Test) =>
      req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', workspaceId);
    await as(owner, request(server()).patch(`/workspaces/${workspaceId}`))
      .send({ currency: 'KZT' })
      .expect(200);

    const before = await asIt(request(server()).get('/reports/balance/sheet')).expect(200);
    const fixed = findAccountId(before.body, 'ASSET_FIXED');
    await asIt(request(server()).put('/reports/balance/snapshot'))
      .send({ accountId: fixed, amount: 7500, currency: 'KZT', date: daysAgo(5) })
      .expect(200);

    await as(owner, request(server()).patch(`/workspaces/${workspaceId}`))
      .send({ profile: 'home' })
      .expect(200);
    const offered = await asIt(request(server()).get('/reports/balance/sheet')).expect(200);
    expect(offered.body.personalLayoutAvailable).toBe(true);

    await asIt(request(server()).post('/reports/balance/personal-layout')).expect(201);

    const after = await asIt(request(server()).get('/reports/balance/sheet')).expect(200);
    const sections = after.body.assets.sections.map((section: { code: string }) => section.code);
    expect(sections).not.toContain('ASSET_NON_CURRENT');
    expect(sections).toContain('ASSET_OTHER');
    expect(after.body.personalLayoutAvailable).toBe(false);
    // The 7 500 did not go anywhere, it just sits under a readable heading now.
    expect(after.body.assets.total).toBe(7500);
    const history = await asIt(
      request(server()).get(`/reports/balance/accounts/${fixed}/history`),
    ).expect(200);
    expect(history.body).toEqual([{ date: daysAgo(5), amount: 7500, currency: 'KZT' }]);

    // And running it again changes nothing.
    const again = await asIt(request(server()).post('/reports/balance/personal-layout')).expect(201);
    expect(again.body.moved).toBe(0);
  });

  it('adds the attribution up to the change, against a real database', async () => {
    const res = await as(owner, request(server()).get('/reports/net-worth?range=all')).expect(200);

    const sum = (rows: Array<{ amount: number }>) =>
      Math.round(rows.reduce((total, row) => total + row.amount, 0) * 100) / 100;

    expect(sum(res.body.attribution.byAccount)).toBe(res.body.change);
    expect(sum(res.body.attribution.byKind)).toBe(res.body.change);
    // Nothing was booked as income in this workspace, so there is no rate.
    expect(res.body.savings).toEqual({ income: 0, kept: expect.any(Number), rate: null });
  });

  it('repeating the delete of a day that holds nothing is not an error', async () => {
    const res = await as(
      owner,
      request(server()).delete(
        `/reports/balance/accounts/${fixedAssetsId}/history/${daysAgo(399)}`,
      ),
    ).expect(200);

    expect(res.body).toEqual({ deleted: false });
  });
});

type AccountNode = { id: string; code: string; children?: AccountNode[] };

function findAccountId(nodes: unknown, code: string): string {
  const walk = (list: AccountNode[]): string | null => {
    for (const node of list) {
      if (node.code === code) return node.id;
      const found = node.children ? walk(node.children) : null;
      if (found) return found;
    }
    return null;
  };
  // `/accounts` answers with the sections directly, `/sheet` wraps them.
  const payload = nodes as { assets?: AccountNode[] | { sections?: AccountNode[] } };
  const assets = payload.assets;
  const list = Array.isArray(assets) ? assets : (assets?.sections ?? []);
  return walk(list) ?? '';
}
