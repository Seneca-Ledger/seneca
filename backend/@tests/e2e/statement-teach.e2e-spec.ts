vi.mock('franc', () => ({
  franc: () => 'und',
}));

import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities/statement.entity';
import { Transaction } from '../../src/entities/transaction.entity';
import { StatementProcessingService } from '../../src/modules/parsing/services/statement-processing.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const PAGE_HEIGHT = 800;
const SIZE = 9;

/** Words at [x, top] in points from the top left; a figure is placed by its right edge. */
type Placed = { text: string; x?: number; right?: number; top: number };

const LINES: Placed[] = [
  { text: 'Brought forward', x: 40, top: 60 },
  { text: '1,000.00', right: 250, top: 60 },
  // Headings the parser does not know: without teaching, no row reads.
  { text: 'When', x: 40, top: 100 },
  { text: 'What', x: 120, top: 100 },
  { text: 'Went Out', x: 300, top: 100 },
  { text: 'Came In', x: 375, top: 100 },
  { text: 'Left', x: 475, top: 100 },
  { text: '01-02-2025', x: 40, top: 120 },
  { text: 'ACME Store', x: 120, top: 120 },
  { text: '12.50', right: 342, top: 120 },
  { text: '987.50', right: 500, top: 120 },
  { text: '03-02-2025', x: 40, top: 140 },
  { text: 'Member One', x: 120, top: 140 },
  { text: '100.00', right: 412, top: 140 },
  { text: '1,087.50', right: 500, top: 140 },
];

async function statementPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([600, PAGE_HEIGHT]);
  for (const line of LINES) {
    const width = font.widthOfTextAtSize(line.text, SIZE);
    const x = line.x ?? (line.right as number) - width;
    page.drawText(line.text, { x, y: PAGE_HEIGHT - line.top - SIZE, size: SIZE, font });
  }
  return Buffer.from(await doc.save());
}

const REGIONS = [
  { tag: 'date', page: 1, x0: 35, y0: 115, x1: 110, y1: 155 },
  { tag: 'description', page: 1, x0: 115, y0: 115, x1: 280, y1: 155 },
  { tag: 'debit', page: 1, x0: 295, y0: 115, x1: 350, y1: 155 },
  { tag: 'credit', page: 1, x0: 365, y0: 115, x1: 420, y1: 155 },
  { tag: 'balance', page: 1, x0: 450, y0: 115, x1: 505, y1: 155 },
];

/**
 * A statement whose headings the parser does not know is taught by marking
 * its columns: the marking view gets the file's words, a preview reads it
 * without saving, and teaching saves the layout and reads the statement again.
 * The layout serves only the workspace that taught it.
 */
