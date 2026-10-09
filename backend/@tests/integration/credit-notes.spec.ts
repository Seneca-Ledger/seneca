/**
 * Integration test — credit notes, against a real Postgres with the ledger on.
 *
 * A credit note touches four things at once: its own numbering, the lines and
 * their tax, the receivable the invoice opened, and the journal entry that
 * mirrors the invoice's accrual. Only a database shows whether all four agree.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import pdfParse from 'pdf-parse';
import { Client as PgClient } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  Client,
  CreditNote,
  CreditNoteStatus,
  Invoice,
  InvoiceStatus,
  JournalLine,
  Payable,
  PayableStatus,
  TaxRate,
  User,
  Workspace,
} from '../../src/entities';
import { BusinessProfileService } from '../../src/modules/business-profile/business-profile.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { CreditNotesService } from '../../src/modules/invoices/credit-notes.service';
import { InvoiceSettingsService } from '../../src/modules/invoices/invoice-settings.service';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PayablesService } from '../../src/modules/payables/payables.service';
import { PayablesExportService } from '../../src/modules/payables/payables-export.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL = process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_credit_notes_${process.pid}`;

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

describe('credit notes (real Postgres)', () => {
  jest.setTimeout(240_000);

  let dataSource: DataSource;
  let invoices: InvoicesService;
  let creditNotes: CreditNotesService;
  let payables: PayablesService;
  let payableRepo: Repository<Payable>;
  let noteRepo: Repository<CreditNote>;
  let profiles: BusinessProfileService;
  let workspaceId: string;
  let userId: string;
  let clientId: string;
  let otherClientId: string;
  let vatRateId: string;

  async function errorOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      const http = error as HttpException;
      return { status: http.getStatus(), code: (http.getResponse() as { code?: string }).code };
    }
    return null;
  }

  /** A sent invoice of `amount` plus 12% VAT, and the receivable it opened. */
  async function sentInvoice(
    amount: number,
    overrides: { clientId?: string; taxRateId?: string | null } = {},
  ): Promise<{ invoice: Invoice; payable: Payable }> {
    const draft = await invoices.create(workspaceId, {
      clientId: overrides.clientId ?? clientId,
      issueDate: '2026-03-01',
      dueDate: '2026-03-15',
      lineItems: [
        {
          description: 'Consulting',
          quantity: 1,
          unitPrice: amount,
          taxRateId: overrides.taxRateId === undefined ? vatRateId : (overrides.taxRateId ?? undefined),
        },
      ],
    });
    const invoice = await invoices.send(draft.id, workspaceId, userId);
    const payable = await payableRepo.findOneByOrFail({ id: invoice.payableId as string });
    return { invoice, payable };
  }

  /** Debits minus credits on the receivables account, in the base currency. */
  async function receivableBalance(): Promise<number> {
    const row: { balance: string } = (
      await dataSource.query(
        `SELECT COALESCE(SUM(line."base_debit") - SUM(line."base_credit"), 0)::text AS balance
           FROM "journal_lines" line
           JOIN "journal_entries" entry ON entry."id" = line."entry_id"
           JOIN "ledger_accounts" account ON account."id" = line."account_id"
          WHERE entry."workspace_id" = $1
            -- Same rule the ledger's own reports use: a reversed entry still
            -- stands in the books, beside the reversal that mirrors it.
            AND entry."status" <> 'draft'
            AND account."code" = 'ASSET_RECEIVABLES'`,
        [workspaceId],
      )
    )[0];
    return Number(row.balance);
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
        CreditNotesService,
        InvoiceSettingsService,
        BusinessProfileService,
        WorkspaceCurrencyService,
        PayablesService,
        PayablesExportService,
        LedgerPostingService,
        LedgerAccountsService,
        { provide: ExchangeRatesService, useValue: { getRateQuote: jest.fn(), getRate: jest.fn() } },
        { provide: NotificationsService, useValue: { createForWorkspaceMembers: jest.fn() } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    invoices = moduleRef.get(InvoicesService);
    creditNotes = moduleRef.get(CreditNotesService);
    payables = moduleRef.get(PayablesService);
    payableRepo = dataSource.getRepository(Payable);
    noteRepo = dataSource.getRepository(CreditNote);

    workspaceId = (
      await dataSource
        .getRepository(Workspace)
        .save({ name: 'Credit WS', currency: 'EUR', ledgerBaseCurrency: 'EUR' })
    ).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `credit-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Credit Tester',
          workspaceId,
        }),
      )
    ).id;
    const clients = dataSource.getRepository(Client);
    clientId = (
      await clients.save({ workspaceId, name: 'Beta GmbH', currency: 'EUR', locale: 'en' })
    ).id;
    otherClientId = (
      await clients.save({ workspaceId, name: 'Gamma Ltd', currency: 'EUR', locale: 'en' })
    ).id;
    profiles = moduleRef.get(BusinessProfileService);
    await profiles.update(workspaceId, {
      legalName: 'Lumio Software OÜ',
      addressLines: 'Tartu mnt 67\n10115 Tallinn',
      registrationId: '16123456',
      taxId: 'EE102345678',
    });
    vatRateId = (
      await dataSource
        .getRepository(TaxRate)
        .save(dataSource.getRepository(TaxRate).create({ workspaceId, name: 'VAT 12%', rate: 12 }))
    ).id;
    await moduleRef.get(LedgerAccountsService).systemAccountIds(workspaceId);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new PgClient({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM "credit_note_applications"');
    await dataSource.query('DELETE FROM "credit_note_line_items"');
    await dataSource.query('DELETE FROM "credit_notes"');
    await dataSource.query('DELETE FROM "invoice_line_items"');
    await dataSource.query('DELETE FROM "invoices"');
    await dataSource.query('DELETE FROM "payable_payments"');
    await dataSource.query('DELETE FROM "payables"');
    // A booked entry cannot be deleted while the ledger's guards are on, and
    // this scratch database is not the ledger's history: switch them off for
    // the wipe and back on for the next test.
    await dataSource.query('ALTER TABLE "journal_entries" DISABLE TRIGGER USER');
    await dataSource.query('ALTER TABLE "journal_lines" DISABLE TRIGGER USER');
    await dataSource.query('DELETE FROM "journal_lines"');
    await dataSource.query('DELETE FROM "journal_entries"');
    await dataSource.query('ALTER TABLE "journal_lines" ENABLE TRIGGER USER');
    await dataSource.query('ALTER TABLE "journal_entries" ENABLE TRIGGER USER');
  });

  it('credits a whole invoice: nothing is owed and the receivable is back to zero', async () => {
    const { invoice } = await sentInvoice(1000);
    expect(Number(invoice.total)).toBe(1120);
    expect(await receivableBalance()).toBe(1120);

    const note = await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: invoice.id }],
      reason: 'Project cancelled',
    });

    expect(note.creditNoteNumber).toMatch(/^CN-\d+$/);
    expect(Number(note.total)).toBe(1120);
    expect(Number(note.taxTotal)).toBe(120);
    // The accrual is undone: AR is flat and the revenue went back.
    expect(await receivableBalance()).toBe(0);

    const read = await invoices.findOne(invoice.id, workspaceId);
    expect(read.amountCredited).toBe(1120);
    expect(read.amountDue).toBe(0);
    const payable = await payableRepo.findOneByOrFail({ id: invoice.payableId as string });
    expect(Number(payable.amount)).toBe(0);
  });

  it('credits part of a part-paid invoice: what is left to pay falls', async () => {
    const { invoice, payable } = await sentInvoice(1000);
    await payables.addPayment(payable.id, workspaceId, userId, { amount: 500 });

    const note = await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: invoice.id, amount: 560 }],
    });

    expect(Number(note.total)).toBe(560);
    // Half the invoice, so half its tax comes back with it.
    expect(Number(note.taxTotal)).toBe(60);
    expect(await receivableBalance()).toBe(560);

    const read = await invoices.findOne(invoice.id, workspaceId);
    expect(read.amountPaid).toBe(500);
    expect(read.amountCredited).toBe(560);
    expect(read.amountDue).toBe(60);
    expect(read.status).toBe(InvoiceStatus.PARTIALLY_PAID);
  });

  it('closes a part-paid invoice when the credit covers the rest', async () => {
    const { invoice, payable } = await sentInvoice(1000);
    await payables.addPayment(payable.id, workspaceId, userId, { amount: 600 });

    await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: invoice.id, amount: 520 }],
    });

    const read = await invoices.findOne(invoice.id, workspaceId);
    expect(read.amountDue).toBe(0);
    // Nothing more is owed, so the invoice reads paid without another payment.
    expect(read.status).toBe(InvoiceStatus.PAID);
    const settled = await payableRepo.findOneByOrFail({ id: payable.id });
    expect(settled.status).toBe(PayableStatus.PAID);
    expect(Number(settled.amount)).toBe(600);
  });

  it('covers three invoices of one client with one note', async () => {
    const first = await sentInvoice(100, { taxRateId: null });
    const second = await sentInvoice(200, { taxRateId: null });
    const third = await sentInvoice(300, { taxRateId: null });

    const note = await creditNotes.create(workspaceId, userId, {
      applications: [
        { invoiceId: first.invoice.id },
        { invoiceId: second.invoice.id, amount: 50 },
        { invoiceId: third.invoice.id },
      ],
    });

    const full = await creditNotes.findOne(note.id, workspaceId);
    expect(Number(full.total)).toBe(450);
    expect(
      full.applications
        .map(application => Number(application.amount))
        .sort((left, right) => left - right),
    ).toEqual([50, 100, 300]);
    // Each line says which invoice it came off.
    expect(full.lineItems.map(line => line.description)).toEqual([
      `${first.invoice.invoiceNumber}: Consulting`,
      `${second.invoice.invoiceNumber}: Consulting`,
      `${third.invoice.invoiceNumber}: Consulting`,
    ]);
    expect((await invoices.findOne(second.invoice.id, workspaceId)).amountDue).toBe(150);
  });

  it('refuses more than the invoice can carry, twice over', async () => {
    const { invoice } = await sentInvoice(100, { taxRateId: null });

    expect(await errorOf(
      creditNotes.create(workspaceId, userId, {
        applications: [{ invoiceId: invoice.id, amount: 150 }],
      }),
    )).toEqual({ status: 400, code: 'CREDIT_NOTE_EXCEEDS_INVOICE' });

    await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: invoice.id, amount: 60 }],
    });
    // 40 left after the first note: a second one for the full amount is refused.
    expect(await errorOf(
      creditNotes.create(workspaceId, userId, {
        applications: [{ invoiceId: invoice.id, amount: 60 }],
      }),
    )).toEqual({ status: 400, code: 'CREDIT_NOTE_EXCEEDS_INVOICE' });

    await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: invoice.id }],
    });
    expect((await invoices.findOne(invoice.id, workspaceId)).amountDue).toBe(0);
  });

  it('refuses a draft invoice and a mix of clients', async () => {
    const draft = await invoices.create(workspaceId, {
      clientId,
      issueDate: '2026-03-01',
      dueDate: '2026-03-15',
      lineItems: [{ description: 'Consulting', quantity: 1, unitPrice: 10 }],
    });
    expect(await errorOf(
      creditNotes.create(workspaceId, userId, { applications: [{ invoiceId: draft.id }] }),
    )).toEqual({ status: 400, code: 'CREDIT_NOTE_INVOICE_NOT_CREDITABLE' });

    const mine = await sentInvoice(100, { taxRateId: null });
    const theirs = await sentInvoice(100, { clientId: otherClientId, taxRateId: null });
    expect(await errorOf(
      creditNotes.create(workspaceId, userId, {
        applications: [{ invoiceId: mine.invoice.id }, { invoiceId: theirs.invoice.id }],
      }),
    )).toEqual({ status: 400, code: 'CREDIT_NOTE_MIXED_CLIENTS' });
  });

  it('numbers credit notes in their own sequence', async () => {
    const first = await sentInvoice(100, { taxRateId: null });
    const second = await sentInvoice(100, { taxRateId: null });

    const one = await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: first.invoice.id }],
    });
    const two = await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: second.invoice.id }],
    });

    // Numbered from the credit-note counter, not from the invoice one: the two
    // sequences run side by side and each step is one.
    const numberOf = (note: CreditNote) => Number(note.creditNoteNumber?.replace('CN-', ''));
    expect(numberOf(two)).toBe(numberOf(one) + 1);
    expect(first.invoice.invoiceNumber).toMatch(/^INV-\d+$/);
  });

  it('voiding a note puts the money back on the invoice and reverses the entry', async () => {
    const { invoice } = await sentInvoice(1000);
    const note = await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: invoice.id }],
    });
    expect(await receivableBalance()).toBe(0);

    const voided = await creditNotes.void(note.id, workspaceId, userId);

    expect(voided.status).toBe(CreditNoteStatus.VOID);
    // The debt is back, and so is the accrual.
    expect(await receivableBalance()).toBe(1120);
    const read = await invoices.findOne(invoice.id, workspaceId);
    expect(read.amountCredited).toBe(0);
    expect(read.amountDue).toBe(1120);
    expect(await errorOf(creditNotes.void(note.id, workspaceId, userId))).toEqual({
      status: 409,
      code: 'CREDIT_NOTE_ALREADY_VOID',
    });
  });

  it('renders a document naming the invoice it credits', async () => {
    const { invoice } = await sentInvoice(1000);
    const note = await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: invoice.id }],
      reason: 'Goods returned',
    });

    const { fileName, data } = await creditNotes.getPdf(note.id, workspaceId);
    const text = (await pdfParse(data)).text;

    expect(fileName).toBe(`${note.creditNoteNumber}.pdf`);
    expect(text).toContain('Credit note');
    expect(text).toContain(String(note.creditNoteNumber));
    expect(text).toContain(`Credit for invoice ${invoice.invoiceNumber}`);
    expect(text).toContain('Goods returned');
    expect(text).toContain('1120.00 EUR');
  });

  it('books the mirror of the invoice: revenue and tax back, receivables down', async () => {
    const { invoice } = await sentInvoice(1000);
    const note = await creditNotes.create(workspaceId, userId, {
      applications: [{ invoiceId: invoice.id }],
    });

    const lines = await dataSource
      .getRepository(JournalLine)
      .find({ where: { entryId: note.journalEntryId as string }, order: { lineNo: 'ASC' } });
    const byAccount = await dataSource.query(
      `SELECT account."code", line."base_debit"::text AS debit, line."base_credit"::text AS credit
         FROM "journal_lines" line
         JOIN "ledger_accounts" account ON account."id" = line."account_id"
        WHERE line."entry_id" = $1
        ORDER BY account."code"`,
      [note.journalEntryId],
    );

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(byAccount).toEqual([
      // Receivables credited, revenue and VAT debited: the invoice undone.
      { code: 'ASSET_RECEIVABLES', debit: '0.00', credit: '1120.00' },
      { code: 'INCOME_SALES_REVENUE', debit: '1000.00', credit: '0.00' },
      { code: 'LIABILITY_VAT_PAYABLE', debit: '120.00', credit: '0.00' },
    ]);
  });

  it('keeps the note out of the way of a workspace with no ledger', async () => {
    const plain = await dataSource
      .getRepository(Workspace)
      .save({ name: 'No ledger WS', currency: 'EUR' });
    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `noledger-${randomUUID()}@example.com`,
        passwordHash: 'x',
        name: 'No Ledger',
        workspaceId: plain.id,
      }),
    );
    const client = await dataSource
      .getRepository(Client)
      .save({ workspaceId: plain.id, name: 'Delta', currency: 'EUR', locale: 'en' });
    // The issuer's details are per workspace, and a send refuses without them.
    await profiles.update(plain.id, {
      legalName: 'Lumio Software OÜ',
      addressLines: 'Tartu mnt 67\n10115 Tallinn',
      registrationId: '16123456',
      taxId: 'EE102345678',
    });

    const draft = await invoices.create(plain.id, {
      clientId: client.id,
      issueDate: '2026-03-01',
      dueDate: '2026-03-15',
      lineItems: [{ description: 'Work', quantity: 1, unitPrice: 50 }],
    });
    const sent = await invoices.send(draft.id, plain.id, user.id);
    const note = await creditNotes.create(plain.id, user.id, {
      applications: [{ invoiceId: sent.id }],
    });

    expect(note.journalEntryId).toBeNull();
    expect(Number(note.total)).toBe(50);
    expect((await invoices.findOne(sent.id, plain.id)).amountDue).toBe(0);
  });
});
