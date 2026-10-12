jest.mock('franc', () => ({
  franc: () => 'und',
}));
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import AdmZip = require('adm-zip');
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { deleteUserByEmail, e2eTestingModule, registerAccount } from './helpers/e2e-app';

/**
 * The tax engine against a real database: VAT status, re-assessment on edit,
 * reverse charge from the payee, the filed-return lock on deletes, the
 * tax-relevant mark with its year report and tax pack, the reserve, and the
 * VAT split in the German EÜR draft.
 */
describe('Tax engine: defects and user expectations (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let workspaceId: string;
  const email = `tax-engine-${Date.now()}@example.com`;

  const api = () => request(app.getHttpServer());
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('x-workspace-id', workspaceId);

  let groceries: string;
  let office: string;
  let statementId: string;
  let transactionId: string;

  const row = async () => {
    const [found] = await dataSource.query(
      `SELECT tax_amount, tax_net_amount, tax_rate_id, tax_reverse_charge, tax_locked, payee_id
       FROM transactions WHERE id = $1`,
      [transactionId],
    );
    return found as {
      tax_amount: string | null;
      tax_net_amount: string | null;
      tax_rate_id: string | null;
      tax_reverse_charge: boolean;
      tax_locked: boolean;
      payee_id: string | null;
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const account = await registerAccount(app, email, 'Tax Engine');
    token = account.token;
    workspaceId = account.workspaceId;

    // Euro books, so the figures below need no exchange rate.
    await auth(api().patch(`/workspaces/${workspaceId}`)).send({ currency: 'EUR' }).expect(200);
    await auth(api().put('/tax/settings/jurisdiction'))
      .send({ code: 'DE', effectiveFrom: '2025-01-01' })
      .expect(200);

    const categories = await auth(api().get('/categories?type=expense')).expect(200);
    const expense = (categories.body as Array<{ id: string; parentId: string | null; name: string }>)
      .filter(category => !category.parentId && category.name !== 'Uncategorized');
    groceries = expense[0].id;
    office = expense[1].id;

    const created = await auth(api().post('/statements/manual-expense'))
      .field('amount', '119')
      .field('currency', 'EUR')
      .field('merchant', 'Acme Sp. z o.o.')
      .field('categoryId', groceries)
      .field('date', '2026-03-10')
      .expect(201);
    statementId = created.body.id;
    const [tx] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [
      statementId,
    ]);
    transactionId = tx.id;
  });

  afterAll(async () => {
    try {
      await dataSource.query('UPDATE transactions SET tax_locked = false WHERE workspace_id = $1', [
        workspaceId,
      ]);
      await dataSource.query('DELETE FROM tax_returns WHERE workspace_id = $1', [workspaceId]);
      await deleteUserByEmail(dataSource, email);
    } finally {
      await app.close();
    }
  });

  it('adds a reverse-charge twin of the standard rate for an EU country', async () => {
    const rates = await auth(api().get('/tax/settings/rates?date=2026-03-10')).expect(200);
    const twin = (rates.body as Array<{ code: string; isReverseCharge: boolean; isDefault: boolean }>).find(
      rate => rate.code === 'DE_STANDARD_RC',
    );
    expect(twin).toMatchObject({ isReverseCharge: true, isDefault: false });
  });

  it('assesses the default rate on a new expense', async () => {
    const figures = await row();
    expect(Number(figures.tax_amount)).toBe(19);
    expect(Number(figures.tax_net_amount)).toBe(100);
  });

  it('re-assesses when the category changes', async () => {
    await auth(api().post('/tax/rules'))
      .send({ categoryId: office, taxRateCode: 'DE_REDUCED', direction: 'expense' })
      .expect(201);

    await auth(api().put(`/transactions/${transactionId}`)).send({ categoryId: office }).expect(200);

    // 119 gross at 7%: 119 × 7 / 107 = 7.785… → 7.79
    expect(Number((await row()).tax_amount)).toBe(7.79);
  });

  it('stops assessing VAT when the workspace is not registered, and resumes when it is', async () => {
    const off = await auth(api().put('/tax/settings/vat-status'))
      .send({ status: 'not_registered' })
      .expect(200);
    expect(off.body.reassessed).toBeGreaterThanOrEqual(1);
    expect((await row()).tax_amount).toBeNull();

    const settings = await auth(api().get('/tax/settings')).expect(200);
    expect(settings.body.vatStatus).toBe('not_registered');

    await auth(api().put('/tax/settings/vat-status')).send({ status: 'registered' }).expect(200);
    expect(Number((await row()).tax_amount)).toBe(7.79);
  });

  it("reverse-charges purchases from a payee with an EU VAT id in another country", async () => {
    const { payee_id: payeeId } = await row();
    expect(payeeId).toBeTruthy();

    const updated = await auth(api().patch(`/payees/${payeeId}`))
      .send({ countryCode: 'pl', vatId: ' PL1234567890 ' })
      .expect(200);
    expect(updated.body).toMatchObject({ countryCode: 'PL', vatId: 'PL1234567890' });

    const figures = await row();
    expect(figures.tax_reverse_charge).toBe(true);
    expect(Number(figures.tax_amount)).toBe(0);

    // Clearing the details puts the ordinary assessment back.
    await auth(api().patch(`/payees/${payeeId}`)).send({ countryCode: null, vatId: null }).expect(200);
    expect((await row()).tax_reverse_charge).toBe(false);
  });

  it('knows when the next VAT returns are due, by the filing frequency chosen', async () => {
    const filing = await auth(api().get('/tax/settings/vat-filing')).expect(200);
    expect(filing.body).toMatchObject({
      frequency: 'quarterly',
      isDefault: true,
      extensionName: 'Dauerfristverlängerung',
      deadlinesKnown: true,
    });

    await auth(api().put('/tax/settings/vat-filing'))
      .send({ frequency: 'monthly', extension: true })
      .expect(200);
    const deadlines = await auth(api().get('/tax/deadlines')).expect(200);
    const vat = (deadlines.body as Array<{ kind: string; periodStart: string; periodEnd: string; dueDate: string }>)
      .filter(item => item.kind === 'vat_return');
    expect(vat.length).toBeGreaterThan(0);
    for (const item of vat) {
      // A month, due the 10th of the second month after it with the extension
      // (later when that day falls on a weekend).
      expect(item.periodStart.slice(8)).toBe('01');
      const end = new Date(`${item.periodEnd}T00:00:00Z`);
      const due = new Date(`${item.dueDate}T00:00:00Z`);
      const months = (due.getUTCFullYear() - end.getUTCFullYear()) * 12 + due.getUTCMonth() - end.getUTCMonth();
      expect(months).toBe(2);
      expect(due.getUTCDate()).toBeGreaterThanOrEqual(10);
      expect(due.getUTCDate()).toBeLessThanOrEqual(12);
    }

    await auth(api().put('/tax/settings/vat-filing'))
      .send({ frequency: null, extension: false })
      .expect(200);
  });

  it('exports the VAT return as CSV', async () => {
    const res = await auth(
      api().get('/tax/returns/export?periodStart=2026-01-01&periodEnd=2026-03-31&format=csv'),
    ).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Acme Sp. z o.o.');
  });

  it('marks a category tax relevant and reports it for the year', async () => {
    await auth(api().put(`/categories/${office}`)).send({ taxRelevant: true }).expect(200);

    const report = await auth(api().get('/tax/year-report?year=2026')).expect(200);
    expect(report.body.rows.map((r: { id: string }) => r.id)).toContain(transactionId);
    expect(report.body.categories[0]).toMatchObject({ categoryId: office, count: 1, total: 119 });
  });

  it('lets a single row opt out of its category', async () => {
    await auth(api().put(`/transactions/${transactionId}`)).send({ taxRelevant: false }).expect(200);
    const report = await auth(api().get('/tax/year-report?year=2026')).expect(200);
    expect(report.body.rows).toHaveLength(0);

    await auth(api().put(`/transactions/${transactionId}`)).send({ taxRelevant: null }).expect(200);
  });

  it('builds a tax pack with the rows, a summary, a readme and the receipt', async () => {
    // A 1×1 PNG pinned to the row: it should come back under documents/, named after the row.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const attachment = await auth(api().post(`/transactions/${transactionId}/attachments`))
      .attach('file', png, { filename: 'kassenbon.png', contentType: 'image/png' })
      .expect(201);

    const res = await auth(api().get('/tax/pack?from=2026-01-01&to=2026-12-31'))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toBe('application/zip');

    const zip = new AdmZip(res.body as Buffer);
    const names = zip.getEntries().map(entry => entry.entryName);
    expect(names).toEqual(expect.arrayContaining(['transactions.csv', 'summary.csv', 'README.txt']));
    const receipt = names.find(name => name.startsWith('documents/'));
    expect(receipt).toBe('documents/2026-03-10_Acme Sp. z o.o._119_EUR.png');
    expect(zip.getEntry(receipt as string)?.getData()).toEqual(png);
    const csv = zip.readAsText('transactions.csv');
    expect(csv).toContain('Acme Sp. z o.o.');
    expect(csv).toContain('7.79');
    expect(csv).toContain(receipt);

    // The file lands in the shared uploads dir; take it away again.
    await auth(api().delete(`/transactions/attachments/${attachment.body.id}`)).expect(200);
  });

  it('keeps a reserve: VAT of the year plus the chosen share of earnings', async () => {
    await auth(api().put('/tax/settings/reserve'))
      .send({ percent: 30, paymentsCategoryId: null })
      .expect(200);

    const reserve = await auth(api().get('/tax/settings/reserve/amount')).expect(200);
    expect(reserve.body.incomeTax).toMatchObject({ percent: 30 });
    expect(reserve.body.vat).not.toBeNull();
    // Only input VAT so far: nothing is owed, and the reserve never goes negative.
    expect(reserve.body.vat.net).toBeLessThan(0);
    expect(reserve.body.total).toBe(0);
  });

  it('declares a VAT-registered business net in the EÜR, with the VAT on its own line', async () => {
    await auth(api().put('/income-tax/profile'))
      .send({ taxYear: 2026, taxpayerType: 'self_employed', details: {} })
      .expect(200);
    await auth(api().put('/income-tax/mappings'))
      .send({ taxYear: 2026, entries: [{ categoryId: office, lineKey: 'goods' }] })
      .expect(200);

    const draft = await auth(api().get('/income-tax/returns/2026')).expect(200);
    const figure = (key: string) =>
      (draft.body.figures as Array<{ key: string; amount: number }>).find(f => f.key === key);
    expect(figure('goods')?.amount).toBe(111.21);
    expect(figure('input_vat_paid')?.amount).toBe(7.79);
  });

  describe('a filed return', () => {
    let customCategory: string;
    let secondId: string;

    beforeAll(async () => {
      const category = await auth(api().post('/categories'))
        .send({ name: 'Bookkeeping software', type: 'expense' })
        .expect(201);
      customCategory = category.body.id;
      const second = await auth(api().post('/statements/manual-expense'))
        .field('amount', '59.50')
        .field('currency', 'EUR')
        .field('merchant', 'Lexware')
        .field('categoryId', customCategory)
        .field('date', '2026-02-02')
        .expect(201);
      const [tx] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [
        second.body.id,
      ]);
      secondId = tx.id;

      await auth(api().post('/tax/returns/file'))
        .send({ periodStart: '2026-01-01', periodEnd: '2026-03-31' })
        .expect(201);
    });

    it('locks its rows', async () => {
      expect((await row()).tax_locked).toBe(true);
    });

    it('refuses to delete a row on it', async () => {
      const res = await auth(api().delete(`/transactions/${transactionId}`)).expect(409);
      expect(res.body.error.code).toBe('TAX_LOCKED');
    });

    it('refuses to trash or delete the statement behind it', async () => {
      await auth(api().post(`/statements/${statementId}/trash`)).expect(409);
      await auth(api().delete(`/statements/${statementId}?permanent=true`)).expect(409);
      expect((await row()).tax_locked).toBe(true);
    });

    it('moves the payee of a filed row but keeps its category', async () => {
      // A payee pinned to another category would recategorise a row whose
      // category nobody chose — but not one on a filed return.
      const { payee_id: acme } = await row();
      await auth(api().patch(`/payees/${acme}`))
        .send({ mode: 'always', categoryId: office })
        .expect(200);
      await dataSource.query("UPDATE transactions SET category_source = 'ai' WHERE id = $1", [
        secondId,
      ]);

      await auth(api().put(`/transactions/${secondId}/payee`)).send({ payeeId: acme }).expect(200);
      const [found] = await dataSource.query(
        'SELECT category_id, tax_locked FROM transactions WHERE id = $1',
        [secondId],
      );
      expect(found).toMatchObject({ category_id: customCategory, tax_locked: true });
    });

    it('refuses to delete a category a filed row is booked to', async () => {
      const res = await auth(api().delete(`/categories/${customCategory}`)).expect(409);
      expect(res.body.error.code).toBe('TAX_LOCKED');
    });

    it('refuses to flag a filed row as a duplicate', async () => {
      const res = await auth(api().post('/transactions/duplicates/merge'))
        .send({ transactionIds: [transactionId, secondId] })
        .expect(409);
      expect(res.body.error.code).toBe('TAX_LOCKED');
      const [found] = await dataSource.query('SELECT is_duplicate FROM transactions WHERE id = $1', [
        secondId,
      ]);
      expect(found.is_duplicate).toBe(false);
    });

    it('lets the row go once the return is reopened', async () => {
      await auth(api().post('/tax/returns/reopen'))
        .send({ periodStart: '2026-01-01', periodEnd: '2026-03-31' })
        .expect(201);
      await auth(api().delete(`/transactions/${transactionId}`)).expect(204);
    });
  });

  it('watches the registration threshold only for a business below it', async () => {
    // A sale, entered as an expense and turned into income like a refund would be.
    const created = await auth(api().post('/statements/manual-expense'))
      .field('amount', '20000')
      .field('currency', 'EUR')
      .field('merchant', 'Kunde AG')
      .field('categoryId', groceries)
      .field('date', '2026-05-05')
      .expect(201);
    const [sale] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [
      created.body.id,
    ]);
    const income = await auth(api().get('/categories?type=income')).expect(200);
    const incomeCategory = (income.body as Array<{ id: string; name: string; parentId: string | null }>)
      .find(category => !category.parentId && category.name !== 'Uncategorized');
    await auth(api().put(`/transactions/${sale.id}`))
      .send({ debit: 0, credit: 20000, categoryId: incomeCategory?.id })
      .expect(200);

    // Registered: past the threshold, nothing to watch.
    const registered = await auth(api().get('/tax/settings/threshold')).expect(200);
    expect(registered.body === null || Object.keys(registered.body).length === 0).toBe(true);

    // A Kleinunternehmer has no VAT assessed, and the sale still counts in full.
    await auth(api().put('/tax/settings/vat-status')).send({ status: 'small_business' }).expect(200);
    const watched = await auth(api().get('/tax/settings/threshold')).expect(200);
    expect(watched.body).toMatchObject({ threshold: 25000, turnover: 20000, currency: 'EUR' });
    expect(watched.body.percentUsed).toBe(80);
  });

  it('turns VAT off when the workspace becomes a household', async () => {
    await auth(api().put('/tax/settings/vat-status')).send({ status: 'registered' }).expect(200);
    await auth(api().patch(`/workspaces/${workspaceId}`)).send({ profile: 'home' }).expect(200);
    const settings = await auth(api().get('/tax/settings')).expect(200);
    expect(settings.body.vatStatus).toBe('not_registered');
  });
});