describe('Teaching a statement layout (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let processing: StatementProcessingService;
  let pdf: Buffer;
  const stamp = Date.now();
  const emails = {
    owner: `teach-owner-${stamp}@example.com`,
    other: `teach-other-${stamp}@example.com`,
    sharer: `teach-sharer-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let sharer: E2eAccount;
  const files: string[] = [];

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  let seeded = 0;
  const seedStatement = async (account: E2eAccount) => {
    // Where an upload keeps its file.
    const filePath = path.join(os.tmpdir(), `teach-e2e-${stamp}-${seeded}.pdf`);
    await fs.promises.writeFile(filePath, pdf);
    files.push(filePath);
    const saved = await dataSource.getRepository(Statement).save({
      userId: account.userId,
      workspaceId: account.workspaceId,
      fileName: 'statement.pdf',
      filePath,
      fileType: FileType.PDF,
      fileSize: pdf.length,
      fileHash: `teach-${stamp}-${seeded++}`,
      bankName: BankName.OTHER,
      status: StatementStatus.UPLOADED,
      currency: 'USD',
    });
    return processing.processStatement(saved.id);
  };
  const rowsOf = (statementId: string) =>
    dataSource.getRepository(Transaction).find({ where: { statementId } });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    processing = moduleFixture.get(StatementProcessingService);
    pdf = await statementPdf();
    owner = await registerAccount(app, emails.owner, 'Teach Owner');
    other = await registerAccount(app, emails.other, 'Teach Other');
    sharer = await registerAccount(app, emails.sharer, 'Teach Sharer');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
    await Promise.all(files.map(file => fs.promises.rm(file, { force: true })));
  });

  it('reads a statement once its columns are marked, and only in the workspace that taught it', async () => {
    const statement = await seedStatement(owner);
    expect(statement.status).not.toBe(StatementStatus.COMPLETED);
    expect(await rowsOf(statement.id)).toHaveLength(0);

    const words = await as(
      owner,
      request(server()).get(`/statements/${statement.id}/layout-words`),
    ).expect(200);
    const when = words.body.words.find((word: { text: string }) => word.text === 'When');
    expect(when).toMatchObject({ page: 1, x: expect.closeTo(40, 0), dated: false });
    // Every word of a transaction row knows its line starts with a date.
    const acme = words.body.words.find((word: { text: string }) => word.text === 'ACME');
    expect(acme).toMatchObject({ dated: true });

    const incomplete = await as(
      owner,
      request(server()).post(`/statements/${statement.id}/teach/preview`),
    )
      .send({ regions: REGIONS.slice(0, 2) })
      .expect(200);
    expect(incomplete.body).toMatchObject({ missing: ['debit|credit|amount'], transactions: 0 });

    const preview = await as(
      owner,
      request(server()).post(`/statements/${statement.id}/teach/preview`),
    )
      .send({ regions: REGIONS })
      .expect(200);
    expect(preview.body).toMatchObject({
      missing: [],
      transactions: 2,
      totalDebit: 12.5,
      totalCredit: 100,
    });
    expect(preview.body.checks).toContainEqual({ code: 'balance_chain', passed: true });
    expect(preview.body.rows).toHaveLength(2);
    expect(preview.body.rows.every((row: { broken: boolean }) => !row.broken)).toBe(true);
    // A preview saves nothing.
    expect(
      await dataSource.query('SELECT count(*)::int AS n FROM parsing_layout_templates WHERE workspace_id = $1', [
        owner.workspaceId,
      ]),
    ).toEqual([{ n: 0 }]);

    // Another workspace can neither read the file's words nor teach on it.
    await as(other, request(server()).get(`/statements/${statement.id}/layout-words`)).expect(404);
    await as(other, request(server()).post(`/statements/${statement.id}/teach`))
      .send({ regions: REGIONS })
      .expect(404);

    await as(owner, request(server()).post(`/statements/${statement.id}/teach`))
      .send({ regions: REGIONS.slice(0, 2) })
      .expect(400);
    await as(owner, request(server()).post(`/statements/${statement.id}/teach`))
      .send({ regions: REGIONS })
      .expect(201);
    const [template] = await dataSource.query(
      'SELECT template FROM parsing_layout_templates WHERE workspace_id = $1',
      [owner.workspaceId],
    );
    expect(JSON.stringify(template)).not.toMatch(/acme|member|12\.50|987/i);

    const reread = await processing.processStatement(statement.id);
    expect(reread.status).toBe(StatementStatus.COMPLETED);
    const read = (await rowsOf(statement.id))
      .map(row => [row.transactionType, Number(row.amount)])
      .sort((x, y) => Number(x[1]) - Number(y[1]));
    expect(read).toEqual([
      ['expense', 12.5],
      ['income', 100],
    ]);

    // Taught again, the statement keeps one layout: the new one, bound to it.
    await as(owner, request(server()).post(`/statements/${statement.id}/teach`))
      .send({ regions: REGIONS.filter(region => region.tag !== 'balance') })
      .expect(201);
    const bound = await dataSource.query(
      'SELECT template FROM parsing_layout_templates WHERE workspace_id = $1 AND statement_id = $2',
      [owner.workspaceId, statement.id],
    );
    expect(bound).toHaveLength(1);
    expect(bound[0].template.columns.map((column: { role: string }) => column.role)).not.toContain(
      'balance',
    );
    const retaught = await processing.processStatement(statement.id);
    expect(retaught.status).toBe(StatementStatus.COMPLETED);
    expect(retaught.parsingDetails?.layout?.taughtTemplate).toBeTruthy();

    // The next statement in that layout reads by itself; another workspace's does not.
    expect((await seedStatement(owner)).status).toBe(StatementStatus.COMPLETED);
    const elsewhere = await seedStatement(other);
    expect(elsewhere.status).not.toBe(StatementStatus.COMPLETED);
    expect(await rowsOf(elsewhere.id)).toHaveLength(0);
  });

  it('shares the taught layout with the project only, and refuses another workspace', async () => {
    const received: unknown[] = [];
    let answer = 201;
    const receiver = http.createServer((request, response) => {
      let body = '';
      request.on('data', chunk => {
        body += chunk;
      });
      request.on('end', () => {
        received.push(JSON.parse(body));
        response.writeHead(answer, { 'content-type': 'application/json' });
        response.end(JSON.stringify(answer === 201 ? { received: true } : { error: 'down' }));
      });
    });
    await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve));
    const { port } = receiver.address() as { port: number };
    process.env.PARSER_SUBMISSIONS_URL = `http://127.0.0.1:${port}/submit`;
    try {
      const statement = await seedStatement(sharer);
      await as(sharer, request(server()).get(`/statements/${statement.id}/teach/share`)).expect(404);
      await as(sharer, request(server()).post(`/statements/${statement.id}/teach`))
        .send({ regions: REGIONS })
        .expect(201);

      const info = await as(
        sharer,
        request(server()).get(`/statements/${statement.id}/teach/share`),
      ).expect(200);
      expect(info.body).toMatchObject({ enabled: true, direct: true, email: 'peterbaikov12@proton.me' });
      expect(info.body.submission.headings.map((h: { phrase: string }) => h.phrase)).toContain('when');
      // How the bank prints, as shapes: digits as #.
      expect(info.body.submission.print).toMatchObject({
        dateShape: '##-##-####',
        amounts: { decimal: '.', thousands: ',', negative: 'none', marks: [] },
        descriptionLines: 1,
        pages: 1,
        headerOnEveryPage: true,
      });
      // How the taught layout read this statement, once it has: counts and outcomes only.
      expect(info.body.submission.evidence).toBeUndefined();
      await processing.processStatement(statement.id);
      const read = await as(
        sharer,
        request(server()).get(`/statements/${statement.id}/teach/share`),
      ).expect(200);
      expect(read.body.submission.evidence).toEqual({
        rows: 2,
        balanceChain: 'passed',
        printedTotals: 'unchecked',
        statementsRead: 1,
      });

      await as(other, request(server()).post(`/statements/${statement.id}/teach/share`)).expect(404);
      expect(received).toHaveLength(0);

      // The body is not read: what leaves is built from the stored layout.
      await as(sharer, request(server()).post(`/statements/${statement.id}/teach/share`))
        .send({ headings: [{ phrase: 'smuggled', role: 'date' }] })
        .expect(200, { sent: true });
      // What left is what the user was shown: the layout, no row of the statement.
      expect(received).toEqual([read.body.submission]);
      expect(JSON.stringify(received)).not.toMatch(/acme|member|12\.50|987/i);

      answer = 500;
      await as(sharer, request(server()).post(`/statements/${statement.id}/teach/share`)).expect(502);

      process.env.PARSER_SUBMISSIONS_ENABLED = 'false';
      await as(sharer, request(server()).post(`/statements/${statement.id}/teach/share`)).expect(403);
    } finally {
      delete process.env.PARSER_SUBMISSIONS_URL;
      delete process.env.PARSER_SUBMISSIONS_ENABLED;
      await new Promise(resolve => receiver.close(resolve));
    }
  });
});
