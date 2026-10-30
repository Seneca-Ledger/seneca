vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  DuplicateResolved,
  IntegrationConnection,
  InvoiceDelivery,
  InvoiceReminderResult,
  MessageResult,
  OkResult,
  Payable,
  PeppolLookup,
  PeppolTransmission,
  PeppolTransmissionList,
  ProtocolSyncResult,
  ReceiptApproval,
  ReceiptRecordUpdate,
  ReceiptSplitResult,
  XRechnungCheck,
} from '../../src/contracts';
import {
  CategorizationRule,
  CategorizationRuleList,
  CategorizationRuleTestResult,
  ClassifiedTransaction,
  ClassifyBulkResult,
} from '../../src/contracts/classification/categorization-rules';
import {
  CreditNoteDetail,
  CreditNoteListPage,
  CreditNoteWritten,
  InvoiceWritten,
} from '../../src/contracts/invoices/invoice-writes';
import {
  ReconciliationAgeing,
  ReconciliationDuplicates,
} from '../../src/contracts/ledger/reconciliation-parts';
import {
  ReceiptBulkApproveResult,
  ReceiptDocumentsPage,
  ReceiptStageResult,
} from '../../src/contracts/receipts/receipt-documents';
import {
  DroppedSampleConverted,
  ManualExpenseCreated,
  ReceiptScanStatements,
  StatementLegacyUploadResult,
  StatementRestored,
  StatementStageResult,
  StatementUploadResult,
  StatementWritten,
} from '../../src/contracts/statements/statement-writes';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../src/entities/receipt.entity';
import { PEPPOL_DOCTYPES } from '../../src/modules/e-invoices/peppol-ubl-writer';
import { MailerService } from '../../src/modules/mailer/mailer.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';
import { fakeRecommand, routeRecommand } from './helpers/recommand-fake';

