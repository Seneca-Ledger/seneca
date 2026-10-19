/**
 * Integration test — background jobs leave a past version alone, against a real Postgres.
 *
 * A past version (`workspaces.kind = 'version'`) is a copy of a workspace as it
 * was on a date: it holds the same recurring invoices, overdue payables,
 * trashed statements, schedules and reminders as the original. Each test here
 * gives the live workspace and a version the same due work, runs the job the
 * way its cron would, and checks that only the live workspace was touched.
 *
 * Jobs are built with only the collaborators their sweep reaches, by field
 * name: their constructors take a dozen dependencies the sweeps never use.
 * What a job does per workspace once it picked one (send the mail, parse the
 * file) is stubbed; what is under test is which workspaces it picks.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BackupConfiguration,
  CryptoWallet,
  CustomTableExportSchedule,
  Invoice,
  InvoiceLineItem,
  InvoiceSettings,
  Notification,
  NotificationCategory,
  NotificationPreference,
  NotificationType,
  Payable,
  PayableStatus,
  Payee,
  PeppolConnection,
  PeppolTransmission,
  ReportSchedule,
  Statement,
  StatementStatus,
  Subscription,
  User,
  Workspace,
  WorkspaceKind,
  WorkspaceMember,
} from '../../src/entities';
import { BackupSchedulerService } from '../../src/modules/backups/backup-scheduler.service';
import { CryptoSyncService } from '../../src/modules/crypto/crypto-sync.service';
import { CustomTableExportSchedulesService } from '../../src/modules/custom-tables/custom-table-export-schedules.service';
import { InvoiceRemindersService } from '../../src/modules/invoices/invoice-reminders.service';
import { InvoiceSettingsService } from '../../src/modules/invoices/invoice-settings.service';
import { InvoicesScheduler } from '../../src/modules/invoices/invoices.scheduler';
import { LedgerSyncService } from '../../src/modules/ledger/ledger-sync.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import {
  StaleStatementReaper,
  StatementParsingProcessor,
} from '../../src/modules/parsing/queue/statement-parsing.processor';
import { PayablesService } from '../../src/modules/payables/payables.service';
import { PayeesService } from '../../src/modules/payees/payees.service';
import { PeppolService } from '../../src/modules/peppol/peppol.service';
import { ReportSchedulesService } from '../../src/modules/reports/report-schedules.service';
import { ReviewInboxScheduler } from '../../src/modules/review-inbox/review-inbox.scheduler';
import { StorageTrashScheduler } from '../../src/modules/storage/storage-trash.scheduler';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { OfficialVatRatesService } from '../../src/modules/tax/official-vat-rates.service';
import { TaxThresholdService } from '../../src/modules/tax/tax-threshold.service';
import { TaxDeadlinesService } from '../../src/modules/tax-reminders/tax-deadlines.service';
import { TelegramService } from '../../src/modules/telegram/telegram.service';

const BASE_URL = process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_version_crons_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/** Loaded by hand: TypeORM's glob loader bypasses Jest's transform. */
function loadMigrations(): Function[] {
  const dir = path.resolve(__dirname, '../../src/migrations');
  return fs
    .readdirSync(dir)
    .filter(file => file.endsWith('.ts'))
    .sort()
    .flatMap(file =>
      Object.values(require(path.join(dir, file))).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
}

const quietLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

/** A job with only the named collaborators; see the header. */
function job<T extends object>(type: { prototype: T }, fields: Record<string, unknown>): T {
  return Object.assign(Object.create(type.prototype), { logger: quietLogger, ...fields });
}

const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe('background jobs leave a past version alone (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let standardId: string;
  let versionId: string;
  let userId: string;

  const repo = <T extends object>(entity: { new (): T }) => dataSource.getRepository(entity);

  /** Inserts one row by column name and returns it. */
  const insert = async (table: string, row: Record<string, unknown>) => {
    const columns = Object.keys(row);
    const [inserted] = await dataSource.query(
      `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(', ')})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
      columns.map(column => row[column]),
    );
    return inserted as Record<string, unknown> & { id: string };
  };

  /** The same due work in the live workspace and in the version. */
  const inBoth = async (make: (workspaceId: string) => Promise<{ id: string }>) => ({
    standard: (await make(standardId)).id,
    version: (await make(versionId)).id,
  });

  const statement = (workspaceId: string, fields: Record<string, unknown>) =>
    insert('statements', {
      user_id: userId,
      workspace_id: workspaceId,
      file_name: 'statement.pdf',
      file_path: `/tmp/${randomUUID()}.pdf`,
      file_type: 'pdf',
      file_size: 1,
      file_hash: randomUUID(),
      bank_name: 'other',
      currency: 'EUR',
      ...fields,
    });

  const invoice = async (workspaceId: string, fields: Record<string, unknown> = {}) => {
    const client = await insert('clients', {
      workspace_id: workspaceId,
      name: 'Acme',
      currency: 'EUR',
    });
    return insert('invoices', {
      workspace_id: workspaceId,
      client_id: client.id,
      issue_date: isoDay(-30),
      due_date: isoDay(-16),
      currency: 'EUR',
      ...fields,
    });
  };

  beforeAll(async () => {
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      url: scratchUrl(SCRATCH_DB),
      entities: ENTITIES,
      migrations: loadMigrations(),
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const [austria] = await dataSource.query(`SELECT id FROM tax_jurisdictions WHERE code = 'AT'`);
    const workspace = (name: string, kind: WorkspaceKind) =>
      repo(Workspace).save({
        name,
        currency: 'EUR',
        kind,
        taxJurisdictionId: austria.id,
        ledgerBaseCurrency: 'EUR',
      });
    standardId = (await workspace('Live', WorkspaceKind.STANDARD)).id;
    versionId = (await workspace('Live as of June', WorkspaceKind.VERSION)).id;

    userId = (
      await repo(User).save(
        repo(User).create({
          email: `versions-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Version Tester',
          workspaceId: standardId,
        }),
      )
    ).id;
    for (const workspaceId of [standardId, versionId]) {
      await repo(WorkspaceMember).save({ workspaceId, userId, role: 'owner' as never });
    }
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  beforeEach(() => jest.clearAllMocks());

  it('issues recurring invoices from the live workspace only', async () => {
    const templates = await inBoth(async workspaceId => {
      const template = await invoice(workspaceId, {
        is_recurring: true,
        recurrence_interval: 'monthly',
        next_issue_date: isoDay(-1),
      });
      await insert('invoice_line_items', {
        invoice_id: template.id,
        description: 'Retainer',
        quantity: 1,
        unit_price: 100,
      });
      return template;
    });
    const invoicesService = { cloneAsDraft: jest.fn(async () => undefined) };

    await new InvoicesScheduler(
      repo(Invoice),
      repo(InvoiceLineItem),
      invoicesService as never,
    ).generateRecurringInvoices();

    expect(invoicesService.cloneAsDraft).toHaveBeenCalledTimes(1);
    expect(invoicesService.cloneAsDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: templates.standard }),
      expect.anything(),
    );
    const version = await repo(Invoice).findOneByOrFail({ id: templates.version });
    expect(version.nextIssueDate).toBe(isoDay(-1));
  });

  it('chases clients about unpaid invoices of the live workspace only', async () => {
    await inBoth(workspaceId =>
      insert('invoice_settings', { workspace_id: workspaceId, reminders_enabled: true }).then(
        row => ({ id: String(row.workspace_id) }),
      ),
    );
    const reminders = job(InvoiceRemindersService, {
      settingsService: new InvoiceSettingsService(repo(InvoiceSettings)),
    });
    const runForWorkspace = jest.spyOn(reminders, 'runForWorkspace').mockResolvedValue([]);

    await reminders.sendDueReminders();

    expect(runForWorkspace.mock.calls.map(([settings]) => settings.workspaceId)).toEqual([
      standardId,
    ]);
  });

  it('marks payables overdue and finds due-soon ones in the live workspace only', async () => {
    const payable = (workspaceId: string, dueDate: string) =>
      insert('payables', {
        workspace_id: workspaceId,
        vendor: 'Landlord',
        amount: 500,
        currency: 'EUR',
        status: PayableStatus.TO_PAY,
        due_date: dueDate,
      });
    const overdue = await inBoth(workspaceId => payable(workspaceId, isoDay(-2)));
    const dueSoon = await inBoth(workspaceId => payable(workspaceId, isoDay(1)));
    const payables = job(PayablesService, { payableRepository: repo(Payable) });

    const marked = await payables.markOverduePayables();
    const soon = await payables.findDueSoonPayables(3);

    expect(marked.map(row => row.id)).toEqual([overdue.standard]);
    expect((await repo(Payable).findOneByOrFail({ id: overdue.version })).status).toBe(
      PayableStatus.TO_PAY,
    );
    expect(soon.map(row => row.id)).toEqual([dueSoon.standard]);
  });

  it('tells the members of the live workspace and no one about the version', async () => {
    const notifications = new NotificationsService(
      repo(Notification),
      repo(NotificationPreference),
      repo(User),
      repo(WorkspaceMember),
      { emit: jest.fn() } as never,
      { isDeferred: () => false, deliver: jest.fn(async () => []) } as never,
    );
    const payload = {
      type: NotificationType.PAYABLE_OVERDUE,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: 'payable.overdue' as const,
      messageParams: { vendor: 'Landlord', amount: '', dueDate: '' },
    };

    const toStandard = await notifications.createForWorkspaceMembers({
      ...payload,
      workspaceId: standardId,
    });
    const toVersion = await notifications.createForWorkspaceMembers({
      ...payload,
      workspaceId: versionId,
    });
    const direct = await notifications.create({
      ...payload,
      recipientId: userId,
      workspaceId: versionId,
    });

    expect(toStandard).toBe(1);
    expect(toVersion).toBe(0);
    expect(direct).toBeNull();
    expect(await repo(Notification).countBy({ workspaceId: standardId })).toBe(1);
    expect(await repo(Notification).countBy({ workspaceId: versionId })).toBe(0);
  });

  it('sends the weekly review digest for the live workspace only', async () => {
    const notifications = { createForWorkspaceMembers: jest.fn(async () => 1) };

    await new ReviewInboxScheduler(
      repo(Workspace),
      { counts: async () => ({ total: 2 }) } as never,
      notifications as never,
    ).notifyWaiting();

    expect(notifications.createForWorkspaceMembers).toHaveBeenCalledTimes(1);
    expect(notifications.createForWorkspaceMembers).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: standardId }),
    );
  });

  it('purges expired trash of the live workspace only', async () => {
    const trashed = await inBoth(workspaceId =>
      statement(workspaceId, { deleted_at: new Date(Date.now() - 90 * 86_400_000) }),
    );
    const statementsService = { remove: jest.fn(async () => undefined) };

    await new StorageTrashScheduler(
      repo(Statement),
      statementsService as never,
    ).purgeExpiredTrash();

    expect(statementsService.remove).toHaveBeenCalledTimes(1);
    expect(statementsService.remove).toHaveBeenCalledWith(trashed.standard, userId, standardId);
  });

  it('re-queues stale parsing in the live workspace only, and never parses a version statement', async () => {
    const stale = await inBoth(workspaceId =>
      statement(workspaceId, {
        status: StatementStatus.PROCESSING,
        updated_at: new Date(Date.now() - 86_400_000),
      }),
    );
    const queue = { enqueue: jest.fn(async () => undefined) };

    await new StaleStatementReaper(repo(Statement), queue as never).reap();

    expect(queue.enqueue.mock.calls).toEqual([[stale.standard]]);
    const version = await repo(Statement).findOneByOrFail({ id: stale.version });
    expect(version.status).toBe(StatementStatus.PROCESSING);

    const processing = { processStatement: jest.fn(async () => undefined) };
    await new StatementParsingProcessor(repo(Statement), processing as never).process({
      data: { statementId: stale.version },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as never);

    expect(processing.processStatement).not.toHaveBeenCalled();
    expect((await repo(Statement).findOneByOrFail({ id: stale.version })).parsingAttempts).toBe(
      version.parsingAttempts,
    );
  });

  it('finds ledger work in the live workspace only, and drops a job queued for a version', async () => {
    await inBoth(workspaceId =>
      insert('transactions', {
        workspace_id: workspaceId,
        transaction_date: isoDay(-3),
        counterparty_name: 'Shop',
        payment_purpose: 'Shop',
        currency: 'EUR',
        transaction_type: 'expense',
        amount: 10,
        debit: 10,
      }),
    );
    await dataSource.query(`UPDATE transactions SET ledger_dirty = true`);
    const ledger = job(LedgerSyncService, { workspaceRepository: repo(Workspace) });

    expect(await ledger.workspacesNeedingSync()).toEqual([standardId]);
    // Posting is not wired up here: a version that got past the guard would fail on it.
    expect(await ledger.syncWorkspace(versionId)).toEqual(
      expect.objectContaining({ enabled: false, processed: 0 }),
    );
  });

  it('checks tax thresholds, deadlines and official VAT rates for the live workspace only', async () => {
    await dataSource.query(`UPDATE workspaces SET vat_status = 'small_business'`);
    const threshold = job(TaxThresholdService, { workspaceRepository: repo(Workspace) });
    const checkWorkspace = jest.spyOn(threshold, 'checkWorkspace').mockResolvedValue(null);
    const deadlines = job(TaxDeadlinesService, { workspaceRepository: repo(Workspace) });
    const remindWorkspace = jest.spyOn(deadlines, 'remindWorkspace').mockResolvedValue(0);

    await threshold.checkAll();
    await deadlines.remindAll();

    expect(checkWorkspace.mock.calls.map(([id]) => id)).toEqual([standardId]);
    expect(remindWorkspace.mock.calls.map(([id]) => id)).toEqual([standardId]);

    await dataSource.query(`UPDATE workspaces SET vat_status = 'registered'`);
    const official = job(OfficialVatRatesService, { workspaceRepository: repo(Workspace) });
    const check = jest
      .spyOn(official, 'check')
      .mockResolvedValue({ country: 'AT', differences: [] } as never);
    jest.spyOn(official as never, 'announce').mockResolvedValue(undefined as never);

    await official.checkAll();

    expect(check.mock.calls.map(([id]) => id)).toEqual([standardId]);
  });

  it('runs report, export and backup schedules of the live workspace only', async () => {
    const reports = await inBoth(workspaceId =>
      insert('report_schedules', {
        workspace_id: workspaceId,
        user_id: userId,
        template_id: 'monthly-summary',
        format: 'pdf',
        cadence: 'monthly',
        next_run_at: new Date(Date.now() - 3_600_000),
      }),
    );
    const reportSchedules = job(ReportSchedulesService, {
      scheduleRepository: repo(ReportSchedule),
      userRepository: repo(User),
    });
    const runSchedule = jest
      .spyOn(reportSchedules as never, 'runSchedule')
      .mockResolvedValue(undefined as never);

    const { ran } = await reportSchedules.runDue();

    expect(ran).toBe(1);
    expect(runSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: reports.standard }),
      expect.anything(),
      expect.anything(),
    );
    const versionReport = await repo(ReportSchedule).findOneByOrFail({ id: reports.version });
    expect(versionReport.lastRunAt).toBeNull();

    const exports = await inBoth(async workspaceId => {
      const table = await insert('custom_tables', {
        user_id: userId,
        workspace_id: workspaceId,
        name: 'Clients',
      });
      return insert('custom_table_export_schedules', {
        table_id: table.id,
        workspace_id: workspaceId,
      });
    });
    const due = await job(CustomTableExportSchedulesService, {
      scheduleRepository: repo(CustomTableExportSchedule),
    }).findDueSchedules();
    expect(due.map(schedule => schedule.id)).toEqual([exports.standard]);

    const now = new Date();
    const dailyTime = now.toISOString().slice(11, 16);
    await inBoth(workspaceId =>
      insert('backup_configurations', {
        workspace_id: workspaceId,
        destination_kind: 'local',
        encrypted_data_key: 'x',
        password_envelope: '{}',
        daily_time: dailyTime,
        time_zone: 'UTC',
      }),
    );
    const backups = { runConfiguration: jest.fn(async () => undefined) };
    await new BackupSchedulerService(
      repo(BackupConfiguration),
      repo(Workspace),
      backups as never,
    ).runDueBackups(now);

    expect(backups.runConfiguration).toHaveBeenCalledTimes(1);
    expect(backups.runConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ id: standardId }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('keeps subscriptions of the version as they were copied, and announces only live charges', async () => {
    const subscription = (workspaceId: string, vendorName: string, nextChargeDate: string) =>
      insert('subscriptions', {
        workspace_id: workspaceId,
        vendor_name: vendorName,
        amount: 12,
        currency: 'EUR',
        frequency: 'monthly',
        status: 'active',
        next_charge_date: nextChargeDate,
      });
    await inBoth(workspaceId => subscription(workspaceId, 'Streaming', isoDay(1)));
    const pastDue = await inBoth(workspaceId => subscription(workspaceId, 'Cloud', isoDay(-5)));
    const notifications = { createForWorkspaceMembers: jest.fn(async () => 1) };
    const service = job(SubscriptionsService, {
      subscriptionRepository: repo(Subscription),
      notificationsService: notifications,
    });

    await service.checkUpcomingCharges();
    await service.updatePastDueNextDates();

    expect(notifications.createForWorkspaceMembers).toHaveBeenCalledTimes(1);
    expect(notifications.createForWorkspaceMembers).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: standardId }),
    );
    const version = await repo(Subscription).findOneByOrFail({ id: pastDue.version });
    expect(String(version.nextChargeDate).slice(0, 10)).toBe(isoDay(-5));
    const standard = await repo(Subscription).findOneByOrFail({ id: pastDue.standard });
    expect(String(standard.nextChargeDate).slice(0, 10)).not.toBe(isoDay(-5));
  });

  it('syncs wallets, re-asks VIES and talks to Peppol for the live workspace only', async () => {
    await inBoth(workspaceId =>
      insert('crypto_wallets', {
        workspace_id: workspaceId,
        chain_id: 1,
        address: `0x${randomUUID().replace(/-/g, '')}`,
      }),
    );
    const crypto = job(CryptoSyncService, { walletRepo: repo(CryptoWallet) });
    const syncWallet = jest.spyOn(crypto, 'syncWallet').mockResolvedValue({} as never);
    await crypto.syncAllWallets();
    expect(syncWallet.mock.calls.map(([wallet]) => wallet.workspaceId)).toEqual([standardId]);

    await inBoth(workspaceId =>
      insert('payees', {
        workspace_id: workspaceId,
        name: 'Supplier GmbH',
        vat_id: 'ATU12345678',
        country_code: 'AT',
      }),
    );
    const payees = job(PayeesService, { payeeRepository: repo(Payee) });
    const recheckVatId = jest
      .spyOn(payees, 'recheckVatId')
      .mockResolvedValue({ vatIdStatus: 'valid' } as never);
    await payees.recheckUnansweredVatIds();
    expect(recheckVatId.mock.calls.map(([workspaceId]) => workspaceId)).toEqual([standardId]);

    await inBoth(async workspaceId => {
      await insert('peppol_transmissions', {
        workspace_id: workspaceId,
        invoice_id: (await invoice(workspaceId)).id,
        recipient: '0208:0123456789',
        format: 'xrechnung',
        doc_type_id: 'invoice',
        status: 'pending',
        document_xml: '<Invoice/>',
        provider_document_id: randomUUID(),
      });
      return insert('peppol_connections', {
        workspace_id: workspaceId,
        api_key_id: 'key',
        api_secret: 'secret',
        company_id: 'company',
        sender_peppol_id: '0208:0987654321',
      });
    });
    const peppol = job(PeppolService, {
      transmissions: repo(PeppolTransmission),
      connections: repo(PeppolConnection),
    });
    const refreshWorkspace = jest
      .spyOn(peppol as never, 'refreshWorkspace')
      .mockResolvedValue(undefined as never);
    const poll = jest.spyOn(peppol, 'poll').mockResolvedValue({ imported: 0 });
    await peppol.refreshPending();
    await peppol.pollAll();
    expect((refreshWorkspace.mock.calls as unknown[][]).map(([id]) => id)).toEqual([standardId]);
    expect(poll.mock.calls.map(([id]) => id)).toEqual([standardId]);
  });

  it('never makes a version the Telegram bot workspace', async () => {
    const telegram = job(TelegramService, { workspaceMemberRepository: repo(WorkspaceMember) });
    const user = (telegramWorkspaceId: string) =>
      ({ id: userId, workspaceId: standardId, telegramWorkspaceId }) as User;

    expect(await telegram.resolveWorkspaceId(user(standardId))).toBe(standardId);
    expect(await telegram.resolveWorkspaceId(user(versionId))).toBeNull();
  });
});
