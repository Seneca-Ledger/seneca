import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Insight, InsightCategory, InsightType } from '../../../src/entities/insight.entity';
import {
  Notification,
  NotificationCategory,
  NotificationType,
} from '../../../src/entities/notification.entity';
import { ReportHistory } from '../../../src/entities/report-history.entity';
import {
  SubscriptionCharge,
  SubscriptionChargeMatchStatus,
} from '../../../src/entities/subscription-charge.entity';
import {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../../../src/entities/webhook-delivery.entity';
import {
  BackupRun,
  BackupRunStatus,
  BackupRunTrigger,
} from '../../../src/entities/backup-run.entity';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../../src/entities/receipt.entity';
import { User, UserRole } from '../../../src/entities/user.entity';
import type { E2eAccount } from './e2e-app';

/**
 * Fills a workspace with one of nearly every kind of record, through the API
 * where a route creates it and through the repository where only a job or an
 * outside service would. For suites that need a workspace full of things to
 * look for (the isolation sweep). Every step must succeed: a step that starts
 * failing is a seed that silently stopped covering a table. Every name and
 * text carries `marker`, so an answer that holds the workspace's data shows
 * it by more than ids.
 */
export async function seedWorkspace(
  app: INestApplication,
  dataSource: DataSource,
  owner: E2eAccount,
  marker: string,
): Promise<void> {
  const server = app.getHttpServer();
  const as = (method: 'get' | 'post' | 'put' | 'patch', url: string) =>
    request(server)
      [method](url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId);
  const ok = async (label: string, req: request.Test): Promise<request.Response> => {
    const res = await req;
    if (res.status >= 300) {
      throw new Error(`seed step "${label}" answered ${res.status}: ${JSON.stringify(res.body)}`);
    }
    return res;
  };
  const send = (label: string, method: 'post' | 'put' | 'patch', url: string, body: object = {}) =>
    ok(label, as(method, url).send(body));

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const taxYear = new Date().getFullYear() - 1;

  // Money in and out.
  const category = await send('category', 'post', '/categories', {
    name: `${marker} category`,
    type: 'expense',
  });
  const statement = await ok(
    'manual expense',
    as('post', '/statements/manual-expense')
      .field('amount', '42.50')
      .field('currency', 'USD')
      .field('merchant', `${marker} merchant`)
      .field('categoryId', category.body.id)
      .field('date', today),
  );
  const [transaction] = await dataSource.query(
    'SELECT id FROM transactions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1',
    [owner.workspaceId],
  );
  await send('wallet', 'post', '/wallets', {
    name: `${marker} wallet`,
    currency: 'USD',
    initialBalance: 1,
  });
  await send('branch', 'post', '/branches', { name: `${marker} branch` });
  await send('rule', 'post', '/categorization-rules', {
    name: `${marker} rule`,
    conditions: [{ field: 'counterparty_name', operator: 'contains', value: marker }],
    result: { categoryId: category.body.id },
  });
  await send('tax rate', 'post', '/tax-rates', { name: `${marker} 5%`, rate: 5 });
  await send('exchange rate', 'post', '/exchange-rates/manual', {
    from: 'USD',
    to: 'EUR',
    rate: 0.9,
    date: today,
  });
  await send('data entry', 'post', '/data-entry', { type: 'cash', date: today, amount: 12 });
  await send('data entry field', 'post', '/data-entry/custom-fields', { name: `${marker} field` });
  const subscription = await send('subscription', 'post', '/subscriptions', {
    vendorName: `${marker} streaming`,
    amount: 9.99,
    frequency: 'monthly',
    currency: 'USD',
  });
  await send('subscription decision', 'post', `/subscriptions/${subscription.body.id}/decisions`, {
    decision: 'keep',
  });
  await send('view preference', 'put', '/view-preferences/transactions', {
    state: { owner: 'me' },
  });
  await send('note', 'post', '/notes', {
    entityType: 'transaction',
    entityId: transaction.id,
    body: `${marker} note`,
  });
  await ok(
    'attachment',
    as('post', `/transactions/${transaction.id}/attachments`).attach(
      'file',
      Buffer.from('%PDF-1.4 seed'),
      {
        filename: 'seed.pdf',
        contentType: 'application/pdf',
      },
    ),
  );

  // Plans.
  const goal = await send('goal', 'post', '/goals', {
    name: `${marker} goal`,
    targetAmount: 100,
    currency: 'USD',
  });
  await send('goal contribution', 'post', `/goals/${goal.body.id}/contributions`, { amount: 10 });
  await send('goal item', 'post', `/goals/${goal.body.id}/items`, {
    name: `${marker} item`,
    estimatedAmount: 20,
    dueMonth: month,
  });
  const budget = await send('budget', 'post', '/budgets', {
    name: `${marker} budget`,
    categoryId: category.body.id,
    limitAmount: 50,
    periodType: 'monthly',
    currency: 'USD',
  });
  // The subscription is paid from the budget.
  await send('subscription budget', 'put', `/subscriptions/${subscription.body.id}`, {
    budgetId: budget.body.id,
  });

  // Bills, invoices, credit notes.
  const payable = await send('payable', 'post', '/payables', {
    vendor: `${marker} vendor`,
    amount: 12,
    currency: 'USD',
    dueDate: '2026-12-01',
  });
  await send('payable payment', 'post', `/payables/${payable.body.id}/payments`, {
    amount: 2,
    paidOn: today,
  });
  await send('business profile', 'put', '/business-profile', {
    legalName: `${marker} Ltd`,
    addressLines: `1 ${marker} St`,
  });
  const client = await send('client', 'post', '/clients', {
    name: `${marker} client`,
    email: 'seed@example.com',
    currency: 'USD',
  });
  const invoice = await send('invoice', 'post', '/invoices', {
    clientId: client.body.id,
    issueDate: '2026-01-05',
    dueDate: '2026-02-04',
    currency: 'USD',
    lineItems: [{ description: `${marker} work`, quantity: 1, unitPrice: 100 }],
  });
  await send('invoice sent', 'put', `/invoices/${invoice.body.id}/send`);
  await send('credit note', 'post', '/credit-notes', {
    reason: `${marker} discount`,
    applications: [{ invoiceId: invoice.body.id, amount: 10 }],
  });
  // No SMTP in e2e: the attempt is still recorded as a delivery.
  await as('post', `/invoices/${invoice.body.id}/deliveries`).send({});

  // Custom tables.
  const table = await send('custom table', 'post', '/custom-tables', { name: `${marker} table` });
  const column = await send('column', 'post', `/custom-tables/${table.body.id}/columns`, {
    title: 'Vendor',
    type: 'text',
  });
  const row = await send('row', 'post', `/custom-tables/${table.body.id}/rows`, {
    data: { [column.body.key]: `${marker} row` },
  });
  await send(
    'row comment',
    'post',
    `/custom-tables/${table.body.id}/rows/${row.body.id}/comments`,
    { body: `${marker} comment` },
  );
  await send('table share', 'post', `/custom-tables/${table.body.id}/shares`);
  await send('table export schedule', 'post', `/custom-tables/${table.body.id}/export-schedules`, {
    format: 'csv',
    intervalHours: 24,
  });

  // Storage.
  const tag = await send('tag', 'post', '/tags', {
    name: `${marker} tag`,
    color: '#22c55e',
    description: `${marker} tag description`,
    tagDate: today,
  });
  await send('folder', 'post', '/storage/folders', {
    name: `${marker} folder`,
    tagId: tag.body.id,
  });
  await send('storage view', 'post', '/storage/views', {
    name: `${marker} view`,
    filters: { search: 'x' },
  });
  await send('file share', 'post', `/storage/files/${statement.body.id}/share`, {
    permission: 'view',
  });
  await send('file version', 'post', `/storage/files/${statement.body.id}/versions`, {
    note: `${marker} version`,
  });

  // Books, wealth, tax.
  await send('ledger', 'put', '/ledger/settings', { baseCurrency: 'USD' });
  await send('ledger account', 'post', '/ledger/accounts', {
    code: 'SEED-1',
    name: `${marker} account`,
    accountType: 'expense',
  });
  const investments = await send('investment account', 'post', '/investments/accounts', {
    name: `${marker} broker`,
  });
  await send('holding', 'post', `/investments/accounts/${investments.body.id}/holdings`, {
    symbol: 'SEED',
    name: `${marker} fund`,
    assetClass: 'fund',
    quantity: 1,
    price: 10,
    priceCurrency: 'USD',
  });
  const lot = await send('metal lot', 'post', '/metals/lots', {
    metal: 'XAU',
    quantity: 2,
    unitWeight: 1,
    weightUnit: 'ozt',
    purity: 0.9999,
    acquiredOn: `${taxYear}-02-01`,
    costTotal: 4000,
    costCurrency: 'USD',
  });
  await send('metal sale', 'post', `/metals/lots/${lot.body.id}/sell`, {
    quantity: 1,
    proceeds: 2500,
    proceedsCurrency: 'USD',
    soldOn: today,
  });
  await send('income tax profile', 'put', '/income-tax/profile', {
    taxYear,
    taxpayerType: 'self_employed',
  });
  await send('income tax disclaimer', 'post', '/income-tax/disclaimer');
  await send('jurisdiction', 'put', '/tax/settings/jurisdiction', {
    code: 'DE',
    effectiveFrom: `${taxYear}-01-01`,
  });
  await send('tax rule', 'post', '/tax/rules', {
    categoryId: category.body.id,
    taxRateCode: 'DE_REDUCED',
    direction: 'expense',
  });
  await send('tax return', 'post', '/tax/returns/file', {
    periodStart: `${taxYear}-01-01`,
    periodEnd: `${taxYear}-03-31`,
  });

  // Settings and access.
  // API keys belong to the instance-admin role: the owner holds it only for this step.
  await dataSource.getRepository(User).update({ id: owner.userId }, { role: UserRole.ADMIN });
  await send('api key', 'post', '/api-keys', {
    name: `${marker} key`,
    scopes: ['transaction.view'],
  });
  await dataSource.getRepository(User).update({ id: owner.userId }, { role: UserRole.USER });
  await send('webhook endpoint', 'post', '/webhook-endpoints', { name: `${marker} endpoint` });
  const hook = await send('webhook subscription', 'post', '/webhook-subscriptions', {
    name: `${marker} hook`,
    url: 'https://example.com/hook',
    secret: 'seed-secret-0123456789',
    events: ['transaction.created'],
  });
  await send('report schedule', 'post', '/reports/schedules', {
    templateId: 'pnl',
    format: 'pdf',
    cadence: 'monthly',
    recipients: ['seed@example.com'],
  });
  await send('invitation', 'post', `/workspaces/${owner.workspaceId}/invitations`, {
    email: `seed-invitee-${Date.now()}@example.com`,
    role: 'member',
  });
  await send('notification preferences', 'patch', '/notifications/preferences', {
    channels: { statementUploaded: { inApp: true } },
  });
  const config = await send('backup config', 'put', '/backups/config', {
    destinationKind: 'local',
    password: 'seed-backup-pass',
  });

  // What a job or an outside service writes.
  await dataSource.getRepository(BackupRun).save({
    workspaceId: owner.workspaceId,
    configurationId: config.body.id,
    trigger: BackupRunTrigger.MANUAL,
    status: BackupRunStatus.SUCCEEDED,
    sizeBytes: '1024',
    startedAt: new Date(),
    finishedAt: new Date(),
  });
  await dataSource.getRepository(Insight).save({
    userId: owner.userId,
    workspaceId: owner.workspaceId,
    type: InsightType.SPENDING_SPIKE,
    category: InsightCategory.ANOMALY,
    title: `${marker} insight`,
    message: `${marker} insight`,
  });
  await dataSource.getRepository(Notification).save({
    recipientId: owner.userId,
    workspaceId: owner.workspaceId,
    type: NotificationType.STATEMENT_UPLOADED,
    category: NotificationCategory.WORKSPACE_ACTIVITY,
    title: `${marker} notification`,
    message: `${marker} notification`,
  });
  await dataSource.getRepository(WebhookDelivery).save({
    subscriptionId: hook.body.id,
    event: 'transaction.created',
    payload: { seed: true },
    // Delivered: a pending one would be retried by the worker while a suite runs.
    status: WebhookDeliveryStatus.SUCCESS,
    attemptCount: 1,
  });
  await dataSource.getRepository(SubscriptionCharge).save({
    workspaceId: owner.workspaceId,
    subscriptionId: subscription.body.id,
    transactionId: transaction.id,
    amount: 9.99,
    currency: 'USD',
    chargeDate: new Date(),
    expectedAmount: 9.99,
    matchStatus: SubscriptionChargeMatchStatus.MATCHED,
  });
  // A payee and the rule a person's link to one of its rows teaches.
  const rule = await dataSource.query(
    `WITH payee AS (INSERT INTO payees (workspace_id, name) VALUES ($1, $3) RETURNING id)
     INSERT INTO subscription_payees (workspace_id, subscription_id, payee_id)
     SELECT $1, $2, id FROM payee
     RETURNING id`,
    [owner.workspaceId, subscription.body.id, `${marker} payee`],
  );
  if (rule.length !== 1) {
    throw new Error('Seeding subscription payee rule failed');
  }
  await dataSource.getRepository(ReportHistory).save({
    workspaceId: owner.workspaceId,
    userId: owner.userId,
    templateId: 'pnl',
    templateName: `${marker} report`,
    dateFrom: `${taxYear}-01-01`,
    dateTo: `${taxYear}-12-31`,
    format: 'pdf',
    fileName: 'seed-report.pdf',
    fileSize: 1024,
  });
  const receipt = await dataSource.getRepository(Receipt).save({
    userId: owner.userId,
    workspaceId: owner.workspaceId,
    source: ReceiptSource.SCAN,
    subject: `${marker} receipt`,
    sender: 'scan',
    receivedAt: new Date(),
    status: ReceiptStatus.NEEDS_REVIEW,
    parsedData: { amount: 5, currency: 'USD', vendor: `${marker} shop` },
  });
  // A receipt_tags row: the sweep checks no route links B's receipt to A's tag or back.
  await send('receipt tag', 'put', `/receipts/${receipt.id}/tags`, { tagIds: [tag.body.id] });
  // A payable_tags row, for the same reason.
  await send('payable tag', 'put', `/payables/${payable.body.id}`, { tagIds: [tag.body.id] });
}
