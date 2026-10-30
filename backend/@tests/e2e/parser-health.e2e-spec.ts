vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  BankName,
  FileType,
  Statement,
  StatementStatus,
} from '../../src/entities/statement.entity';
import { User, UserRole } from '../../src/entities/user.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * The instance's parser health spans every workspace, so it must give its
 * administrator counts and layout words only: nothing a workspace owns.
 */
describe('Parser health (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { admin: `ph-admin-${stamp}@example.com`, member: `ph-member-${stamp}@example.com` };
  // Text no answer may carry: it stands for what a workspace's statements hold.
  const secret = `phsecret${stamp}`;
  const fingerprint = (letter: string) => `${letter}${String(stamp).slice(-11)}`;
  let admin: E2eAccount;
  let member: E2eAccount;
  const statementIds: string[] = [];

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);

  const seedStatement = async (
    account: E2eAccount,
    status: StatementStatus,
    layoutFingerprint: string,
    reasonCodes: string[] = [],
  ) => {
    const saved = await dataSource.getRepository(Statement).save({
      userId: account.userId,
      workspaceId: account.workspaceId,
      fileName: `${secret}.pdf`,
      filePath: `/uploads/${secret}.pdf`,
      fileType: FileType.PDF,
      fileSize: 1,
      fileHash: `${secret}-${statementIds.length}`,
      bankName: BankName.AXIS,
      status,
      currency: 'INR',
      errorMessage: status === StatementStatus.ERROR ? `failed on ${secret}` : null,
      parsingDetails: {
        parserUsed: 'AxisParser',
        warnings: [`Balance chain broken near ${secret}`],
        metadataExtracted: { accountNumber: secret },
        validation: { passed: reasonCodes.length === 0, warnings: [], reasonCodes },
        layout: {
          fingerprint: layoutFingerprint,
          headings: ['date:date | description:particulars | debit:debit | credit:credit'],
          unknownWords: [],
        },
      } as Statement['parsingDetails'],
    });
    statementIds.push(saved.id);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    admin = await registerAccount(app, emails.admin, 'Health Admin');
    member = await registerAccount(app, emails.member, 'Health Member');
    await dataSource.getRepository(User).update({ email: emails.admin }, { role: UserRole.ADMIN });
    await dataSource.getRepository(User).update({ email: emails.member }, { role: UserRole.USER });
    // One workspace's statements in one layout, another's in a second layout.
    await seedStatement(admin, StatementStatus.COMPLETED, fingerprint('a'));
    await seedStatement(member, StatementStatus.NEEDS_REVIEW, fingerprint('b'), ['balance_chain']);
    await seedStatement(member, StatementStatus.NEEDS_REVIEW, fingerprint('b'), ['balance_chain']);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.getRepository(Statement).delete(statementIds);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('gives the instance admin counts and layouts across workspaces, and nothing they hold', async () => {
    const res = await as(admin, request(app.getHttpServer()).get('/parsing/health')).expect(200);

    const axis = res.body.banks.find((bank: { bank: string }) => bank.bank === 'axis');
    const ours = axis.layouts.filter((layout: { fingerprint: string }) =>
      [fingerprint('a'), fingerprint('b')].includes(layout.fingerprint),
    );
    expect(ours.map((layout: { fingerprint: string; statements: number }) => [layout.fingerprint, layout.statements])).toEqual([
      [fingerprint('b'), 2],
      [fingerprint('a'), 1],
    ]);
    expect(axis.needsReview).toBeGreaterThanOrEqual(2);
    expect(axis.reasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'balance_chain' })]));

    for (const leak of [secret, admin.workspaceId, member.workspaceId, ...statementIds]) {
      expect(res.text).not.toContain(leak);
    }
  });

  it('refuses everyone else', async () => {
    await as(member, request(app.getHttpServer()).get('/parsing/health')).expect(403);
  });
});
