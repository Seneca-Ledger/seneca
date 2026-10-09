/**
 * Integration test — the manual journal workflow against a real Postgres:
 * draft (unbalanced allowed) -> post (frozen, numbered) -> reverse (mirror
 * entry). Real services and migrations on a scratch database; only the audit
 * sink and the exchange-rate lookup are stubbed.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

import * as entityIndex from '../../src/entities';
import { Branch, Category, CategoryType, User, Workspace } from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import type { JournalLineInputDto } from '../../src/modules/ledger/dto/journal-entry-input.dto';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import { LEDGER_ACCOUNT_CODES } from '../../src/modules/ledger/ledger-default-accounts';
import { LedgerEntriesService } from '../../src/modules/ledger/ledger-entries.service';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_ledger_manual_${process.pid}`;

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

/** The HTTP status and domain code an error would reach the client with. */
async function httpError(promise: Promise<unknown>): Promise<{ status: number; code?: string }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as { code?: string };
      return { status: error.getStatus(), code: body?.code };
    }
    throw error;
  }
  throw new Error('expected the call to fail');
}

describe('manual journal entries (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let entries: LedgerEntriesService;
  let accounts: LedgerAccountsService;
  const audit = { createEvent: jest.fn().mockResolvedValue(undefined) };

  let workspaceId: string;
  let otherWorkspaceId: string;
  let userId: string;
  let codes: Record<string, string>;
  let usdCash: string;
  let eurCash: string;

  const line = (
    accountId: string,
    side: 'debit' | 'credit',
    amount: string,
    extra: Partial<JournalLineInputDto> = {},
  ): JournalLineInputDto => ({ accountId, side, amount, ...extra });

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

    const moduleRef = await Test.createTestingModule({
      providers: [
        LedgerEntriesService,
        LedgerPostingService,
        LedgerAccountsService,
        { provide: AuditService, useValue: audit },
        {
          provide: ExchangeRatesService,
          useValue: {
            getRateQuote: jest.fn(async (from: string, to: string, date: string) =>
              from === 'USD' && to === 'EUR' ? { rate: 0.9137, rateDate: date, stale: false } : null,
            ),
          },
        },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    entries = moduleRef.get(LedgerEntriesService);
    accounts = moduleRef.get(LedgerAccountsService);

    const workspaces = dataSource.getRepository(Workspace);
    workspaceId = (await workspaces.save({ name: 'Manual WS', currency: 'EUR', ledgerBaseCurrency: 'EUR' })).id;
    otherWorkspaceId = (await workspaces.save({ name: 'Other WS', currency: 'EUR', ledgerBaseCurrency: 'EUR' })).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `manual-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Bookkeeper',
          workspaceId,
        }),
      )
    ).id;

    codes = await accounts.systemAccountIds(workspaceId);
    usdCash = await accounts.statementCashAccountId(workspaceId, 'other', 'US-1', 'USD');
    eurCash = await accounts.statementCashAccountId(workspaceId, 'other', 'DE-1', 'EUR');
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  describe('draft -> post -> reverse', () => {
    let draftId: string;

    it('saves an unbalanced draft and shows how far off it is', async () => {
      const draft = await entries.createDraft(workspaceId, userId, {
        entryDate: '2026-09-01',
        memo: '  Owner contribution ',
        lines: [line(eurCash, 'debit', '500.00')],
      });
      draftId = draft.id;
      expect(draft).toMatchObject({
        status: 'draft',
        entryNo: null,
        memo: 'Owner contribution',
        source: 'manual',
        totals: { baseDebit: '500.00', baseCredit: '0.00', difference: '500.00' },
      });
      expect(draft.lines[0]).toMatchObject({ currency: 'EUR', amount: '500.00', side: 'debit' });
    });

    it('refuses to post a draft that is short of lines or out of balance', async () => {
      expect(await httpError(entries.post(workspaceId, draftId, userId))).toEqual({
        status: 422,
        code: 'LEDGER_ENTRY_TOO_FEW_LINES',
      });
      await entries.updateDraft(workspaceId, draftId, {
        lines: [
          line(eurCash, 'debit', '500.00'),
          line(codes[LEDGER_ACCOUNT_CODES.OPENING_BALANCE], 'credit', '499.99'),
        ],
      });
      expect(await httpError(entries.post(workspaceId, draftId, userId))).toEqual({
        status: 422,
        code: 'LEDGER_ENTRY_UNBALANCED',
      });
    });

    it('posts a balanced draft with a number, and posting again changes nothing', async () => {
      await entries.updateDraft(workspaceId, draftId, {
        lines: [
          line(eurCash, 'debit', '500.00'),
          line(codes[LEDGER_ACCOUNT_CODES.OPENING_BALANCE], 'credit', '500.00'),
        ],
      });
      const posted = await entries.post(workspaceId, draftId, userId);
      expect(posted).toMatchObject({
        status: 'posted',
        entryNo: '1',
        totals: { difference: '0.00' },
      });
      expect(posted.postedAt).not.toBeNull();
      expect(audit.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: draftId, meta: expect.objectContaining({ kind: 'ledger_post' }) }),
      );

      audit.createEvent.mockClear();
      const again = await entries.post(workspaceId, draftId, userId);
      expect(again).toMatchObject({ status: 'posted', entryNo: '1' });
      expect(audit.createEvent).not.toHaveBeenCalled();
    });

    it('freezes the posted entry against edits and deletion', async () => {
      expect(await httpError(entries.updateDraft(workspaceId, draftId, { memo: 'x' }))).toEqual({
        status: 409,
        code: 'LEDGER_ENTRY_NOT_DRAFT',
      });
      expect(await httpError(entries.removeDraft(workspaceId, draftId))).toEqual({
        status: 409,
        code: 'LEDGER_ENTRY_NOT_DRAFT',
      });
    });

    it('reverses with a mirror entry dated today by default, once', async () => {
      const reversal = await entries.reverse(workspaceId, draftId, userId, {});
      expect(reversal).toMatchObject({
        status: 'posted',
        reversalOfId: draftId,
        entryNo: '2',
        entryDate: new Date().toISOString().slice(0, 10),
      });
      expect(reversal.lines.map(l => [l.accountId, l.side, l.amount])).toEqual([
        [eurCash, 'credit', '500.00'],
        [codes[LEDGER_ACCOUNT_CODES.OPENING_BALANCE], 'debit', '500.00'],
      ]);

      const original = await entries.findOne(workspaceId, draftId);
      expect(original).toMatchObject({ status: 'reversed', reversedById: reversal.id });

      // Retried request: same reversal back, nothing new booked.
      expect((await entries.reverse(workspaceId, draftId, userId, {})).id).toBe(reversal.id);
      expect(await httpError(entries.reverse(workspaceId, reversal.id, userId, {}))).toEqual({
        status: 409,
        code: 'LEDGER_ENTRY_NOT_REVERSIBLE',
      });
    });
  });

  it('balances a currency exchange only once the FX difference is booked', async () => {
    // 100 USD bought for 92.00 EUR against a 0.9137 reference rate: 0.63 EUR lost.
    const draft = await entries.createDraft(workspaceId, userId, {
      entryDate: '2026-09-02',
      lines: [line(usdCash, 'debit', '100.00'), line(eurCash, 'credit', '92.00')],
    });
    expect(draft.totals.difference).toBe('-0.63');
    expect(draft.lines[0]).toMatchObject({ currency: 'USD', baseAmount: '91.37', fxRate: '0.91370000' });
    expect(await httpError(entries.post(workspaceId, draft.id, userId))).toMatchObject({ status: 422 });

    await entries.updateDraft(workspaceId, draft.id, {
      lines: [
        line(usdCash, 'debit', '100.00'),
        line(eurCash, 'credit', '92.00'),
        line(codes[LEDGER_ACCOUNT_CODES.FX_LOSS], 'debit', '0.63'),
      ],
    });
    await expect(entries.post(workspaceId, draft.id, userId)).resolves.toMatchObject({
      status: 'posted',
    });
  });

  describe('refuses lines it cannot book', () => {
    it.each([
      ['a section header', () => codes[LEDGER_ACCOUNT_CODES.ASSETS], 'EUR', 422, 'LEDGER_ACCOUNT_NOT_POSTABLE'],
      ['a cash account in the wrong currency', () => usdCash, 'EUR', 422, 'LEDGER_ACCOUNT_CURRENCY_MISMATCH'],
      ['a currency with no rate', () => codes[LEDGER_ACCOUNT_CODES.SUSPENSE], 'TRY', 422, 'LEDGER_FX_RATE_MISSING'],
    ])('%s', async (_label, account, currency, status, code) => {
      expect(
        await httpError(
          entries.createDraft(workspaceId, userId, {
            entryDate: '2026-09-03',
            lines: [line(account(), 'debit', '1.00', { currency })],
          }),
        ),
      ).toEqual({ status, code });
    });

    it('an account, category or branch of another workspace', async () => {
      const foreign = await accounts.systemAccountIds(otherWorkspaceId);
      expect(
        await httpError(
          entries.createDraft(workspaceId, userId, {
            entryDate: '2026-09-03',
            lines: [line(foreign[LEDGER_ACCOUNT_CODES.SUSPENSE], 'debit', '1.00')],
          }),
        ),
      ).toEqual({ status: 400, code: 'LEDGER_ACCOUNT_NOT_FOUND' });

      const foreignCategory = await dataSource.getRepository(Category).save({
        workspaceId: otherWorkspaceId,
        name: 'Theirs',
        type: CategoryType.EXPENSE,
      });
      const foreignBranch = await dataSource.getRepository(Branch).save(
        dataSource.getRepository(Branch).create({ workspaceId: otherWorkspaceId, userId, name: 'Theirs' } as Partial<Branch>),
      );
      for (const extra of [{ categoryId: foreignCategory.id }, { branchId: foreignBranch.id }]) {
        expect(
          await httpError(
            entries.createDraft(workspaceId, userId, {
              entryDate: '2026-09-03',
              lines: [line(codes[LEDGER_ACCOUNT_CODES.SUSPENSE], 'debit', '1.00', extra)],
            }),
          ),
        ).toEqual({ status: 400, code: 'LEDGER_LINE_REFERENCE_NOT_FOUND' });
      }
    });

    it('a zero amount', async () => {
      expect(
        await httpError(
          entries.createDraft(workspaceId, userId, {
            entryDate: '2026-09-03',
            lines: [line(codes[LEDGER_ACCOUNT_CODES.SUSPENSE], 'debit', '0.00')],
          }),
        ),
      ).toMatchObject({ status: 400 });
    });
  });

  it('keeps entries invisible to other workspaces', async () => {
    const list = await entries.list(workspaceId, {});
    const someId = list.data[0].id;
    expect(await httpError(entries.findOne(otherWorkspaceId, someId))).toEqual({
      status: 404,
      code: 'LEDGER_ENTRY_NOT_FOUND',
    });
    expect(await httpError(entries.post(otherWorkspaceId, someId, userId))).toMatchObject({ status: 404 });
    expect(await httpError(entries.reverse(otherWorkspaceId, someId, userId, {}))).toMatchObject({
      status: 404,
    });
    expect((await entries.list(otherWorkspaceId, {})).total).toBe(0);
  });

  it('deletes a draft, and only a draft', async () => {
    const draft = await entries.createDraft(workspaceId, userId, { entryDate: '2026-09-04', lines: [] });
    await entries.removeDraft(workspaceId, draft.id);
    expect(await httpError(entries.findOne(workspaceId, draft.id))).toMatchObject({ status: 404 });
  });

  it('lists with filters and pagination', async () => {
    const all = await entries.list(workspaceId, { limit: 2 });
    expect(all).toMatchObject({ page: 1, limit: 2, totalPages: Math.ceil(all.total / 2) });
    expect(all.data).toHaveLength(2);

    const reversed = await entries.list(workspaceId, { status: 'reversed' as never });
    expect(reversed.data.map(entry => entry.status)).toEqual(['reversed']);
    expect(reversed.data[0].baseTotal).toBe('500.00');

    const onUsdCash = await entries.list(workspaceId, { accountId: usdCash });
    expect(onUsdCash.total).toBe(1);
    expect(onUsdCash.data[0].entryDate).toBe('2026-09-02');
  });

  it('refuses everything while the ledger is off', async () => {
    const off = (await dataSource.getRepository(Workspace).save({ name: 'Off WS', currency: 'USD' })).id;
    expect(
      await httpError(entries.createDraft(off, userId, { entryDate: '2026-09-01', lines: [] })),
    ).toEqual({ status: 409, code: 'LEDGER_DISABLED' });
  });

  it('leaves every booked entry balanced', async () => {
    const unbalanced = await dataSource.query(
      `SELECT e."id" FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE e."status" <> 'draft'
        GROUP BY e."id" HAVING sum(l."base_debit") <> sum(l."base_credit")`,
    );
    expect(unbalanced).toEqual([]);
  });
});
