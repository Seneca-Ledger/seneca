vi.mock('franc', () => ({ franc: () => 'und' }));

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  BalanceAccountClassification,
  BalanceAccountCreated,
  BalanceAccountsTree,
  BalanceSnapshotSaved,
  IncomeTaxDisclaimer,
  IncomeTaxMappings,
  IncomeTaxProfile,
  JurisdictionAdoption,
  LedgerAccount,
  LedgerSettings,
  MessageResult,
  OfficialRatesCheck,
  ReportScheduleItem,
  ReportScheduleList,
  TaxJurisdictionItem,
  TaxRateItem,
  TaxReturnRecord,
  TaxReturnRecordList,
  TaxRuleItem,
} from '../../src/contracts';
import {
  LedgerBalanceSheet,
  LedgerRevaluationList,
  LedgerSyncQueued,
  ProfitAndLoss,
} from '../../src/contracts/ledger/ledger-reports';
import {
  CustomReport,
  CustomTablesSummary,
  DailyReport,
  LatestReportPeriod,
  MonthlyReport,
  ReportScheduleRemoved,
  SpendOverTimeReport,
  StatementsSummary,
  TopCategoriesReport,
} from '../../src/contracts/reports/report-summaries';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** Tax, income tax, ledger, balance sheet and report answers, each checked with data in it. */
describe('API contracts: tax, ledger and reports (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `contracts-tax-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let categoryId: string;
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const january = { periodStart: `${year}-01-01`, periodEnd: `${year}-01-31` };

  const call = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: object) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .send(body);
  const get = (url: string) => call('get', url).expect(200);
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(body);
  const expense = (amount: string, currency: string, merchant: string, date: string) =>
    call('post', '/statements/manual-expense')
      .field({ amount, currency, merchant, categoryId, date })
      .expect(201);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    categoryId = (await get('/categories?type=expense')).body[0].id;

    const adopted = await call('put', '/tax/settings/jurisdiction', { code: 'DE' }).expect(200);
    matches(JurisdictionAdoption, adopted.body);
    expect(adopted.body.adopted).toBeGreaterThan(0);
    const rates = await get('/tax-rates');
    const code = rates.body.find((rate: { code: string | null }) => rate.code).code;
    await call('post', '/tax/rules', { categoryId, taxRateCode: code, direction: 'expense' }).expect(
      201,
    );
    await expense('119.00', 'EUR', 'ACME Store - Office Chair', `${year}-01-15`);
  });

  afterAll(async () => {
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('tax: a jurisdiction, rates and rules read and written one by one', async () => {
    matches(TaxJurisdictionItem, (await get('/tax/jurisdictions/DE')).body);
    const rate = (await get('/tax-rates')).body[0];
    matches(TaxRateItem, (await get(`/tax-rates/${rate.id}`)).body);
    const created = await call('post', '/tax-rates', { name: 'Contract rate', rate: 7 }).expect(201);
    matches(TaxRateItem, created.body);
    const updated = await call('put', `/tax-rates/${created.body.id}`, {
      name: 'Contract rate, renamed',
      rate: 9.5,
    }).expect(200);
    matches(TaxRateItem, updated.body);
    expect(updated.body.name).toBe('Contract rate, renamed');
    matches(MessageResult, (await call('delete', `/tax-rates/${created.body.id}`).expect(200)).body);

    const rule = (await get('/tax/rules')).body[0];
    matches(TaxRuleItem, (await get(`/tax/rules/${rule.id}`)).body);
    const moved = await call('put', `/tax/rules/${rule.id}`, { priority: 5 }).expect(200);
    matches(TaxRuleItem, moved.body);
    expect(moved.body.priority).toBe(5);
    const extra = await call('post', '/tax/rules', {
      categoryId,
      taxRateCode: rule.taxRateCode,
      direction: 'income',
    }).expect(201);
    matches(TaxRuleItem, extra.body);
    matches(MessageResult, (await call('delete', `/tax/rules/${extra.body.id}`).expect(200)).body);
  });

  it('tax: a period filed, listed and reopened; the official rates checked again', async () => {
    const period = `/tax/returns/period?periodStart=${january.periodStart}&periodEnd=${january.periodEnd}`;
    // The second read recomputes the stored draft rather than inserting one.
    for (const _ of [1, 2]) matches(TaxReturnRecord, (await get(period)).body);
    const filed = await call('post', '/tax/returns/file', january).expect(201);
    matches(TaxReturnRecord, filed.body);
    expect(filed.body.status).toBe('filed');
    expect(filed.body.snapshot.length).toBeGreaterThan(0);
    const list = await get('/tax/returns');
    matches(TaxReturnRecordList, list.body);
    expect(list.body).toHaveLength(1);
    const reopened = await call('post', '/tax/returns/reopen', january).expect(201);
    matches(TaxReturnRecord, reopened.body);
    expect(reopened.body.status).toBe('draft');

    matches(
      OfficialRatesCheck,
      (await call('post', '/tax/settings/official-rates/refresh', {}).expect(201)).body,
    );
    const dismissed = await call('put', '/tax/settings/official-rates/dismissed', {
      key: 'standard_changed:21:2026-01-01',
      dismissed: true,
    }).expect(200);
    matches(OfficialRatesCheck, dismissed.body);
  });

  it('income tax: the disclaimer accepted, the profile and the line mappings saved', async () => {
    const accepted = await call('post', '/income-tax/disclaimer').expect(201);
    matches(IncomeTaxDisclaimer, accepted.body);
    expect(accepted.body.accepted).toBe(true);
    const profile = await call('put', '/income-tax/profile', {
      taxYear: year,
      taxpayerType: 'self_employed',
    }).expect(200);
    matches(IncomeTaxProfile, profile.body);
    expect(profile.body.pack).not.toBeNull();
    const mappings = await get(`/income-tax/mappings?taxYear=${year}`);
    const line = mappings.body.lines.find((item: { section: string }) => item.section === 'expense');
    const saved = await call('put', '/income-tax/mappings', {
      taxYear: year,
      entries: [{ categoryId, lineKey: line.key }],
    }).expect(200);
    matches(IncomeTaxMappings, saved.body);
    const mapped = saved.body.categories.find((item: { categoryId: string }) => item.categoryId === categoryId);
    expect(mapped).toMatchObject({ lineKey: line.key, status: 'confirmed' });
  });

  it('ledger: enabled, synced, an account and a draft changed, the reports and revaluations', async () => {
    await call('post', '/exchange-rates/manual', { from: 'USD', to: 'EUR', rate: 0.9 }).expect(201);
    await expense('50.00', 'USD', 'Example Co - Cloud Plan', today);
    const enabled = await call('put', '/ledger/settings', { baseCurrency: 'EUR' }).expect(200);
    matches(LedgerSettings, enabled.body);
    expect(enabled.body.enabled).toBe(true);
    matches(LedgerSyncQueued, (await call('post', '/ledger/sync').expect(202)).body);
    for (let attempt = 0; attempt < 60; attempt++) {
      const [integrity, entries] = await Promise.all([get('/ledger/integrity'), get('/ledger/entries')]);
      if (integrity.body.upToDate && entries.body.data.length > 0) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const accounts = (await get('/ledger/accounts')).body as Array<Record<string, unknown>>;
    const header = accounts.find(item => item.accountType === 'asset' && !item.isPostable);
    const created = await call('post', '/ledger/accounts', {
      code: 'CONTRACT-1',
      name: 'Contract bank',
      accountType: 'asset',
      parentId: header?.id,
    }).expect(201);
    const renamed = await call('patch', `/ledger/accounts/${created.body.id}`, {
      name: 'Contract bank, renamed',
    }).expect(200);
    matches(LedgerAccount, renamed.body);
    expect(renamed.body.name).toBe('Contract bank, renamed');
    const draft = await call('post', '/ledger/entries', {
      entryDate: today,
      lines: [{ accountId: created.body.id, side: 'debit', amount: '10.00' }],
    }).expect(201);
    matches(MessageResult, (await call('delete', `/ledger/entries/${draft.body.id}`).expect(200)).body);
    matches(MessageResult, (await call('delete', `/ledger/accounts/${created.body.id}`).expect(200)).body);

    const pnl = await get(`/ledger/reports/profit-and-loss?dateFrom=${year}-01-01&allowStale=true`);
    matches(ProfitAndLoss, pnl.body);
    expect(pnl.body.expenses.length).toBeGreaterThan(0);
    const sheet = await get(`/ledger/reports/balance-sheet?date=${today}&allowStale=true`);
    matches(LedgerBalanceSheet, sheet.body);
    expect(sheet.body.liabilities.length + sheet.body.assets.length).toBeGreaterThan(0);

    await call('post', '/exchange-rates/manual', { from: 'USD', to: 'EUR', rate: 0.8 }).expect(201);
    await call('post', '/ledger/revaluations', { date: today }).expect(201);
    const revaluations = await get('/ledger/revaluations');
    matches(LedgerRevaluationList, revaluations.body);
    expect(revaluations.body.length).toBeGreaterThan(0);
  }, 60_000);

  it('balance sheet: the lines, a snapshot, a custom line and a classification', async () => {
    const tree = await get('/reports/balance/accounts');
    matches(BalanceAccountsTree, tree.body);
    type Node = { id: string; code: string; isEditable: boolean; isExpandable: boolean; children: Node[] };
    const all: Node[] = [];
    const walk = (nodes: Node[]) => nodes.forEach(node => all.push(node) && walk(node.children));
    walk([...tree.body.assets, ...tree.body.liabilities]);
    const editable = all.find(node => node.isEditable) as Node;
    const snapshot = await call('put', '/reports/balance/snapshot', {
      accountId: editable.id,
      amount: 1250.5,
    }).expect(200);
    matches(BalanceSnapshotSaved, snapshot.body);
    const parent = all.find(node => node.isExpandable) as Node;
    const created = await call('post', '/reports/balance/accounts', {
      name: 'ACME Bank - Car Loan',
      parentId: parent.id,
    }).expect(201);
    matches(BalanceAccountCreated, created.body);
    const classified = await call('patch', `/reports/balance/accounts/${editable.id}/classification`, {
      capitalRole: 'neutral',
      riskLevel: 'low',
    }).expect(200);
    matches(BalanceAccountClassification, classified.body);
    expect(classified.body).toMatchObject({ capitalRole: 'neutral', riskLevel: 'low' });
  });

  it('reports: summaries, top categories, spend over time, daily, monthly, custom and latest', async () => {
    const summary = await get('/reports/statements/summary?days=400');
    matches(StatementsSummary, summary.body);
    expect(summary.body.recent.length).toBeGreaterThan(0);
    const top = await get(`/reports/top-categories?dateFrom=${year}-01-01&dateTo=${today}`);
    matches(TopCategoriesReport, top.body);
    expect(top.body.categories.length).toBeGreaterThan(0);
    const overTime = await get(`/reports/spend-over-time?dateFrom=${year}-01-01&groupBy=month`);
    matches(SpendOverTimeReport, overTime.body);
    expect(overTime.body.points.length).toBeGreaterThan(0);
    const daily = await get(`/reports/daily?date=${year}-01-15`);
    matches(DailyReport, daily.body);
    expect(daily.body.expense.transactionCount).toBeGreaterThan(0);
    const monthly = await get(`/reports/monthly?year=${year}&month=1`);
    matches(MonthlyReport, monthly.body);
    expect(monthly.body.categoryDistribution.length).toBeGreaterThan(0);
    const custom = await call('post', '/reports/custom', {
      dateFrom: `${year}-01-01`,
      dateTo: today,
      groupBy: 'category',
    }).expect(201);
    matches(CustomReport, custom.body);
    expect(custom.body.groups[0].transactions.length).toBeGreaterThan(0);
    const latest = await get('/reports/latest');
    matches(LatestReportPeriod, latest.body);
    expect(latest.body.date).not.toBeNull();

    const table = await call('post', '/custom-tables', { name: 'Contract costs' }).expect(201);
    const amount = await call('post', `/custom-tables/${table.body.id}/columns`, {
      title: 'Amount',
      type: 'number',
    }).expect(201);
    const vendor = await call('post', `/custom-tables/${table.body.id}/columns`, {
      title: 'Vendor',
      type: 'text',
    }).expect(201);
    await call('post', `/custom-tables/${table.body.id}/rows`, {
      data: { [amount.body.key]: -42.5, [vendor.body.key]: 'ACME Store' },
    }).expect(201);
    const tables = await call('post', '/reports/custom-tables/summary', { days: 30 }).expect(201);
    matches(CustomTablesSummary, tables.body);
    expect(tables.body.recent.length).toBeGreaterThan(0);
  });

  it('report schedules: created, paused, listed and removed', async () => {
    const created = await call('post', '/reports/schedules', {
      templateId: 'pnl',
      format: 'pdf',
      cadence: 'monthly',
      recipients: ['member-1@example.com'],
    }).expect(201);
    matches(ReportScheduleItem, created.body);
    const paused = await call('patch', `/reports/schedules/${created.body.id}`, {
      isActive: false,
    }).expect(200);
    matches(ReportScheduleItem, paused.body);
    expect(paused.body.isActive).toBe(false);
    const list = await get('/reports/schedules');
    matches(ReportScheduleList, list.body);
    expect(list.body).toHaveLength(1);
    const removed = await call('delete', `/reports/schedules/${created.body.id}`).expect(200);
    matches(ReportScheduleRemoved, removed.body);
  });
});
