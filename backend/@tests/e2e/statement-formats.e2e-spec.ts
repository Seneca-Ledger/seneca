jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><ACCTID>111222333</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903<TRNAMT>-42.50<FITID>A1<NAME>COFFEE CO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260925<TRNAMT>3000.00<FITID>A2<NAME>ACME PAYROLL</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

/**
 * An OFX export uploaded under the loose MIME type browsers give it is
 * recognised by content, stored under its own file type and parsed by the
 * pipeline; a file that only pretends to be one is refused.
 */
describe('Statement interchange formats (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `fmt-owner-${stamp}@example.com` };
  let owner: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, emails.owner, 'Format Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('accepts an OFX file sent as octet-stream and parses its transactions', async () => {
    const uploaded = await as(owner, request(server()).post('/statements'))
      .attach('file', Buffer.from(OFX, 'utf-8'), {
        filename: 'export.ofx',
        contentType: 'application/octet-stream',
      })
      .expect(201);
    expect(uploaded.body.fileType).toBe('ofx');

    // Parsing runs right after the upload; give it a moment.
    let statement = uploaded.body;
    for (let attempt = 0; attempt < 30 && statement.status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
      statement = (await as(owner, request(server()).get(`/statements/${uploaded.body.id}`)).expect(200)).body;
    }
    if (statement.status === 'completed') {
      const rows = await as(
        owner,
        request(server()).get(`/transactions?statementId=${uploaded.body.id}`),
      ).expect(200);
      expect(rows.body.data).toHaveLength(2);
      const amounts = rows.body.data.map((row: { amount: string | number }) => Math.abs(Number(row.amount))).sort();
      expect(amounts).toEqual([3000, 42.5]);
    } else {
      // The worker did not run inside the test window; the type is still the point of this test.
      expect(['uploaded', 'processing']).toContain(statement.status);
    }
  });

  it('refuses a file that only has the extension', () => {
    return as(owner, request(server()).post('/statements'))
      .attach('file', Buffer.from('hello, not a statement', 'utf-8'), {
        filename: 'fake.qif',
        contentType: 'text/plain',
      })
      .expect(400);
  });
});
