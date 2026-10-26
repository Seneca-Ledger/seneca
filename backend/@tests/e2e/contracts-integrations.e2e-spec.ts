vi.mock('franc', () => ({
  franc: () => 'und',
}));
// No mail leaves the test: the SMTP check verifies against a transport that always answers.
vi.mock('nodemailer', () => {
  const mock = {
    createTransport: () => ({ sendMail: async () => ({ messageId: 'e2e' }), verify: async () => true }),
  };
  return { ...mock, default: mock };
});
// An IMAP server with two folders and one message that carries nothing to import.
vi.mock('imapflow', () => ({
  ImapFlow: class {
    async connect() {}
    async mailboxOpen() {}
    async list() {
      return [{ path: 'INBOX' }, { path: 'Receipts' }];
    }
    async search() {
      return [101];
    }
    async fetchOne() {
      return { uid: 101 };
    }
    async messageFlagsAdd() {}
    async logout() {}
  },
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  BackupRun,
  BankSyncResult,
  BankSyncStatus,
  BrowseOptionList,
  BulkConversion,
  IntegrationConnection,
  IntegrationDisconnected,
  LocalCategorizationStatus,
  LocalCategorizationTestResult,
  ManualExchangeRate,
  ProtocolFileList,
  ProtocolImportResult,
  ProtocolSyncResult,
  PushSubscriptionCreated,
  PushSubscriptionList,
  TelegramBotStatus,
  TelegramReportSent,
  WebhookActionResult,
  WebhookEndpointItem,
  WebhookReceiptAccepted,
  WebhookStatementAccepted,
  WebhookSubscriptionItem,
  WebhookTestQueued,
} from '../../src/contracts';
import { BANK_SYNC_FETCH } from '../../src/modules/bank-sync/bank-sync-provider.interface';
import { deleteUserByEmail, type E2eAccount, e2eTestingModule, registerAccount } from './helpers/e2e-app';
import {
  installIntegrationFakes,
  png,
  simplefinFetch,
  simplefinSetupToken,
  statementCsvFile,
} from './helpers/integration-fakes';

/**
 * The answers of the integration and settings endpoints (open protocols, bank
 * feed, Telegram, webhooks, push, backups, exchange rates), each checked
 * against its contract with data in it. Outside services are fakes.
 */
describe('Integration contracts (e2e)', () => {
  const email = `contracts-integ-${Date.now()}@example.com`;
  let restoreFakes: () => void;
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: E2eAccount;

  const call = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: object) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId);
    return body ? req.send(body) : req;
  };
  const ok = (res: request.Response) => {
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`${res.status}: ${JSON.stringify(res.body)}`);
    }
  };
  const answer = async (schema: Schema.Top, req: request.Test) => {
    const res = await req.expect(ok);
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(res.body);
    return res.body;
  };

  beforeAll(async () => {
    restoreFakes = installIntegrationFakes();
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] })
      .overrideProvider(BANK_SYNC_FETCH)
      .useValue(simplefinFetch)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
  });

  afterAll(async () => {
    restoreFakes();
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('webhook endpoints, uploads through a token and subscriptions', async () => {
    await call('patch', `/workspaces/${owner.workspaceId}`, { plugins: { webhooks: true } }).expect(200);
    const created = (await call('post', '/webhook-endpoints', { name: 'Scanner' }).expect(201)).body;
    const endpoint = await answer(WebhookEndpointItem, call('get', `/webhook-endpoints/${created.id}`));
    expect(endpoint.tokenPreview).toBe(`${created.token.slice(0, 8)}...`);
    expect(endpoint).not.toHaveProperty('token');
    const renamed = await answer(
      WebhookEndpointItem,
      call('patch', `/webhook-endpoints/${created.id}`, { name: 'Office scanner' }),
    );
    expect(renamed.name).toBe('Office scanner');

    const inbound = (path: string) => request(app.getHttpServer()).post(`/webhooks/${created.token}/${path}`);
    const statement = await answer(
      WebhookStatementAccepted,
      inbound('statements').attach('file', statementCsvFile, { filename: 'acme.csv', contentType: 'text/csv' }),
    );
    expect(statement.statementId).toBeTruthy();
    const receipt = await answer(
      WebhookReceiptAccepted,
      inbound('receipts').attach('file', png, { filename: 'receipt.png', contentType: 'image/png' }),
    );
    expect(receipt.receipts).toHaveLength(1);
    await answer(WebhookActionResult, call('delete', `/webhook-endpoints/${created.id}`));

    const subscription = await answer(
      WebhookSubscriptionItem,
      call('post', '/webhook-subscriptions', {
        name: 'Ledger sync',
        url: 'https://93.184.215.14/hooks/ledger',
        secret: 'a-secret-of-at-least-16',
        events: ['statement.processed'],
      }),
    );
    expect(subscription).not.toHaveProperty('secret');
    await answer(WebhookSubscriptionItem, call('get', `/webhook-subscriptions/${subscription.id}`));
    const paused = await answer(
      WebhookSubscriptionItem,
      call('patch', `/webhook-subscriptions/${subscription.id}`, { isActive: false }),
    );
    expect(paused.isActive).toBe(false);
    await answer(WebhookTestQueued, call('post', `/webhook-subscriptions/${subscription.id}/test`));
    const deliveries = (await call('get', `/webhook-subscriptions/${subscription.id}/deliveries`).expect(200)).body;
    expect(deliveries.length).toBeGreaterThan(0);
    await answer(WebhookActionResult, call('post', `/webhook-deliveries/${deliveries[0].id}/retry`));
    await answer(WebhookActionResult, call('delete', `/webhook-subscriptions/${subscription.id}`));
  });

  it('S3-compatible storage: settings, files, import, sync, disconnect', async () => {
    const saved = await answer(
      IntegrationConnection,
      call('post', '/integrations/s3-compatible/settings', {
        endpoint: 'https://1.1.1.1',
        bucket: 'statements',
        prefix: 'statements',
        accessKeyId: 'access-id',
        secretAccessKey: 'secret-key',
      }),
    );
    expect(saved.connected).toBe(true);
    expect(JSON.stringify(saved)).not.toContain('secret-key');
    await answer(IntegrationConnection, call('get', '/integrations/s3-compatible/status'));
    const files = await answer(ProtocolFileList, call('get', '/integrations/s3-compatible/files'));
    expect(files.files).toHaveLength(1);
    const imported = await answer(
      ProtocolImportResult,
      call('post', '/integrations/s3-compatible/import', { fileIds: [files.files[0].id] }),
    );
    expect(imported.results).toHaveLength(1);
    const synced = await answer(ProtocolSyncResult, call('post', '/integrations/s3-compatible/sync'));
    expect(synced.uploaded).toBeGreaterThan(0);
    await answer(IntegrationDisconnected, call('delete', '/integrations/s3-compatible'));
  });

  it('WebDAV: settings, files, import, sync, disconnect', async () => {
    await answer(
      IntegrationConnection,
      call('post', '/integrations/webdav/settings', {
        url: 'https://1.1.1.1/remote.php/dav',
        rootPath: '/statements',
        username: 'member-1',
        password: 'dav-pass',
      }),
    );
    await answer(IntegrationConnection, call('get', '/integrations/webdav/status'));
    const files = await answer(ProtocolFileList, call('get', '/integrations/webdav/files'));
    expect(files.files).toHaveLength(1);
    await answer(
      ProtocolImportResult,
      call('post', '/integrations/webdav/import', { fileIds: [files.files[0].id] }),
    );
    await answer(ProtocolSyncResult, call('post', '/integrations/webdav/sync'));
    await answer(IntegrationDisconnected, call('delete', '/integrations/webdav'));
  });

  it('IMAP: folders, settings, sync, disconnect', async () => {
    const mailbox = { host: '1.1.1.1', port: 993, secure: true, user: 'member-1@example.com', pass: 'imap-pass' };
    const folders = await answer(BrowseOptionList, call('post', '/integrations/imap/folders', mailbox));
    expect(folders).toEqual(['INBOX', 'Receipts']);
    await answer(IntegrationConnection, call('post', '/integrations/imap/settings', { ...mailbox, mailbox: 'INBOX' }));
    const synced = await answer(ProtocolSyncResult, call('post', '/integrations/imap/sync'));
    expect(synced.scanned).toBe(1);
    await answer(IntegrationDisconnected, call('delete', '/integrations/imap'));
  });

  it('the SimpleFIN bank feed: connect, settings, refresh, sync, disconnect', async () => {
    const connected = await answer(
      BankSyncStatus,
      call('post', '/integrations/simplefin/connect', { setupToken: simplefinSetupToken }),
    );
    expect(connected.settings?.accounts).toHaveLength(1);
    await answer(BankSyncStatus, call('post', '/integrations/simplefin/settings', { autoSync: false }));
    await answer(BankSyncStatus, call('post', '/integrations/simplefin/accounts/refresh'));
    const synced = await answer(BankSyncResult, call('post', '/integrations/simplefin/sync'));
    expect(synced.imported).toBe(2);
    await answer(IntegrationDisconnected, call('delete', '/integrations/simplefin'));
  });

  it('workspace service settings: SMTP, app URL, Telegram bot, local categorization', async () => {
    const smtp = await answer(
      IntegrationConnection,
      call('put', '/settings/email/smtp', { host: '1.1.1.1', port: 587, from: 'member-1@example.com', pass: 'smtp-pass' }),
    );
    expect(smtp.settings).toMatchObject({ host: '1.1.1.1', passConfigured: true });
    await answer(IntegrationConnection, call('get', '/settings/email/smtp'));
    await answer(IntegrationDisconnected, call('delete', '/settings/email/smtp'));

    const appUrl = await answer(IntegrationConnection, call('put', '/settings/app', { publicUrl: 'https://app.example.com' }));
    expect(appUrl.settings).toMatchObject({ publicUrl: 'https://app.example.com' });
    await answer(IntegrationConnection, call('get', '/settings/app'));
    await answer(IntegrationDisconnected, call('delete', '/settings/app'));

    const bot = await answer(
      TelegramBotStatus,
      call('put', '/settings/notifications/telegram', { botToken: '123456:own-bot-token', timeoutMs: 5000 }),
    );
    expect(bot.settings.botTokenConfigured).toBe(true);
    await answer(IntegrationDisconnected, call('delete', '/settings/notifications/telegram'));

    const local = await answer(LocalCategorizationStatus, call('put', '/settings/local-categorization', { threshold: 0.5 }));
    expect(local.settings.threshold).toBe(0.5);
    const tried = await answer(
      LocalCategorizationTestResult,
      call('post', '/settings/local-categorization/test', { merchantName: 'ACME Store - Wireless Buds' }),
    );
    expect(tried.merchantName).toBe('ACME Store - Wireless Buds');
  }, 60_000);

  it('a Telegram report sent to the connected chat', async () => {
    await dataSource.query('UPDATE users SET telegram_chat_id = $1 WHERE id = $2', ['4242', owner.userId]);
    const sent = await answer(TelegramReportSent, call('post', '/telegram/send-report', { reportType: 'daily' }));
    expect(sent).toMatchObject({ status: 'sent', report: { chatId: '4242', status: 'sent' } });
    expect(sent.report).not.toHaveProperty('userId');
  });

  it('push subscriptions, a backup run and exchange rates', async () => {
    const device = await answer(
      PushSubscriptionCreated,
      call('post', '/push/subscriptions', {
        endpoint: 'https://93.184.215.14/push/member-1',
        keys: { p256dh: 'BPd', auth: 'auth' },
        userAgent: 'Phone',
      }),
    );
    const devices = await answer(PushSubscriptionList, call('get', '/push/subscriptions'));
    expect(devices).toEqual([expect.objectContaining({ id: device.id, userAgent: 'Phone' })]);

    await call('put', '/backups/config', { destinationKind: 'local', password: 'integ-backup-pass' }).expect(200);
    const run = await answer(BackupRun, call('post', '/backups/runs'));
    expect(run.status).toBe('succeeded');

    const manual = await answer(
      ManualExchangeRate,
      call('post', '/exchange-rates/manual', { from: 'EUR', to: 'USD', rate: 1.25, date: '2026-10-01' }),
    );
    expect(manual).toEqual({ from: 'EUR', to: 'USD', rate: 1.25, rateDate: '2026-10-01' });
    const converted = await answer(
      BulkConversion,
      call('post', '/exchange-rates/convert', {
        items: [{ amount: 10, currency: 'EUR', date: '2026-10-01' }],
        targetCurrency: 'USD',
      }),
    );
    expect(converted.results[0].converted).toBeCloseTo(12.5);
  });
});
