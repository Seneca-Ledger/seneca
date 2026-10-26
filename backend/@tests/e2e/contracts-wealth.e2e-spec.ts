vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  BudgetItem,
  CryptoGainsByOwner,
  CryptoRemoved,
  CryptoSyncResult,
  CryptoWallet,
  CryptoWalletList,
  ExchangeImportResult,
  GoalCoverPresets,
  GoalCoverSearchPage,
  GoalDetail,
  GoalItemsResponse,
  GoalWithProgress,
  InvestmentAccount,
  InvestmentContribution,
  InvestmentHolding,
  MessageResult,
  MetalLot,
  MetalSaleResult,
  MetalSettings,
  PriceRefreshResult,
  SinkingFundList,
  SinkingFundResult,
  SubscriptionItem,
  SubscriptionRecord,
  UpcomingSubscriptionList,
} from '../../src/contracts';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '../../src/entities/subscription.entity';
import { CryptoSyncService } from '../../src/modules/crypto/crypto-sync.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * The answers of the goals, budgets, subscriptions, investments, metals and
 * crypto writes (and the reads the main contracts suite leaves out), checked
 * against their contracts with data in them.
 */
describe('API contracts: wealth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `contracts-wealth-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let categoryId: string;
  let expenseId: string;
  const today = new Date().toISOString().slice(0, 10);

  const call = (method: Method, url: string, status: number, body?: object) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId);
    return (body ? req.send(body) : req).expect(status);
  };
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, email, 'Member One');
    // Prices and costs in the workspace currency: nothing is fetched or converted.
    await call('patch', `/workspaces/${owner.workspaceId}`, 200, { currency: 'USD' });
    categoryId = (await call('get', '/categories?type=expense', 200)).body[0].id;
    const statement = await request(app.getHttpServer())
      .post('/statements/manual-expense')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .field('amount', '500')
      .field('currency', 'USD')
      .field('merchant', 'ACME Broker - Top-up')
      .field('categoryId', categoryId)
      .field('date', today)
      .expect(201);
    const rows = await call('get', `/transactions?statementId=${statement.body.id}`, 200);
    expenseId = rows.body.data[0].id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('budgets: create, read, update and delete', async () => {
    const created = await call('post', '/budgets', 201, {
      name: 'Groceries',
      categoryId,
      limitAmount: 250.5,
      periodType: 'monthly',
      currency: 'USD',
    });
    matches(BudgetItem, created.body);
    expect(created.body.limitAmount).toBe('250.50');
    const id = created.body.id;
    matches(BudgetItem, (await call('get', `/budgets/${id}`, 200)).body);
    const updated = await call('put', `/budgets/${id}`, 200, { limitAmount: 300 });
    matches(BudgetItem, updated.body);
    expect(updated.body.limitAmount).toBe('300.00');
    matches(MessageResult, (await call('delete', `/budgets/${id}`, 200)).body);
  });

  it('goals: covers, items, the goal itself and a contribution', async () => {
    const presets = await call('get', '/goals/covers/presets', 200);
    matches(GoalCoverPresets, presets.body);
    expect(presets.body.presets.length).toBeGreaterThan(0);

    const openverse = {
      page_count: 2,
      results: [
        {
          id: 'cover-1',
          title: 'Lake at dawn',
          creator: 'Member One',
          license: 'by',
          license_url: 'https://creativecommons.org/licenses/by/4.0/',
          attribution: '"Lake at dawn" by Member One is licensed under CC BY 4.0.',
          foreign_landing_url: 'https://example.com/lake',
        },
      ],
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify(openverse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const search = await call('get', '/goals/covers/search?q=lake', 200);
    fetchSpy.mockRestore();
    matches(GoalCoverSearchPage, search.body);
    expect(search.body.results).toHaveLength(1);

    const goal = await call('post', '/goals', 201, { name: 'Move', targetAmount: 1000 });
    const goalId = goal.body.id;
    const items = `/goals/${goalId}/items`;
    const created = await call('post', items, 201, { name: 'Van', estimatedAmount: 400 });
    matches(GoalItemsResponse, created.body);
    const itemId = created.body.items[0].id;
    matches(GoalItemsResponse, (await call('get', items, 200)).body);
    const patched = await call('patch', `${items}/${itemId}`, 200, { status: 'paid' });
    matches(GoalItemsResponse, patched.body);
    matches(GoalItemsResponse, (await call('delete', `${items}/${itemId}`, 200)).body);

    const covered = await call('put', `/goals/${goalId}/cover`, 200, { preset: 'travel' });
    matches(GoalDetail, covered.body);
    expect(covered.body.cover).toEqual({ kind: 'preset', preset: 'travel' });
    matches(GoalDetail, (await call('delete', `/goals/${goalId}/cover`, 200)).body);

    const updated = await call('put', `/goals/${goalId}`, 200, { targetAmount: 1200 });
    matches(GoalWithProgress, updated.body);
    const contributed = await call('post', `/goals/${goalId}/contributions`, 201, { amount: 50 });
    const contributionId = contributed.body.contributions[0].id;
    const detail = await call('get', `/goals/${goalId}`, 200);
    matches(GoalDetail, detail.body);
    expect(detail.body.contributions).toHaveLength(1);
    const withdrawn = await call(
      'delete',
      `/goals/${goalId}/contributions/${contributionId}`,
      200,
    );
    matches(GoalDetail, withdrawn.body);
    matches(MessageResult, (await call('delete', `/goals/${goalId}`, 200)).body);
  });

  it('investments: account, holding, prices and a contribution', async () => {
    const account = await call('post', '/investments/accounts', 201, {
      name: 'Broker',
      kind: 'investment',
    });
    matches(InvestmentAccount, account.body);
    const holding = await call('post', `/investments/accounts/${account.body.id}/holdings`, 201, {
      name: 'All-World',
      assetClass: 'etf',
      quantity: 3,
      price: 100,
      priceCurrency: 'USD',
    });
    matches(InvestmentHolding, holding.body);
    const updated = await call('patch', `/investments/holdings/${holding.body.id}`, 200, {
      quantity: 4,
    });
    matches(InvestmentHolding, updated.body);
    expect(updated.body.quantity).toBe(4);
    matches(PriceRefreshResult, (await call('post', '/investments/refresh-prices', 200)).body);

    const linked = await call('post', '/investments/contributions', 201, {
      transactionId: expenseId,
      accountId: account.body.id,
    });
    matches(InvestmentContribution, linked.body);
    expect(linked.body).toMatchObject({ id: expenseId, transferPairKind: 'investment' });
    const unlinked = await call('delete', `/investments/contributions/${expenseId}`, 200);
    matches(InvestmentContribution, unlinked.body);
    expect(unlinked.body.investmentAccountId).toBeNull();
  });

  it('metals: a lot, its photo, a sale, the settings and prices', async () => {
    const lot = await call('post', '/metals/lots', 201, {
      metal: 'XAU',
      name: 'Coin',
      quantity: 2,
      unitWeight: 1,
      weightUnit: 'ozt',
      purity: 0.9167,
      acquiredOn: '2025-01-15',
      costTotal: 5000,
      costCurrency: 'USD',
      price: 2600,
      priceCurrency: 'USD',
    });
    matches(MetalLot, lot.body);
    const id = lot.body.id;
    matches(MetalLot, (await call('patch', `/metals/lots/${id}`, 200, { name: 'Coins' })).body);

    // Smallest valid PNG: one transparent pixel.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const uploaded = await request(app.getHttpServer())
      .post(`/metals/lots/${id}/photo`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .attach('photo', png, { filename: 'coin.png', contentType: 'image/png' })
      .expect(201);
    matches(MetalLot, uploaded.body);
    expect(uploaded.body.photoUrl).toEqual(expect.any(String));
    const removed = await call('delete', `/metals/lots/${id}/photo`, 200);
    matches(MetalLot, removed.body);
    expect(removed.body.photoUrl).toBeNull();

    const sold = await call('post', `/metals/lots/${id}/sell`, 201, {
      quantity: 1,
      proceeds: 2700,
      soldOn: today,
    });
    matches(MetalSaleResult, sold.body);
    expect(sold.body.lot.quantity).toBe(1);
    const settings = await call('patch', '/metals/settings', 200, { dealerDiscount: { XAU: 5 } });
    matches(MetalSettings, settings.body);
    expect(settings.body.dealerDiscount.XAU).toBe(5);
    matches(PriceRefreshResult, (await call('post', '/metals/refresh-prices', 200)).body);
  });

  it('crypto: holdings, an exchange import, gains by owner and wallets', async () => {
    const holding = await call('post', '/crypto/holdings', 201, {
      asset: 'ETH',
      amount: '1.5',
      costPerUnit: 2000,
    });
    matches(CryptoWallet, holding.body);
    expect(holding.body.balances[0].asset).toBe('ETH');
    matches(CryptoRemoved, (await call('delete', '/crypto/holdings/ETH', 200)).body);

    const csv = [
      'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes',
      'buy-1,2026-01-05T10:00:00Z,Buy,BTC,0.02,USD,60000,1200.00,1206.00,6.00,Bought 0.02 BTC',
      'sell-1,2026-03-05T10:00:00Z,Sell,BTC,0.01,USD,70000,700.00,694.00,6.00,Sold 0.01 BTC',
    ].join('\n');
    const imported = await request(app.getHttpServer())
      .post('/crypto/import')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .attach('file', Buffer.from(csv), { filename: 'coinbase.csv', contentType: 'text/csv' })
      .expect(201);
    matches(ExchangeImportResult, imported.body);
    expect(imported.body.imported).toBeGreaterThan(0);
    const gains = await call('get', '/crypto/gains/by-owner?year=2026', 200);
    matches(CryptoGainsByOwner, gains.body);
    expect(gains.body.byOwner[0].disposals.length).toBeGreaterThan(0);

    // The block explorers are not reachable from a test; the answer's shape is what is checked.
    vi.spyOn(app.get(CryptoSyncService), 'syncWallet').mockResolvedValue({
      imported: 0,
      skipped: 0,
    });
    const connected = await call('post', '/crypto/wallets', 201, {
      address: '0x1111111111111111111111111111111111111111',
      label: 'Cold storage',
    });
    matches(CryptoWalletList, connected.body);
    const walletId = connected.body[0].id;
    matches(CryptoSyncResult, (await call('post', `/crypto/wallets/${walletId}/sync`, 201)).body);
    matches(CryptoRemoved, (await call('delete', `/crypto/wallets/${walletId}`, 200)).body);
  });

  it('subscriptions: the writes answer the stored row', async () => {
    const next = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const created = await call('post', '/subscriptions', 201, {
      vendorName: 'ACME Cloud - Storage',
      amount: 120,
      frequency: 'annual',
      currency: 'USD',
      categoryId,
      nextChargeDate: next,
    });
    matches(SubscriptionRecord, created.body);
    expect(created.body).toMatchObject({ amount: '120.00', nextChargeDate: next });
    const id = created.body.id;

    const updated = await call('put', `/subscriptions/${id}`, 200, { amount: 132.5 });
    matches(SubscriptionRecord, updated.body);
    expect(updated.body.amount).toBe('132.50');
    const owned = await call('patch', `/subscriptions/${id}/owner`, 200, {
      ownerId: owner.userId,
    });
    matches(SubscriptionRecord, owned.body);
    const decided = await call('post', `/subscriptions/${id}/decisions`, 201, {
      decision: 'keep',
      reviewAt: '2027-01-15',
    });
    matches(SubscriptionRecord, decided.body);
    expect(decided.body.reviewAt).toBe('2027-01-15');
    const used = await call('post', `/subscriptions/${id}/usage`, 200);
    matches(SubscriptionItem, used.body);
    expect(used.body.usageCount).toBe(1);

    const upcoming = await call('get', '/subscriptions/upcoming?days=30', 200);
    matches(UpcomingSubscriptionList, upcoming.body);
    expect(upcoming.body).toHaveLength(1);
    const funds = await call('get', '/subscriptions/sinking-funds', 200);
    matches(SinkingFundList, funds.body);
    expect(funds.body).toHaveLength(1);
    const fund = await call('post', `/subscriptions/${id}/sinking-fund`, 200);
    matches(SinkingFundResult, fund.body);
    expect(fund.body.created).toBe(true);

    const detected = await dataSource.getRepository(Subscription).save({
      workspaceId: owner.workspaceId,
      vendorName: 'ACME Music - Family',
      amount: 9.99,
      currency: 'USD',
      frequency: SubscriptionFrequency.MONTHLY,
      status: SubscriptionStatus.DETECTED,
      detectionMeta: { transactionIds: [] },
    });
    const confirmed = await call('post', `/subscriptions/${detected.id}/confirm`, 201);
    matches(SubscriptionRecord, confirmed.body);
    expect(confirmed.body.status).toBe('active');
  });
});