const ofx = (fitId: string) => `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><ACCTID>${fitId}0001</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903<TRNAMT>-18.40<FITID>${fitId}<NAME>ACME STORE</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

// A 1x1 transparent PNG.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * The answers of the statements, receipts, invoices, Peppol, payables,
 * reconciliation, review and classification writes, each checked against its
 * contract with data in it.
 */
describe('API contracts: documents (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `docs-${stamp}@example.com`, peppol: `docs-peppol-${stamp}@example.com` };
  let owner: E2eAccount;
  const realFetch = globalThis.fetch;
  const registry = new Map<string, string[]>();

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const call = (method: Method, url: string, account = owner) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${account.token}`)
      .set('x-workspace-id', account.workspaceId);
  const send = (method: Method, url: string, body: object = {}, account = owner) =>
    call(method, url, account).send(body);
  /** Decodes the body with the contract and hands it back. */
  const matches = <S extends Schema.Top>(schema: S, res: request.Response): S['Type'] =>
    Schema.decodeUnknownSync(schema as unknown as Schema.Codec<S['Type'], unknown>)(res.body);

  beforeAll(async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      routeRecommand(realFetch, fakeRecommand(registry)),
    );
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] })
      .overrideProvider(MailerService)
      .useValue({ isConfigured: async () => true, send: async () => true })
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, emails.owner, 'Member One');
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    try {
      for (const email of Object.values(emails)) {
        await dataSource.query(
          'DELETE FROM receipts WHERE user_id IN (SELECT id FROM users WHERE email = $1)',
          [email],
        );
        await deleteUserByEmail(dataSource, email);
      }
    } finally {
      await app.close();
    }
  });

  describe('statements, classification and review', () => {
    let categoryId: string;
    let statementId: string;
    let transactionId: string;
    let ofxStatementId: string;
    let sampleTransactionId: string;

    beforeAll(async () => {
      categoryId = (await call('get', '/categories?type=expense').expect(200)).body[0].id;
    });

    const manualExpense = (key: string) =>
      call('post', '/statements/manual-expense')
        .set('idempotency-key', key)
        .field('amount', '18.40')
        .field('currency', 'USD')
        .field('merchant', 'ACME Store - Wireless Buds')
        .field('categoryId', categoryId)
        .field('date', '2026-09-03')
        .expect(201);

    it('POST /statements/manual-expense, and its replay by idempotency key', async () => {
      const first = matches(ManualExpenseCreated, await manualExpense(`docs-${stamp}`));
      statementId = first.id;
      const again = matches(ManualExpenseCreated, await manualExpense(`docs-${stamp}`));
      expect(again).toMatchObject({ id: statementId, cached: true });
      [{ id: transactionId }] = await dataSource.query(
        'SELECT id FROM transactions WHERE statement_id = $1',
        [statementId],
      );
    });

    it('POST /statements/upload, /statements (legacy) and /statements/upload-receipt', async () => {
      const attachOfx = (field: string, fitId: string) =>
        call('post', field === 'file' ? '/statements' : '/statements/upload').attach(
          field,
          Buffer.from(ofx(fitId)),
          { filename: `${fitId}.ofx`, contentType: 'application/octet-stream' },
        );
      const uploaded = matches(StatementUploadResult, await attachOfx('files', 'U1').expect(201));
      expect(uploaded.data).toHaveLength(1);
      ofxStatementId = uploaded.data[0].id;
      const legacy = matches(StatementLegacyUploadResult, await attachOfx('file', 'L1').expect(201));
      expect('fileType' in legacy && legacy.fileType).toBe('ofx');
      const scans = await call('post', '/statements/upload-receipt')
        .attach('files', png, { filename: 'receipt.png', contentType: 'image/png' })
        .expect(201);
      expect(matches(ReceiptScanStatements, scans).data).toHaveLength(1);
    }, 60_000);

    it('POST /statements/upload-receipt parses a bank statement and books the photo beside it', async () => {
      const scans = await call('post', '/statements/upload-receipt')
        .attach('files', Buffer.from(ofx('S1')), {
          filename: 'S1.ofx',
          contentType: 'application/octet-stream',
        })
        .attach('files', png, { filename: 'shop.png', contentType: 'image/png' })
        .expect(201);
      const [statement, receipt] = matches(ReceiptScanStatements, scans).data;
      expect([statement.fileType, receipt.fileType]).toEqual(['ofx', 'image']);
      // The statement is queued for parsing; only the photo is read as a receipt.
      const readBy: { id: string; detectedBy: string | null }[] = await dataSource.query(
        `SELECT id, parsing_details->>'detectedBy' AS "detectedBy" FROM statements WHERE id = ANY($1)`,
        [[statement.id, receipt.id]],
      );
      const detectedBy = new Map(readBy.map(row => [row.id, row.detectedBy]));
      expect(detectedBy.get(statement.id)).toBeNull();
      expect(detectedBy.get(receipt.id)).toBe('receipt-scan');
    }, 60_000);

    it('POST attach-file, PATCH, stage, trash and restore', async () => {
      const attached = await call('post', `/statements/${statementId}/attach-file`)
        .attach('file', Buffer.from('%PDF-1.4 receipt'), {
          filename: 'receipt.pdf',
          contentType: 'application/pdf',
        })
        .expect(200);
      matches(StatementWritten, attached);
      matches(StatementWritten, await send('patch', `/statements/${statementId}`, { balanceEnd: 12 }).expect(200));
      const staged = await send('post', '/statements/stage', {
        statementIds: [statementId, randomUUID()],
        stage: 'approve',
      }).expect(200);
      expect(matches(StatementStageResult, staged).skipped.length).toBeGreaterThan(0);
      const trashed = matches(StatementWritten, await call('post', `/statements/${statementId}/trash`).expect(200));
      expect(trashed.deletedAt).toBeTruthy();
      const restored = await call('post', `/statements/${statementId}/restore`).expect(201);
      expect(matches(StatementRestored, restored)).toEqual({ status: 'restored', source: 'trash' });
    });

    it('POST commit-import, confirm-balance, convert-dropped-sample and reprocess', async () => {
      matches(StatementWritten, await call('post', `/statements/${statementId}/commit-import`).expect(201));
      await dataSource.query(
        `UPDATE statements SET status = 'needs_review', parsing_details = $2 WHERE id = $1`,
        [statementId, { warnings: ['Row tx#1 dropped: no amount'], droppedSamples: [] }],
      );
      const confirmed = await call('post', `/statements/${statementId}/confirm-balance`).expect(201);
      expect(matches(StatementWritten, confirmed).status).toBe('completed');
      const converted = await send('post', `/statements/${statementId}/convert-dropped-sample`, {
        index: 0,
        transaction: { transactionDate: '2026-09-04', debit: 5, counterpartyName: 'ACME Store' },
      }).expect(201);
      sampleTransactionId = matches(DroppedSampleConverted, converted).transaction.id;
      const reprocessed = await call('post', `/statements/${ofxStatementId}/reprocess?mode=merge`);
      expect(reprocessed.status).toBe(201);
      matches(StatementWritten, reprocessed);
    }, 60_000);

    it('categorization rules: create, list, read, update and test', async () => {
      const conditions = [{ field: 'counterparty_name', operator: 'contains', value: 'ACME' }];
      const created = await send('post', '/categorization-rules', {
        name: 'ACME purchases',
        conditions,
        result: { categoryId },
      }).expect(201);
      const rule = matches(CategorizationRule, created);
      expect(matches(CategorizationRuleList, await call('get', '/categorization-rules').expect(200)).total).toBe(1);
      matches(CategorizationRule, await call('get', `/categorization-rules/${rule.id}`).expect(200));
      const updated = await send('put', `/categorization-rules/${rule.id}`, { priority: 5 }).expect(200);
      expect(matches(CategorizationRule, updated).priority).toBe(5);
      const tested = await send('post', '/categorization-rules/test', {
        conditions,
        transactionIds: [transactionId, sampleTransactionId],
      }).expect(200);
      expect(matches(CategorizationRuleTestResult, tested).matchedTransactions).toBe(2);
    });

    it('POST /classification/transaction/:id and /classification/bulk', async () => {
      const one = await call('post', `/classification/transaction/${sampleTransactionId}`).expect(200);
      expect(matches(ClassifiedTransaction, one).id).toBe(sampleTransactionId);
      const bulk = await send('post', '/classification/bulk', {
        transactionIds: [transactionId, sampleTransactionId, randomUUID()],
      }).expect(200);
      expect(matches(ClassifyBulkResult, bulk)).toMatchObject({ total: 3, notFound: 1 });
    });

    it('POST /review-inbox/duplicates/:id/resolve', async () => {
      await dataSource.query(
        'UPDATE transactions SET is_duplicate = true, duplicate_of_id = $2 WHERE id = $1',
        [sampleTransactionId, transactionId],
      );
      const res = await send('post', `/review-inbox/duplicates/${sampleTransactionId}/resolve`, {
        decision: 'keep',
      }).expect(200);
      expect(matches(DuplicateResolved, res)).toEqual({ id: sampleTransactionId, isDuplicate: false });
    });
  });

  describe('receipts', () => {
    const receiptIds: string[] = [];

    beforeAll(async () => {
      const categories = (await call('get', '/categories?type=expense').expect(200)).body;
      for (const vendor of ['ACME Store', 'Example Market']) {
        const receipt = await dataSource.getRepository(Receipt).save({
          userId: owner.userId,
          workspaceId: owner.workspaceId,
          source: ReceiptSource.SCAN,
          subject: `${vendor} receipt`,
          sender: 'scan',
          receivedAt: new Date(),
          status: ReceiptStatus.NEEDS_REVIEW,
          parsedData: {
            amount: 42.5,
            currency: 'USD',
            vendor,
            date: '2026-09-05',
            categoryId: categories[0].id,
            lineItems: [
              { description: 'Wireless Buds', amount: 30 },
              { description: 'Cable', amount: 12.5, categoryId: categories[1].id },
            ],
          },
        });
        receiptIds.push(receipt.id);
      }
    });

    it('GET /receipts/documents', async () => {
      const page = matches(ReceiptDocumentsPage, await call('get', '/receipts/documents').expect(200));
      expect(page.receipts.length).toBeGreaterThanOrEqual(2);
      expect(page.receipts[0].category).not.toBeNull();
    });

    it('POST /receipts/stage, approve, split and bulk-approve', async () => {
      const staged = await send('post', '/receipts/stage', {
        receiptIds: [receiptIds[0], randomUUID()],
        stage: 'approve',
      }).expect(200);
      expect(matches(ReceiptStageResult, staged).updated).toEqual([receiptIds[0]]);
      const approved = await send('post', `/receipts/${receiptIds[0]}/approve`).expect(201);
      expect(matches(ReceiptApproval, approved).receipt.id).toBe(receiptIds[0]);
      const split = await send('post', `/receipts/${receiptIds[0]}/split`).expect(201);
      expect(matches(ReceiptSplitResult, split).transactions.length).toBe(2);
      const bulk = await send('post', '/receipts/bulk-approve', {
        receiptIds: [receiptIds[1], randomUUID()],
      }).expect(201);
      expect(matches(ReceiptBulkApproveResult, bulk)).toMatchObject({ approved: 1, failed: 1 });
    });

    it('POST /receipts/scan', async () => {
      const scan = await call('post', '/receipts/scan')
        .attach('file', png, { filename: 'scan.png', contentType: 'image/png' })
        .expect(201);
      expect(matches(ReceiptRecordUpdate, scan).source).toBe('scan');
    }, 60_000);
  });

  describe('invoices and credit notes', () => {
    let clientId: string;
    const draft = async (lines = [{ description: 'Design work', quantity: 2, unitPrice: 150.5 }]) =>
      (
        await send('post', '/invoices', {
          clientId,
          issueDate: '2026-09-01',
          dueDate: '2026-09-30',
          currency: 'USD',
          lineItems: lines,
        }).expect(201)
      ).body.id as string;

    beforeAll(async () => {
      await send('put', '/business-profile', { legalName: 'Example Studio', addressLines: '1 Main St' }).expect(200);
      clientId = (
        await send('post', '/clients', {
          name: 'Example Buyer Ltd',
          email: 'billing@example.com',
          currency: 'USD',
        }).expect(201)
      ).body.id;
    });

    it('PUT an invoice, send it, email it, remind about it', async () => {
      const id = await draft();
      const updated = await send('put', `/invoices/${id}`, { notes: 'Thank you' }).expect(200);
      expect(matches(InvoiceWritten, updated).lineItems).toHaveLength(1);
      const sent = matches(InvoiceWritten, await call('put', `/invoices/${id}/send`).expect(200));
      expect(sent).toMatchObject({ status: 'sent', invoiceNumber: expect.any(String) });
      expect(updated.body).not.toHaveProperty('shareToken');
      matches(InvoiceDelivery, await send('post', `/invoices/${id}/deliveries`).expect(201));
      matches(InvoiceReminderResult, await call('post', `/invoices/${id}/remind`).expect(200));

      const note = await send('post', '/credit-notes', {
        reason: 'Discount',
        applications: [{ invoiceId: id, amount: 20 }],
      }).expect(201);
      const noteId = matches(CreditNoteWritten, note).id;
      expect(matches(CreditNoteListPage, await call('get', '/credit-notes').expect(200)).total).toBe(1);
      const detail = matches(CreditNoteDetail, await call('get', `/credit-notes/${noteId}`).expect(200));
      expect(detail.applications).toHaveLength(1);
      matches(XRechnungCheck, await call('get', `/credit-notes/${noteId}/xrechnung/check`).expect(200));
      const voided = await call('delete', `/credit-notes/${noteId}`).expect(200);
      expect(matches(CreditNoteWritten, voided).status).toBe('void');
    });

    it('PUT /invoices/:id/void, DELETE a draft and a client', async () => {
      const id = await draft();
      await call('put', `/invoices/${id}/send`).expect(200);
      const voided = matches(InvoiceWritten, await call('put', `/invoices/${id}/void`).expect(200));
      expect(voided.status).toBe('void');
      matches(MessageResult, await call('delete', `/invoices/${await draft()}`).expect(200));
      const spare = await send('post', '/clients', { name: 'Spare Client', currency: 'USD' }).expect(201);
      matches(MessageResult, await call('delete', `/clients/${spare.body.id}`).expect(200));
    });
  });

  describe('payables and reconciliation', () => {
    const payable = async () =>
      (
        await send('post', '/payables', {
          vendor: 'ACME Supplies',
          amount: 18.4,
          currency: 'USD',
          dueDate: '2026-09-20',
        }).expect(201)
      ).body.id as string;

    it('GET /reconciliation/ageing and /reconciliation/duplicates', async () => {
      await payable();
      await payable();
      matches(ReconciliationAgeing, await call('get', '/reconciliation/ageing').expect(200));
      const duplicates = await call('get', '/reconciliation/duplicates').expect(200);
      expect(matches(ReconciliationDuplicates, duplicates).length).toBeGreaterThan(0);
    });

    it('POST /reconciliation/confirm, book a payment, DELETE a payable', async () => {
      const [{ id: rowToConfirm }] = await dataSource.query(
        // The payment has to cover the 18.40 payable, or confirming it is a 400.
        `SELECT id FROM transactions
         WHERE workspace_id = $1 AND transaction_type = 'expense' AND debit >= 18.4
         ORDER BY debit DESC LIMIT 1`,
        [owner.workspaceId],
      );
      const confirmed = await send('post', '/reconciliation/confirm', {
        payableId: await payable(),
        transactionId: rowToConfirm,
      }).expect(200);
      expect(matches(Payable, confirmed).status).toBe('paid');

      const billId = await payable();
      await send('post', `/payables/${billId}/payments`, { amount: 5, paidOn: '2026-09-10' }).expect(201);
      const [payment] = (await call('get', `/payables/${billId}/payments`).expect(200)).body;
      // Marked paid without saying where the money went (a match may have linked a row).
      await dataSource.query('UPDATE payable_payments SET transaction_id = NULL WHERE id = $1', [payment.id]);
      const booked = await send('post', `/payables/${billId}/payments/${payment.id}/book`, {
        inHand: true,
      }).expect(201);
      matches(Payable, booked);
      matches(MessageResult, await call('delete', `/payables/${await payable()}`).expect(200));
    });
  });

  describe('peppol', () => {
    let peppol: E2eAccount;
    const as = (method: Method, url: string, body?: object) =>
      body ? send(method, url, body, peppol) : call(method, url, peppol);

    beforeAll(async () => {
      peppol = await registerAccount(app, emails.peppol, 'Member Two');
      await as('patch', `/workspaces/${peppol.workspaceId}`, { currency: 'EUR' }).expect(200);
      await as('put', '/tax/settings/jurisdiction', { code: 'DE', effectiveFrom: '2025-01-01' }).expect(200);
      await as('put', '/business-profile', {
        legalName: 'Example Studio GmbH',
        addressLines: 'Hauptstraße 1\n10115 Berlin',
        street: 'Hauptstraße 1',
        postalCode: '10115',
        city: 'Berlin',
        countryCode: 'de',
        taxId: 'DE123456789',
        taxNumber: '30/123/45678',
        contactName: 'Member Two',
        phone: '+49 30 1234567',
        email: 'invoices@example.com',
        bankAccount: 'DE02 1203 0000 0000 2020 51',
        bankCode: 'BYLADEM1001',
      }).expect(200);
      registry.set('0208:0428643097', [PEPPOL_DOCTYPES.bisInvoice, PEPPOL_DOCTYPES.bisCreditNote]);
    });

    it('status, settings, lookup, sync, send, the logs and disconnect', async () => {
      const before = matches(IntegrationConnection, await as('get', '/integrations/peppol/status').expect(200));
      expect(before.connected).toBe(false);
      const connected = await as('post', '/integrations/peppol/settings', {
        apiKeyId: 'key_example',
        apiSecret: 'secret_example',
      }).expect(201);
      expect(matches(IntegrationConnection, connected).connected).toBe(true);
      const lookup = await as('post', '/peppol/lookup', { peppolId: '0208:0428643097' }).expect(201);
      expect(matches(PeppolLookup, lookup).registered).toBe(true);
      matches(ProtocolSyncResult, await as('post', '/integrations/peppol/sync').expect(201));

      const rates = (await as('get', '/tax/settings/rates?date=2026-10-13').expect(200)).body;
      const taxRateId = rates.find((rate: { code: string }) => rate.code === 'DE_STANDARD_RC')?.id;
      const client = await as('post', '/clients', {
        name: 'Example Buyer BV',
        currency: 'EUR',
        taxId: 'BE0428643097',
        street: 'Example Street 10',
        postalCode: '2000',
        city: 'Antwerpen',
        countryCode: 'BE',
        supplyType: 'services',
        peppolId: '0208:0428643097',
      }).expect(201);
      const invoice = await as('post', '/invoices', {
        clientId: client.body.id,
        issueDate: '2026-10-13',
        dueDate: '2026-10-27',
        currency: 'EUR',
        buyerReference: 'PO-1001',
        deliveryDate: '2026-10-10',
        lineItems: [{ description: 'Consulting', quantity: 4, unitPrice: 95, unitCode: 'HUR', taxRateId }],
      }).expect(201);
      const invoiceId = invoice.body.id;
      await as('put', `/invoices/${invoiceId}/send`).expect(200);
      matches(PeppolTransmission, await as('post', `/invoices/${invoiceId}/peppol`).expect(201));
      const log = await as('get', `/invoices/${invoiceId}/peppol`).expect(200);
      expect(matches(PeppolTransmissionList, log)).toHaveLength(1);

      const note = await as('post', '/credit-notes', {
        reason: 'Fewer hours',
        applications: [{ invoiceId, amount: 95 }],
      }).expect(201);
      matches(PeppolTransmission, await as('post', `/credit-notes/${note.body.id}/peppol`).expect(201));
      const noteLog = await as('get', `/credit-notes/${note.body.id}/peppol`).expect(200);
      expect(matches(PeppolTransmissionList, noteLog)).toHaveLength(1);

      const gone = await as('delete', '/integrations/peppol').expect(200);
      expect(matches(OkResult, gone)).toEqual({ ok: true });
    }, 60_000);
  });
});
