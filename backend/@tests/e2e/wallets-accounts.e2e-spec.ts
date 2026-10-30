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
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Accounts end to end: an account's balance is its opening balance plus the
 * rows booked to it, a bank statement is offered to the account with its
 * number, attaching moves its rows in and reconciles against the closing
 * balance, and nothing crosses workspaces.
 */
describe('Accounts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `accounts-owner-${stamp}@example.com`,
    other: `accounts-other-${stamp}@example.com`,
    exporter: `accounts-exporter-${stamp}@example.com`,
    importer: `accounts-importer-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let currency: string;

  const accountNumber = 'DE00 0000 0000 0000 0001';
  const opening = 100;
  const income = 80;
  const spending = 30;
  const closing = opening + income - spending;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  /** A parsed bank statement with one income and one spending row, held by no account. */
  async function seedStatement(
    account: E2eAccount,
    statementCurrency: string,
    overrides: Partial<Statement> = {},
  ): Promise<string> {
    const statement = await dataSource.getRepository(Statement).save(
      dataSource.getRepository(Statement).create({
        userId: account.userId,
        workspaceId: account.workspaceId,
        fileName: `everyday-${stamp}.csv`,
        filePath: '/dev/null',
        fileType: FileType.CSV,
        fileSize: 1,
        fileHash: `hash-${stamp}-${Math.random()}`,
        bankName: BankName.OTHER,
        accountNumber,
        currency: statementCurrency,
        statementDateFrom: new Date('2026-01-01'),
        statementDateTo: new Date('2026-01-31'),
        balanceStart: opening,
        balanceEnd: closing,
        totalTransactions: 2,
        status: StatementStatus.COMPLETED,
        ...overrides,
      }),
    );
    const rows = dataSource.getRepository(Transaction);
    const row = (date: string, type: TransactionType, amount: number) =>
      rows.create({
        workspaceId: account.workspaceId,
        statementId: statement.id,
        transactionDate: new Date(date),
        counterpartyName: 'ACME Store',
        paymentPurpose: 'Purchase',
        currency: statementCurrency,
        transactionType: type,
        amount,
        credit: type === TransactionType.INCOME ? amount : null,
        debit: type === TransactionType.EXPENSE ? amount : null,
        isVerified: true,
      });
    await rows.save([
      row('2026-01-10', TransactionType.INCOME, income),
      row('2026-01-20', TransactionType.EXPENSE, spending),
    ]);
    return statement.id;
  }

  async function listAccounts(account: E2eAccount) {
    return (await as(account, request(server()).get('/wallets')).expect(200)).body as Array<
      Record<string, any>
    >;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    currency = (await as(owner, request(server()).get('/wallets/summary')).expect(200)).body
      .currency;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('offers a statement to the account with its number, then reconciles once attached', async () => {
    const created = await as(
      owner,
      request(server())
        .post('/wallets')
        .send({ name: 'Everyday', type: 'checking', accountNumber: '0001', initialBalance: opening }),
    ).expect(201);
    const walletId: string = created.body.id;
    const statementId = await seedStatement(owner, currency);

    const unlinked = (
      await as(owner, request(server()).get('/wallets/unlinked-statements')).expect(200)
    ).body;
    expect(unlinked).toEqual([
      expect.objectContaining({ id: statementId, suggestedWalletId: walletId, balanceEnd: closing }),
    ]);

    // Not attached yet: the account holds only its opening balance.
    expect((await listAccounts(owner))[0]).toMatchObject({ balance: opening, reconciliation: null });

    await as(
      owner,
      request(server()).post(`/wallets/${walletId}/statements`).send({ statementIds: [statementId] }),
    ).expect(201, { attached: 1 });

    const [account] = await listAccounts(owner);
    expect(account).toMatchObject({
      type: 'checking',
      balance: closing,
      transactionCount: 2,
      pendingReviewCount: 0,
      lastActivityAt: '2026-01-20',
      reconciliation: { statementId, statementBalance: closing, matches: true },
    });
    const series = (
      await as(owner, request(server()).get(`/wallets/${walletId}/series`)).expect(200)
    ).body;
    expect(series).toEqual([
      { date: '2026-01-10', balance: opening + income },
      { date: '2026-01-20', balance: closing },
    ]);
    expect(
      (await as(owner, request(server()).get('/wallets/unlinked-statements')).expect(200)).body,
    ).toEqual([]);
    const held = (
      await as(owner, request(server()).get(`/wallets/${walletId}/statements`)).expect(200)
    ).body;
    expect(held).toEqual([expect.objectContaining({ id: statementId, suggestedWalletId: walletId })]);
    const rowsOfAccount = (
      await as(
        owner,
        request(server()).get(`/transactions?walletId=${walletId}&running_balance=1`),
      ).expect(200)
    ).body.data as Array<{ runningBalance: string }>;
    expect(rowsOfAccount.map(row => Number(row.runningBalance)).sort((a, b) => a - b)).toEqual([
      closing,
      opening + income,
    ]);

    const summary = (await as(owner, request(server()).get('/wallets/summary')).expect(200)).body;
    expect(summary).toMatchObject({ currency, assets: closing, debts: 0, unconverted: [] });

    await as(
      owner,
      request(server()).delete(`/wallets/${walletId}/statements/${statementId}`),
    ).expect(200);
    expect((await listAccounts(owner))[0]).toMatchObject({ balance: opening, transactionCount: 0 });
    const rows = await dataSource.getRepository(Transaction).findBy({ statementId });
    expect(rows.every(row => row.walletId === null)).toBe(true);
  });

  it('creates an account straight from found statements', async () => {
    const statementId = await seedStatement(other, 'EUR');
    const created = await as(
      other,
      request(server())
        .post('/wallets')
        .send({ name: 'Savings', type: 'savings', currency: 'EUR', initialBalance: opening, statementIds: [statementId] }),
    ).expect(201);

    const statement = await dataSource.getRepository(Statement).findOneByOrFail({ id: statementId });
    expect(statement.walletId).toBe(created.body.id);
    expect((await listAccounts(other))[0]).toMatchObject({ type: 'savings', balance: closing });
  });

  it('refuses a statement in another currency', async () => {
    const statementId = await seedStatement(owner, 'EUR');
    const usd = await as(
      owner,
      request(server()).post('/wallets').send({ name: 'Dollars', currency: 'USD' }),
    ).expect(201);

    const res = await as(
      owner,
      request(server()).post(`/wallets/${usd.body.id}/statements`).send({ statementIds: [statementId] }),
    ).expect(400);
    expect(res.body.error.code).toBe('WALLET_STATEMENT_CURRENCY_MISMATCH');
  });

  it('books cash taken out of one account into another as a transfer', async () => {
    const checking = await as(
      owner,
      request(server()).post('/wallets').send({ name: 'Everyday 2', currency }),
    ).expect(201);
    const cash = await as(
      owner,
      request(server()).post('/wallets').send({ name: 'Cash', type: 'cash', currency }),
    ).expect(201);
    const statementId = await seedStatement(owner, currency);
    await as(
      owner,
      request(server())
        .post(`/wallets/${checking.body.id}/statements`)
        .send({ statementIds: [statementId] }),
    ).expect(201);
    const withdrawal = await dataSource
      .getRepository(Transaction)
      .findOneByOrFail({ statementId, transactionType: TransactionType.EXPENSE });

    const res = await as(
      owner,
      request(server())
        .post(`/transactions/${withdrawal.id}/transfer-to-account`)
        .send({ walletId: cash.body.id }),
    ).expect(200);
    expect(res.body.createdId).toEqual(expect.any(String));

    const mirror = await dataSource
      .getRepository(Transaction)
      .findOneByOrFail({ id: res.body.createdId });
    expect(mirror).toMatchObject({
      walletId: cash.body.id,
      transactionType: TransactionType.INCOME,
      transferPairId: res.body.transferPairId,
      isVerified: true,
    });
    const accounts = await listAccounts(owner);
    expect(accounts.find(account => account.id === cash.body.id)?.balance).toBe(spending);

    // Both legs are taken now; the other workspace cannot reach either.
    await as(
      owner,
      request(server())
        .post(`/transactions/${withdrawal.id}/transfer-to-account`)
        .send({ walletId: cash.body.id }),
    ).expect(409);
    await as(
      other,
      request(server())
        .post(`/transactions/${withdrawal.id}/transfer-to-account`)
        .send({ walletId: cash.body.id }),
    ).expect(404);
  });

  it('counts a card as a debt in net worth and starts the forecast from the accounts', async () => {
    const othersCurrency: string = (
      await as(other, request(server()).get('/wallets/summary')).expect(200)
    ).body.currency;
    const before = (await as(other, request(server()).get('/reports/net-worth')).expect(200)).body;
    const owed = 120;
    await as(
      other,
      request(server())
        .post('/wallets')
        .send({ name: 'ACME Card', type: 'credit_card', currency: othersCurrency, initialBalance: -owed }),
    ).expect(201);

    const after = (await as(other, request(server()).get('/reports/net-worth')).expect(200)).body;
    expect(after.currency).toBe(othersCurrency);
    expect(after.liabilitiesTotal).toBe(before.liabilitiesTotal + owed);
    expect(after.current).toBeCloseTo(before.current - owed, 2);

    // The savings account from the earlier test is not spendable; the card's debt is.
    const commitments = (
      await as(other, request(server()).get('/dashboard/commitments')).expect(200)
    ).body;
    expect(commitments.openingBalance).toBe(-owed);
  });

  it('keeps accounts and statements inside their workspace', async () => {
    const [ownersAccount] = await listAccounts(owner);
    const ownersStatement = await seedStatement(owner, currency);
    const [othersAccount] = await listAccounts(other);

    await as(other, request(server()).get(`/wallets/${ownersAccount.id}`)).expect(404);
    await as(other, request(server()).get(`/wallets/${ownersAccount.id}/series`)).expect(404);
    await as(
      other,
      request(server())
        .post(`/wallets/${othersAccount.id}/statements`)
        .send({ statementIds: [ownersStatement] }),
    ).expect(404);
    await as(
      other,
      request(server())
        .post(`/wallets/${ownersAccount.id}/statements`)
        .send({ statementIds: [ownersStatement] }),
    ).expect(404);

    const statement = await dataSource
      .getRepository(Statement)
      .findOneByOrFail({ id: ownersStatement });
    expect(statement.walletId).toBeNull();
    const unlinkedForOther = (
      await as(other, request(server()).get('/wallets/unlinked-statements')).expect(200)
    ).body as Array<{ id: string }>;
    expect(unlinkedForOther.map(row => row.id)).not.toContain(ownersStatement);
  });

  it('suggests the account earlier statements of the same export went to', async () => {
    const exporter = await registerAccount(app, emails.exporter, 'Member Three');
    const exporterCurrency = (
      await as(exporter, request(server()).get('/wallets/summary')).expect(200)
    ).body.currency;
    const export1 = {
      accountNumber: 'Unknown',
      parsingDetails: { metadataExtracted: { institution: 'ACME Bank' } },
    } as Partial<Statement>;
    const export2 = {
      accountNumber: 'Unknown',
      parsingDetails: { metadataExtracted: { normalizedHeader: 'date amount memo' } },
    } as Partial<Statement>;
    const suggestionOf = async (id: string) =>
      (
        (await as(exporter, request(server()).get('/wallets/unlinked-statements')).expect(200))
          .body as Array<{ id: string; suggestedWalletId: string | null }>
      ).find(row => row.id === id)?.suggestedWalletId;

    const walletId: string = (
      await as(
        exporter,
        request(server()).post('/wallets').send({ name: 'Online', type: 'checking' }),
      ).expect(201)
    ).body.id;
    const first = await seedStatement(exporter, exporterCurrency, export1);
    expect(await suggestionOf(first)).toBeNull();
    await as(
      exporter,
      request(server())
        .post(`/wallets/${walletId}/statements`)
        .send({ statementIds: [first] }),
    ).expect(201);

    const next = await seedStatement(exporter, exporterCurrency, export1);
    const unrelated = await seedStatement(exporter, exporterCurrency, export2);
    expect(await suggestionOf(next)).toBe(walletId);
    expect(await suggestionOf(unrelated)).toBeNull();

    await as(exporter, request(server()).delete(`/wallets/${walletId}/statements/${first}`)).expect(
      200,
    );
    expect(await suggestionOf(next)).toBeNull();
  });

  it('imports a sheet into the chosen account, and the next one with its header by itself', async () => {
    const importer = await registerAccount(app, emails.importer, 'Member Four');
    const sheetCurrency = (
      await as(importer, request(server()).get('/wallets/summary')).expect(200)
    ).body.currency;
    const walletId: string = (
      await as(
        importer,
        request(server())
          .post('/wallets')
          .send({ name: 'Online', type: 'checking', currency: sheetCurrency }),
      ).expect(201)
    ).body.id;
    const headers = ['Date', 'Merchant', 'Amount'];
    const importSheet = async (rows: string[][], walletOption?: string) =>
      (
        await as(
          importer,
          request(server())
            .post('/entity-imports')
            .send({
              target: 'transactions',
              mapping: { date: 0, merchant: 1, amount: 2 },
              rows,
              headers,
              fileName: 'export.csv',
              options: { currency: sheetCurrency, categorize: false, walletId: walletOption },
            }),
        ).expect(201)
      ).body.rows.map((row: { id: string }) => row.id) as string[];
    const walletOfRows = async (ids: string[]) =>
      (
        await dataSource.getRepository(Transaction).find({
          where: ids.map(id => ({ id })),
          relations: { statement: true },
        })
      ).map(row => [row.walletId, row.statement?.walletId]);

    const first = await importSheet([['2026-09-01', 'Corner Cafe', '-4.50']], walletId);
    expect(await walletOfRows(first)).toEqual([[walletId, walletId]]);

    const next = await importSheet([['2026-10-01', 'Corner Cafe', '-5.00']]);
    expect(await walletOfRows(next)).toEqual([[walletId, walletId]]);
  });
});
