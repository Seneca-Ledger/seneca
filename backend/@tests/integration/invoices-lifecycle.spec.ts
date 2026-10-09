/**
 * Integration test — an invoice's status, against a real Postgres.
 *
 * 'paid' and 'overdue' are not stored on the invoice: they live on the
 * receivable the send opened, and the list derives them in SQL. Only a real
 * database shows whether the filter, the row and the void guard agree about
 * what a settled invoice is.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client as PgClient } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  Client,
  Invoice,
  InvoiceDelivery,
  InvoiceDeliveryStatus,
  InvoiceSettings,
  InvoiceStatus,
  Payable,
  PayableStatus,
  TaxRate,
  User,
  Workspace,
} from '../../src/entities';
import { BusinessProfileService } from '../../src/modules/business-profile/business-profile.service';
import { InvoiceDeliveryService } from '../../src/modules/invoices/invoice-delivery.service';
import { InvoiceAgeingService } from '../../src/modules/invoices/invoice-ageing.service';
import { InvoiceRemindersService } from '../../src/modules/invoices/invoice-reminders.service';
import { InvoiceSettingsService } from '../../src/modules/invoices/invoice-settings.service';
import { PublicInvoicesService } from '../../src/modules/invoices/public-invoices.service';
import { MailerService } from '../../src/modules/mailer/mailer.service';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL = process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_invoices_lifecycle_${process.pid}`;

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

describe('invoice status (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let invoices: InvoicesService;
  let deliveries: InvoiceDeliveryService;
  let publicInvoices: PublicInvoicesService;
  let reminders: InvoiceRemindersService;
  let invoiceSettings: InvoiceSettingsService;
  let ageing: InvoiceAgeingService;
  let deliveryRepo: Repository<InvoiceDelivery>;
  let sendMail: jest.Mock;
  let invoiceRepo: Repository<Invoice>;
  let payableRepo: Repository<Payable>;
  let workspaceId: string;
  let userId: string;
  let clientId: string;
  let vatRateId: string;
  let reverseChargeRateId: string;

  async function errorOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      const http = error as HttpException;
      return { status: http.getStatus(), code: (http.getResponse() as { code?: string }).code };
    }
    return null;
  }

  /** A sent invoice and the receivable it opened. */
  async function sentInvoice(amount = 100): Promise<{ invoice: Invoice; payable: Payable }> {
    const draft = await invoices.create(workspaceId, {
      clientId,
      issueDate: '2026-03-01',
      dueDate: '2026-03-15',
      lineItems: [{ description: 'Consulting', quantity: 1, unitPrice: amount }],
    });
    const invoice = await invoices.send(draft.id, workspaceId, userId);
    const payable = await payableRepo.findOneByOrFail({ id: invoice.payableId as string });
    return { invoice, payable };
  }

  beforeAll(async () => {
    const admin = new PgClient({ connectionString: scratchUrl('postgres') });
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvoicesService,
        InvoiceDeliveryService,
        InvoiceRemindersService,
        InvoiceSettingsService,
        InvoiceAgeingService,
        PublicInvoicesService,
        BusinessProfileService,
        WorkspaceCurrencyService,
        { provide: MailerService, useValue: { send: (sendMail = jest.fn(async () => true)) } },
        LedgerPostingService,
        LedgerAccountsService,
        { provide: ExchangeRatesService, useValue: { getRateQuote: jest.fn(), getRate: jest.fn() } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    invoices = moduleRef.get(InvoicesService);
    deliveries = moduleRef.get(InvoiceDeliveryService);
    publicInvoices = moduleRef.get(PublicInvoicesService);
    reminders = moduleRef.get(InvoiceRemindersService);
    invoiceSettings = moduleRef.get(InvoiceSettingsService);
    ageing = moduleRef.get(InvoiceAgeingService);
    deliveryRepo = dataSource.getRepository(InvoiceDelivery);
    invoiceRepo = dataSource.getRepository(Invoice);
    payableRepo = dataSource.getRepository(Payable);

    // No ledger base currency: invoicing works whether or not the workspace
    // opted into double-entry, and this spec is about the status.
    workspaceId = (await dataSource.getRepository(Workspace).save({ name: 'Inv WS', currency: 'EUR' }))
      .id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `inv-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Invoice Tester',
          workspaceId,
        }),
      )
    ).id;
    clientId = (
      await dataSource
        .getRepository(Client)
        .save({
          workspaceId,
          name: 'Beta GmbH',
          currency: 'EUR',
          locale: 'de',
          email: 'billing@beta.test',
        })
    ).id;
    // Sending refuses without the issuer's details, which is the point of the
    // profile; every status case below needs a sendable workspace.
    await moduleRef.get(BusinessProfileService).update(workspaceId, {
      legalName: 'Lumio Software OÜ',
      addressLines: 'Tartu mnt 67\n10115 Tallinn',
      registrationId: '16123456',
      taxId: 'EE102345678',
      bankName: 'LHV Pank',
      bankAccount: 'EE471000001020145685',
      bankCode: 'LHVBEE22',
      invoiceFooter: 'Thank you for your business.',
    });
    const taxRates = dataSource.getRepository(TaxRate);
    // `isInclusive` on the rate is about amounts read from gross documents; an
    // invoice says which way its own prices are quoted, so the rate here is
    // only the percentage and the reverse-charge flag.
    vatRateId = (
      await taxRates.save(taxRates.create({ workspaceId, name: 'VAT 12%', rate: 12 }))
    ).id;
    reverseChargeRateId = (
      await taxRates.save(
        taxRates.create({ workspaceId, name: 'EU reverse charge', rate: 20, isReverseCharge: true }),
      )
    ).id;
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new PgClient({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  afterEach(async () => {
    sendMail.mockReset();
    sendMail.mockImplementation(async () => true);
    await dataSource.query('DELETE FROM "invoice_deliveries"');
    await dataSource.query('DELETE FROM "invoice_settings"');
    // The fixture client is shared: a test that silenced it must not leave it
    // silenced for the next one.
    await dataSource.query(
      'UPDATE "clients" SET "reminders_enabled" = true, "payment_terms_days" = NULL',
    );
    await dataSource.query('DELETE FROM "invoice_line_items"');
    await dataSource.query('DELETE FROM "invoices"');
    await dataSource.query('DELETE FROM "payables"');
  });

  it('takes a draft to sent, with the receivable it opened', async () => {
    const { invoice, payable } = await sentInvoice();

    expect(invoice.status).toBe(InvoiceStatus.SENT);
    expect(invoice.invoiceNumber).toMatch(/^INV-\d+$/);
    expect(Number(invoice.total)).toBe(100);
    expect(payable.status).toBe(PayableStatus.TO_PAY);
    expect(Number(payable.amount)).toBe(100);
  });

  it('reads as paid once the receivable is settled, and is filterable as paid', async () => {
    const { invoice, payable } = await sentInvoice();
    await payableRepo.update({ id: payable.id }, { status: PayableStatus.PAID });

    expect((await invoices.findOne(invoice.id, workspaceId)).status).toBe(InvoiceStatus.PAID);

    const paid = await invoices.findAll(workspaceId, { status: InvoiceStatus.PAID });
    expect(paid.total).toBe(1);
    expect(paid.data[0]?.id).toBe(invoice.id);
    expect(paid.data[0]?.status).toBe(InvoiceStatus.PAID);

    // The stored column still says 'sent', which is exactly why the filter
    // cannot be built on it.
    expect((await invoiceRepo.findOneByOrFail({ id: invoice.id })).status).toBe(InvoiceStatus.SENT);
    const sent = await invoices.findAll(workspaceId, { status: InvoiceStatus.SENT });
    expect(sent.total).toBe(0);
  });

  it('reads as overdue while the receivable is overdue', async () => {
    const { invoice, payable } = await sentInvoice();
    await payableRepo.update({ id: payable.id }, { status: PayableStatus.OVERDUE });

    expect((await invoices.findOne(invoice.id, workspaceId)).status).toBe(InvoiceStatus.OVERDUE);
    const overdue = await invoices.findAll(workspaceId, { status: InvoiceStatus.OVERDUE });
    expect(overdue.total).toBe(1);
  });

  it('keeps a draft and a void invoice on their own status', async () => {
    const draft = await invoices.create(workspaceId, {
      clientId,
      issueDate: '2026-03-01',
      dueDate: '2026-03-15',
      lineItems: [{ description: 'Retainer', quantity: 1, unitPrice: 50 }],
    });
    const { invoice, payable } = await sentInvoice();
    await invoices.void(invoice.id, workspaceId, userId);
    // An archived receivable must not read back as anything but void.
    expect(
      (await payableRepo.findOneByOrFail({ id: payable.id })).status,
    ).toBe(PayableStatus.ARCHIVED);

    const drafts = await invoices.findAll(workspaceId, { status: InvoiceStatus.DRAFT });
    expect(drafts.data.map(row => row.id)).toEqual([draft.id]);

    const voided = await invoices.findAll(workspaceId, { status: InvoiceStatus.VOID });
    expect(voided.data.map(row => row.id)).toEqual([invoice.id]);
  });

  it('refuses to void an invoice whose receivable is already paid', async () => {
    const { invoice, payable } = await sentInvoice();
    await payableRepo.update({ id: payable.id }, { status: PayableStatus.PAID });

    expect(await errorOf(invoices.void(invoice.id, workspaceId, userId))).toEqual({
      status: 409,
      code: 'INVOICE_NOT_VOIDABLE',
    });
    expect((await invoiceRepo.findOneByOrFail({ id: invoice.id })).status).toBe(InvoiceStatus.SENT);
    expect((await payableRepo.findOneByOrFail({ id: payable.id })).status).toBe(PayableStatus.PAID);
  });

  it('numbers invoices without gaps, and leaves an abandoned draft unnumbered', async () => {
    const abandoned = await invoices.create(workspaceId, {
      clientId,
      issueDate: '2026-03-01',
      dueDate: '2026-03-15',
      lineItems: [{ description: 'Never sent', quantity: 1, unitPrice: 10 }],
    });
    const first = await sentInvoice(10);
    const second = await sentInvoice(20);

    expect(abandoned.invoiceNumber).toBeNull();
    const numbers = [first.invoice.invoiceNumber, second.invoice.invoiceNumber].map(value =>
      Number(String(value).replace('INV-', '')),
    );
    expect(numbers[1]).toBe(numbers[0] + 1);
  });
  describe('tax on the lines', () => {
    const draft = (fields: Record<string, unknown>) =>
      invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        ...fields,
      } as never);

    it('adds tax on top of a net price', async () => {
      const invoice = await draft({
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 100, taxRateId: vatRateId }],
      });

      expect(Number(invoice.subtotal)).toBe(100);
      expect(Number(invoice.taxTotal)).toBe(12);
      expect(Number(invoice.total)).toBe(112);
    });

    it('extracts tax from a price that already contains it', async () => {
      const invoice = await draft({
        pricesIncludeTax: true,
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 112, taxRateId: vatRateId }],
      });

      expect(Number(invoice.subtotal)).toBe(100);
      expect(Number(invoice.taxTotal)).toBe(12);
      expect(Number(invoice.total)).toBe(112);
    });

    it('charges no tax on a reverse-charged line', async () => {
      const invoice = await draft({
        lineItems: [
          { description: 'Consulting', quantity: 2, unitPrice: 500, taxRateId: reverseChargeRateId },
        ],
      });

      expect(Number(invoice.subtotal)).toBe(1000);
      expect(Number(invoice.taxTotal)).toBe(0);
      expect(Number(invoice.total)).toBe(1000);
    });

    it('leaves an untaxed line alone even when prices include tax', async () => {
      const invoice = await draft({
        pricesIncludeTax: true,
        lineItems: [{ description: 'Disbursement', quantity: 1, unitPrice: 40 }],
      });

      expect(Number(invoice.subtotal)).toBe(40);
      expect(Number(invoice.taxTotal)).toBe(0);
      expect(Number(invoice.total)).toBe(40);
    });

    it('keeps net + tax equal to the total across many lines', async () => {
      const invoice = await draft({
        pricesIncludeTax: true,
        lineItems: Array.from({ length: 7 }, (_, index) => ({
          description: `Item ${index + 1}`,
          quantity: 3,
          unitPrice: 33.33,
          taxRateId: vatRateId,
        })),
      });

      expect(Number(invoice.subtotal) + Number(invoice.taxTotal)).toBeCloseTo(
        Number(invoice.total),
        2,
      );
      expect(Number(invoice.total)).toBeCloseTo(699.93, 2);
    });
  });

  describe('emailing it to the client', () => {
    it('attaches the pdf, writes the log and uses the workspace smtp', async () => {
      const { invoice } = await sentInvoice();

      const delivery = await deliveries.sendEmail(invoice.id, workspaceId, { id: userId } as never);

      expect(delivery.status).toBe(InvoiceDeliveryStatus.SENT);
      expect(delivery.recipient).toBe('billing@beta.test');
      expect(sendMail).toHaveBeenCalledTimes(1);
      const sent = sendMail.mock.calls[0][0];
      expect(sent.to).toBe('billing@beta.test');
      // The invoice's workspace, not the sender's home one: a different
      // workspace would mean a different mail server.
      expect(sent.workspaceId).toBe(workspaceId);
      expect(sent.subject).toContain(invoice.invoiceNumber);
      expect(sent.attachments).toHaveLength(1);
      expect(sent.attachments[0].filename).toBe(`${invoice.invoiceNumber}.pdf`);
      expect(sent.attachments[0].content.subarray(0, 4).toString()).toBe('%PDF');

      const history = await deliveries.history(invoice.id, workspaceId);
      expect(history.map(row => row.status)).toEqual([InvoiceDeliveryStatus.SENT]);
    });

    it('sends to an address given for this one send', async () => {
      const { invoice } = await sentInvoice();

      const delivery = await deliveries.sendEmail(invoice.id, workspaceId, { id: userId } as never, {
        to: 'ap@beta.test',
        subject: 'Our invoice',
        message: 'As agreed.',
      });

      expect(delivery.recipient).toBe('ap@beta.test');
      expect(sendMail.mock.calls[0][0]).toMatchObject({
        to: 'ap@beta.test',
        subject: 'Our invoice',
        text: 'As agreed.',
      });
    });

    it('records a refusal from the mail server instead of reporting success', async () => {
      const { invoice } = await sentInvoice();
      sendMail.mockRejectedValueOnce(new Error('550 mailbox unavailable'));

      const delivery = await deliveries.sendEmail(invoice.id, workspaceId, { id: userId } as never);

      expect(delivery.status).toBe(InvoiceDeliveryStatus.FAILED);
      expect(delivery.error).toContain('550 mailbox unavailable');
      expect(await deliveryRepo.count({ where: { invoiceId: invoice.id } })).toBe(1);
    });

    it('records an unconfigured mail server as skipped, not sent', async () => {
      const { invoice } = await sentInvoice();
      sendMail.mockResolvedValueOnce(false);

      const delivery = await deliveries.sendEmail(invoice.id, workspaceId, { id: userId } as never);

      expect(delivery.status).toBe(InvoiceDeliveryStatus.SKIPPED);
      expect(delivery.error).toBeNull();
    });

    it('can be repeated, and keeps every attempt', async () => {
      const { invoice } = await sentInvoice();

      await deliveries.sendEmail(invoice.id, workspaceId, { id: userId } as never);
      sendMail.mockRejectedValueOnce(new Error('timeout'));
      await deliveries.sendEmail(invoice.id, workspaceId, { id: userId } as never);
      await deliveries.sendEmail(invoice.id, workspaceId, { id: userId } as never);

      const history = await deliveries.history(invoice.id, workspaceId);
      expect(history).toHaveLength(3);
      expect(history.filter(row => row.status === InvoiceDeliveryStatus.FAILED)).toHaveLength(1);
    });

    it('refuses a draft: there is no number and no document yet', async () => {
      const draft = await invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 10 }],
      });

      expect(
        await errorOf(deliveries.sendEmail(draft.id, workspaceId, { id: userId } as never)),
      ).toEqual({ status: 400, code: 'INVOICE_NOT_SENT_YET' });
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('refuses when neither the client nor the request names an address', async () => {
      const silent = (
        await dataSource.getRepository(Client).save({
          workspaceId,
          name: 'No Mail Ltd',
          currency: 'EUR',
        })
      ).id;
      const draft = await invoices.create(workspaceId, {
        clientId: silent,
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 10 }],
      });
      const invoice = await invoices.send(draft.id, workspaceId, userId);

      expect(
        await errorOf(deliveries.sendEmail(invoice.id, workspaceId, { id: userId } as never)),
      ).toEqual({ status: 400, code: 'INVOICE_NO_RECIPIENT' });
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('the link the client opens', () => {
    it('mints a token at send, and not before', async () => {
      const draft = await invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 10 }],
      });
      expect(draft.shareToken).toBeNull();

      const { invoice } = await sentInvoice();
      expect(invoice.shareToken).toMatch(/^[\w-]{32}$/);
    });

    it('shows the issuer, the client and the lines, and nothing internal', async () => {
      const { invoice } = await sentInvoice(250);

      const view = await publicInvoices.view(invoice.shareToken as string);

      expect(view.number).toBe(invoice.invoiceNumber);
      expect(view.status).toBe('sent');
      expect(view.total).toBe('250.00');
      expect(view.issuer.legalName).toBe('Lumio Software OÜ');
      expect(view.issuer.bankAccount).toBe('EE471000001020145685');
      expect(view.billedTo.name).toBe('Beta GmbH');
      expect(view.lines).toEqual([
        { description: 'Consulting', quantity: '1.00', unitPrice: '250.00', amount: '250' },
      ]);
      // Nothing the client has no business seeing.
      const serialized = JSON.stringify(view);
      expect(serialized).not.toContain(workspaceId);
      expect(serialized).not.toContain(invoice.id);
      expect(serialized).not.toContain(clientId);
    });

    it('marks the first open and counts the rest', async () => {
      const { invoice } = await sentInvoice();
      expect(invoice.viewedAt).toBeNull();

      await publicInvoices.view(invoice.shareToken as string);
      const afterFirst = await invoiceRepo.findOneByOrFail({ id: invoice.id });
      expect(afterFirst.viewedAt).toBeInstanceOf(Date);
      expect(afterFirst.viewCount).toBe(1);

      await publicInvoices.view(invoice.shareToken as string);
      const afterSecond = await invoiceRepo.findOneByOrFail({ id: invoice.id });
      expect(afterSecond.viewCount).toBe(2);
      // The first open is the one that matters, so it is not overwritten.
      expect(afterSecond.viewedAt?.getTime()).toBe(afterFirst.viewedAt?.getTime());
    });

    it('serves the stored pdf', async () => {
      const { invoice } = await sentInvoice();

      const pdf = await publicInvoices.pdf(invoice.shareToken as string);

      expect(pdf.fileName).toBe(`${invoice.invoiceNumber}.pdf`);
      expect(pdf.data.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('reports paid once the receivable is settled', async () => {
      const { invoice, payable } = await sentInvoice();
      await payableRepo.update({ id: payable.id }, { status: PayableStatus.PAID });

      expect((await publicInvoices.view(invoice.shareToken as string)).status).toBe('paid');
    });

    it('stops working when the invoice is withdrawn', async () => {
      const { invoice } = await sentInvoice();
      const token = invoice.shareToken as string;
      await invoices.void(invoice.id, workspaceId, userId);

      expect(await errorOf(publicInvoices.view(token))).toEqual({
        status: 404,
        code: undefined,
      });
      expect(await errorOf(publicInvoices.pdf(token))).toEqual({ status: 404, code: undefined });
    });

    it('does not answer an unknown token', async () => {
      expect(await errorOf(publicInvoices.view('not-a-real-token'))).toEqual({
        status: 404,
        code: undefined,
      });
    });
  });

  describe('reminders', () => {
    /** An invoice due `days` ago (negative: still to come). */
    async function invoiceDue(days: number) {
      const due = new Date();
      due.setUTCDate(due.getUTCDate() - days);
      const dueDate = due.toISOString().slice(0, 10);
      const draft = await invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-01-01',
        dueDate,
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 100 }],
      });
      return invoices.send(draft.id, workspaceId, userId);
    }

    const settingsFor = async (reminderOffsets: number[], remindersEnabled = true) => {
      await invoiceSettings.update(workspaceId, { remindersEnabled, reminderOffsets });
      return dataSource
        .getRepository(InvoiceSettings)
        .findOneByOrFail({ workspaceId });
    };

    it('is off until the workspace turns it on', async () => {
      expect(await invoiceSettings.get(workspaceId)).toEqual({
        remindersEnabled: false,
        reminderOffsets: [-3, 0, 7, 14],
        paymentTermsDays: 14,
        lateFeePercent: 0,
      });
    });

    it('keeps the offsets sorted, whole and unique', async () => {
      const saved = await invoiceSettings.update(workspaceId, {
        remindersEnabled: true,
        reminderOffsets: [14, 0, 14, -3, 1.5, 10_000] as number[],
      });

      expect(saved).toMatchObject({ remindersEnabled: true, reminderOffsets: [-3, 0, 14] });
    });

    it('sends the reminder whose offset matches today, once', async () => {
      const invoice = await invoiceDue(7);
      const settings = await settingsFor([-3, 0, 7]);

      const first = await reminders.runForWorkspace(settings as never);
      expect(first).toHaveLength(1);
      expect(first[0].reminderOffset).toBe(7);
      expect(sendMail.mock.calls[0][0].subject).toContain('Erinnerung');
      expect(sendMail.mock.calls[0][0].text).toContain('noch nicht bezahlt');

      // Running again the same day must not mail the client twice.
      const second = await reminders.runForWorkspace(settings as never);
      expect(second).toHaveLength(0);
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('says "is due" before the due date and "was due" after it', async () => {
      const settings = await settingsFor([-3, 7]);
      await invoiceDue(-3);

      await reminders.runForWorkspace(settings as never);

      expect(sendMail.mock.calls[0][0].text).toContain('ist am');
      expect(sendMail.mock.calls[0][0].text).not.toContain('noch nicht bezahlt');
    });

    it('leaves out a day no offset matches', async () => {
      const settings = await settingsFor([0, 14]);
      await invoiceDue(5);

      expect(await reminders.runForWorkspace(settings as never)).toHaveLength(0);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('leaves a settled invoice alone', async () => {
      const invoice = await invoiceDue(7);
      const settings = await settingsFor([7]);
      await payableRepo.update({ id: invoice.payableId as string }, { status: PayableStatus.PAID });

      expect(await reminders.runForWorkspace(settings as never)).toHaveLength(0);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('leaves out a client who is not to be chased', async () => {
      await invoiceDue(7);
      const settings = await settingsFor([7]);
      await dataSource
        .getRepository(Client)
        .update({ id: clientId }, { remindersEnabled: false });

      expect(await reminders.runForWorkspace(settings as never)).toHaveLength(0);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('keeps going when one invoice cannot be mailed', async () => {
      await invoiceDue(7);
      await invoiceDue(7);
      const settings = await settingsFor([7]);
      sendMail.mockRejectedValueOnce(new Error('mailbox full'));

      const sent = await reminders.runForWorkspace(settings as never);

      // Both attempts are logged; the failure is a row, not a lost reminder.
      expect(sent).toHaveLength(2);
      expect(sent.filter(row => row.status === 'failed')).toHaveLength(1);
      expect(sent.filter(row => row.status === 'sent')).toHaveLength(1);
    });
  });

  describe('payment terms', () => {
    const addDays = (from: string, days: number): string => {
      const date = new Date(`${from}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };

    it("derives the due date from the workspace's own term", async () => {
      await invoiceSettings.update(workspaceId, { paymentTermsDays: 30 });

      const draft = await invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-03-01',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 10 }],
      } as never);

      expect(draft.dueDate).toBe('2026-03-31');
    });

    it("prefers the client's own term", async () => {
      await invoiceSettings.update(workspaceId, { paymentTermsDays: 30 });
      await dataSource.getRepository(Client).update({ id: clientId }, { paymentTermsDays: 7 });

      const draft = await invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-03-01',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 10 }],
      } as never);

      expect(draft.dueDate).toBe('2026-03-08');
    });

    it('still takes a due date the invoice names itself', async () => {
      await invoiceSettings.update(workspaceId, { paymentTermsDays: 30 });

      const draft = await invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-03-01',
        dueDate: '2026-03-05',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 10 }],
      });

      expect(draft.dueDate).toBe('2026-03-05');
    });

    it('defaults to net 14 when nothing is configured', async () => {
      const issueDate = '2026-03-01';
      const draft = await invoices.create(workspaceId, {
        clientId,
        issueDate,
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 10 }],
      } as never);

      expect(draft.dueDate).toBe(addDays(issueDate, 14));
    });
  });

  describe('receivables ageing', () => {
    /** A sent invoice due `days` ago, for the given amount. */
    async function overdue(days: number, amount: number, currency = 'EUR') {
      const due = new Date();
      due.setUTCDate(due.getUTCDate() - days);
      const draft = await invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-01-01',
        dueDate: due.toISOString().slice(0, 10),
        currency,
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: amount }],
      });
      return invoices.send(draft.id, workspaceId, userId);
    }

    it('buckets by age and counts the invoices', async () => {
      await overdue(-5, 100); // not due yet
      await overdue(10, 200);
      await overdue(45, 300);
      await overdue(75, 400);
      await overdue(120, 500);

      const { rows, totals } = await ageing.report(workspaceId);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        clientName: 'Beta GmbH',
        currency: 'EUR',
        current: 100,
        days1to30: 200,
        days31to60: 300,
        days61to90: 400,
        days90plus: 500,
        total: 1500,
        count: 5,
        oldestDays: 120,
      });
      expect(totals).toEqual([expect.objectContaining({ currency: 'EUR', total: 1500 })]);
    });

    it('keeps currencies apart rather than adding them up', async () => {
      await overdue(10, 100, 'EUR');
      await overdue(10, 200, 'USD');

      const { rows, totals } = await ageing.report(workspaceId);

      expect(rows.map(row => [row.currency, row.total])).toEqual(
        expect.arrayContaining([
          ['USD', 200],
          ['EUR', 100],
        ]),
      );
      expect(totals).toHaveLength(2);
    });

    it('drops a settled invoice and a void one', async () => {
      const paid = await overdue(10, 100);
      const voided = await overdue(20, 700);
      await payableRepo.update({ id: paid.payableId as string }, { status: PayableStatus.PAID });
      await invoices.void(voided.id, workspaceId, userId);
      await overdue(30, 50);

      const { rows } = await ageing.report(workspaceId);

      expect(rows).toHaveLength(1);
      expect(rows[0].total).toBe(50);
    });

    it('ignores a draft, which nobody owes yet', async () => {
      await invoices.create(workspaceId, {
        clientId,
        issueDate: '2026-01-01',
        dueDate: '2026-01-15',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 999 }],
      });

      expect(await ageing.report(workspaceId)).toEqual({ rows: [], totals: [] });
    });

    it('computes the late fee from what is actually overdue', async () => {
      await overdue(-5, 1000); // not due: not part of the base
      await overdue(10, 400);
      await overdue(100, 600);

      const base = await ageing.overdueByCurrency(workspaceId, clientId);

      expect(base).toEqual([{ currency: 'EUR', amount: 1000 }]);
    });
  });
});
