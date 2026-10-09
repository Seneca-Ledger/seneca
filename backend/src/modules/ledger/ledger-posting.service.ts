import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, Not, type Repository } from 'typeorm';
import { toMinor } from '../../common/utils/money.util';
import {
  CryptoWallet,
  JournalEntry,
  JournalEntrySource,
  JournalEntryStatus,
  JournalLine,
  Payable,
  PayableSource,
  Statement,
  Transaction,
  Wallet,
  Workspace,
} from '../../entities';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { LedgerAccountsService, statementCashKey } from './ledger-accounts.service';
import { LEDGER_ACCOUNT_CODES } from './ledger-default-accounts';
import {
  type BaseLine,
  fromLineColumns,
  type Leg,
  openingBalanceLegs,
  reversedLines,
  type SkipReason,
  sameLines,
  skipReason,
  type TransactionFacts,
  toBaseLines,
  toLineColumns,
  transactionLegs,
} from './ledger-posting.rules';

export type LedgerPostingErrorCode =
  | 'LEDGER_DISABLED'
  | 'FX_RATE_MISSING'
  | 'TRANSACTION_CHANGED'
  | 'NOT_REVERSIBLE';

/** How far back a rate may be borrowed when none was quoted on the entry's own day. */
export const LEDGER_MAX_RATE_AGE_DAYS = 7;

/**
 * A posting that cannot go ahead as asked. `TRANSACTION_CHANGED` is the one a
 * caller should simply retry: the source was edited between reading it and
 * locking it.
 */
export class LedgerPostingError extends Error {
  constructor(
    readonly code: LedgerPostingErrorCode,
    message: string,
    readonly params: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'LedgerPostingError';
  }
}

export type PostingOutcome =
  | { status: 'posted' | 'reposted' | 'unchanged'; entryId: string }
  | { status: 'reversed'; entryId: string }
  | { status: 'skipped'; reason: NotBooked | 'not_found' };

/**
 * Why a source is not booked. Beyond the rules' own reasons: a statement in
 * the trash hides its transactions everywhere else in the app (lists and
 * reports filter them out), so the ledger leaves them out too until the
 * statement is restored.
 */
type NotBooked =
  | SkipReason
  | 'statement_deleted'
  | 'no_balance_start'
  | 'wallet_backed_by_statement';

/**
 * One opening balance's result. `failed` (a missing rate, usually) leaves that
 * source as it was booked and does not stop the others.
 */
export interface OpeningResult {
  cashAccountId: string | null;
  outcome: PostingOutcome | { status: 'failed'; error: string };
}

export interface EntryDraft {
  workspaceId: string;
  entryDate: string;
  baseCurrency: string;
  memo: string | null;
  source: JournalEntrySource;
  sourceTransactionId?: string | null;
  reversalOfId?: string | null;
  lines: BaseLine[];
  userId?: string | null;
}

type EntryPlan = Pick<EntryDraft, 'entryDate' | 'baseCurrency' | 'memo' | 'lines'>;

export interface InvoicePostingLine {
  /** Net amount, before tax, major units. */
  amount: number;
  /** Tax on this line, major units; 0 when untaxed. */
  taxAmount: number;
  /** Income category the line's revenue books to; falls back to Sales revenue. */
  categoryId?: string | null;
}

export interface PostInvoiceParams {
  workspaceId: string;
  entryDate: string;
  currency: string;
  lines: InvoicePostingLine[];
  memo?: string | null;
  userId?: string | null;
}

const MEMO_LIMIT = 500;

/** `date` columns arrive as 'YYYY-MM-DD' strings; tests and callers may pass Dates. */
function toDateOnly(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function factsOf(tx: Transaction): TransactionFacts {
  return {
    transactionType: tx.transactionType,
    amount: tx.amount,
    debit: tx.debit,
    credit: tx.credit,
    taxAmount: tx.taxAmount,
    taxReverseCharge: tx.taxReverseCharge,
    taxNotionalAmount: tx.taxNotionalAmount,
    isDuplicate: tx.isDuplicate,
    isVerified: tx.isVerified,
    cryptoWalletId: tx.cryptoWalletId,
    categoryId: tx.categoryId,
    branchId: tx.branchId,
  };
}

/** Everything the entry depends on. A change between plan and lock means re-plan. */
function postingFingerprint(tx: Transaction): string {
  return JSON.stringify([
    factsOf(tx),
    tx.currency,
    toDateOnly(tx.transactionDate),
    tx.statementId,
    tx.walletId,
  ]);
}

/**
 * Turns transactions and opening balances into balanced journal entries.
 *
 * Every write follows the one sequence the database accepts for a booked
 * entry: insert a draft, insert its lines, take a number, flip it to posted —
 * all in one transaction, checked for balance at COMMIT. A booked entry is
 * never edited: a changed source is reversed and booked again.
 */
@Injectable()
export class LedgerPostingService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(JournalEntry)
    private readonly entryRepository: Repository<JournalEntry>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(CryptoWallet)
    private readonly cryptoWalletRepository: Repository<CryptoWallet>,
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
    private readonly accountsService: LedgerAccountsService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  /** The ledger's base currency; the ledger is off for a workspace without one. */
  async baseCurrencyOf(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['id', 'ledgerBaseCurrency'],
    });
    if (!workspace?.ledgerBaseCurrency) {
      throw new LedgerPostingError(
        'LEDGER_DISABLED',
        `The ledger is not enabled for workspace ${workspaceId}`,
      );
    }
    return workspace.ledgerBaseCurrency;
  }

  /**
   * Brings the ledger in line with one transaction. Idempotent: an unchanged
   * transaction leaves its entry alone; a changed one gets its entry reversed
   * and a new one booked; one that should no longer be booked (now a
   * duplicate, say) only gets the reversal.
   */
  async postTransaction(workspaceId: string, transactionId: string): Promise<PostingOutcome> {
    const baseCurrency = await this.baseCurrencyOf(workspaceId);
    const planned = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
    });
    if (!planned) {
      return { status: 'skipped', reason: 'not_found' };
    }

    // Accounts and the rate are resolved before the transaction opens: the
    // rate lookup may go to an external API, which must not happen under a lock.
    const plan = await this.planTransaction(planned, baseCurrency);

    return this.entryRepository.manager.transaction(async manager => {
      const locked = await manager.getRepository(Transaction).findOne({
        where: { id: transactionId, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        return { status: 'skipped', reason: 'not_found' } as const;
      }
      if (postingFingerprint(locked) !== postingFingerprint(planned)) {
        throw new LedgerPostingError(
          'TRANSACTION_CHANGED',
          `Transaction ${transactionId} changed while it was being posted`,
        );
      }

      const live = await this.liveTransactionEntry(manager, workspaceId, transactionId);
      const outcome = await this.reconcile(manager, live, plan, {
        workspaceId,
        source: JournalEntrySource.TRANSACTION,
        sourceTransactionId: transactionId,
      });
      // Cleared under the same row lock that guards the posting: an edit made
      // after this commits re-dirties the row through the trigger. Raw SQL so
      // the row's updated_at is not touched by a bookkeeping flag.
      await manager.query(
        `UPDATE "transactions"
            SET "ledger_dirty" = false, "ledger_posted_at" = now(),
                "ledger_error" = NULL, "ledger_attempted_at" = NULL
          WHERE "id" = $1`,
        [transactionId],
      );
      return outcome;
    });
  }

  /**
   * Books the accrual entry for a sent invoice: Dr Accounts Receivable for
   * the full amount, Cr each line's income account (or Sales revenue with no
   * category) for its net amount, Cr VAT payable for the tax total. Booked in
   * the caller's transaction, alongside assigning the invoice's number and
   * opening its receivable, so all three either happen together or not at all.
   */
  async postInvoice(manager: EntityManager, params: PostInvoiceParams): Promise<JournalEntry> {
    const baseCurrency = await this.baseCurrencyOf(params.workspaceId);
    const system = await this.accountsService.systemAccountIds(params.workspaceId);
    const receivablesAccountId = system[LEDGER_ACCOUNT_CODES.RECEIVABLES];
    const salesRevenueAccountId = system[LEDGER_ACCOUNT_CODES.SALES_REVENUE];

    const legs: Leg[] = [];
    let grossMinor = 0;
    let taxMinor = 0;
    for (const line of params.lines) {
      const netLineMinor = toMinor(line.amount);
      const taxLineMinor = toMinor(line.taxAmount || 0);
      if (netLineMinor === 0 && taxLineMinor === 0) {
        continue;
      }
      const counterpartAccountId = line.categoryId
        ? ((await this.accountsService.categoryAccountId(params.workspaceId, line.categoryId)) ??
          salesRevenueAccountId)
        : salesRevenueAccountId;
      if (netLineMinor !== 0) {
        legs.push({
          accountId: counterpartAccountId,
          side: 'credit',
          amountMinor: netLineMinor,
          categoryId: line.categoryId ?? null,
        });
      }
      grossMinor += netLineMinor + taxLineMinor;
      taxMinor += taxLineMinor;
    }
    if (taxMinor !== 0) {
      legs.push({
        accountId: system[LEDGER_ACCOUNT_CODES.VAT_PAYABLE],
        side: 'credit',
        amountMinor: taxMinor,
      });
    }
    if (grossMinor === 0) {
      throw new BadRequestException('Cannot post a zero-amount invoice to the ledger');
    }
    legs.push({ accountId: receivablesAccountId, side: 'debit', amountMinor: grossMinor });

    const currency = params.currency.toUpperCase();
    const lines = await this.convert(
      legs,
      currency,
      baseCurrency,
      params.entryDate,
      params.workspaceId,
    );

    return this.book(manager, {
      workspaceId: params.workspaceId,
      entryDate: params.entryDate,
      baseCurrency,
      memo: params.memo ?? null,
      source: JournalEntrySource.INVOICE,
      lines,
      userId: params.userId ?? null,
    });
  }

  /**
   * Books a credit note: the mirror of `postInvoice`. Dr each line's income
   * account for its net amount and Dr VAT payable for the tax — revenue that
   * was recognised is taken back — and Cr Accounts Receivable for the gross,
   * so the client's debt falls by exactly what the note credits.
   */
  async postCreditNote(manager: EntityManager, params: PostInvoiceParams): Promise<JournalEntry> {
    const baseCurrency = await this.baseCurrencyOf(params.workspaceId);
    const system = await this.accountsService.systemAccountIds(params.workspaceId);
    const receivablesAccountId = system[LEDGER_ACCOUNT_CODES.RECEIVABLES];
    const salesRevenueAccountId = system[LEDGER_ACCOUNT_CODES.SALES_REVENUE];

    const legs: Leg[] = [];
    let grossMinor = 0;
    let taxMinor = 0;
    for (const line of params.lines) {
      const netLineMinor = toMinor(line.amount);
      const taxLineMinor = toMinor(line.taxAmount || 0);
      if (netLineMinor === 0 && taxLineMinor === 0) {
        continue;
      }
      const counterpartAccountId = line.categoryId
        ? ((await this.accountsService.categoryAccountId(params.workspaceId, line.categoryId)) ??
          salesRevenueAccountId)
        : salesRevenueAccountId;
      if (netLineMinor !== 0) {
        legs.push({
          accountId: counterpartAccountId,
          side: 'debit',
          amountMinor: netLineMinor,
          categoryId: line.categoryId ?? null,
        });
      }
      grossMinor += netLineMinor + taxLineMinor;
      taxMinor += taxLineMinor;
    }
    if (taxMinor !== 0) {
      legs.push({
        accountId: system[LEDGER_ACCOUNT_CODES.VAT_PAYABLE],
        side: 'debit',
        amountMinor: taxMinor,
      });
    }
    if (grossMinor === 0) {
      throw new BadRequestException('Cannot post a zero-amount credit note to the ledger');
    }
    legs.push({ accountId: receivablesAccountId, side: 'credit', amountMinor: grossMinor });

    const currency = params.currency.toUpperCase();
    const lines = await this.convert(
      legs,
      currency,
      baseCurrency,
      params.entryDate,
      params.workspaceId,
    );

    return this.book(manager, {
      workspaceId: params.workspaceId,
      entryDate: params.entryDate,
      baseCurrency,
      memo: params.memo ?? null,
      source: JournalEntrySource.CREDIT_NOTE,
      lines,
      userId: params.userId ?? null,
    });
  }

  /**
   * Reverses a posted entry with a mirror entry, dated like the original
   * unless a date is given. A reversal is not itself reversible: post the
   * correction as a new entry instead.
   */
  async reverseEntry(
    workspaceId: string,
    entryId: string,
    options: { userId?: string | null; date?: string } = {},
  ): Promise<JournalEntry> {
    return this.entryRepository.manager.transaction(async manager => {
      const entry = await manager.getRepository(JournalEntry).findOne({
        where: { id: entryId, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entry) {
        throw new NotFoundException('Journal entry not found');
      }
      if (entry.status !== JournalEntryStatus.POSTED) {
        throw new LedgerPostingError('NOT_REVERSIBLE', 'Only a posted entry can be reversed');
      }
      if (entry.reversalOfId) {
        throw new LedgerPostingError('NOT_REVERSIBLE', 'A reversal entry cannot be reversed');
      }
      entry.lines = await manager.getRepository(JournalLine).find({
        where: { entryId: entry.id },
        order: { lineNo: 'ASC' },
      });
      return this.reverseWithin(manager, entry, options);
    });
  }

  /**
   * Reverses the live entries of deleted transactions. Transactions are hard
   * deleted and the foreign key nulls the entry's link, which is exactly how
   * such an entry is recognised: a live transaction entry with no source.
   * The reversal is dated like the original, so every period stays as if the
   * transaction had never been booked.
   */
  async reverseOrphans(workspaceId: string): Promise<number> {
    const orphans = await this.entryRepository.find({
      where: {
        workspaceId,
        source: JournalEntrySource.TRANSACTION,
        status: JournalEntryStatus.POSTED,
        reversalOfId: IsNull(),
        sourceTransactionId: IsNull(),
      },
      select: ['id'],
    });
    let reversed = 0;
    for (const orphan of orphans) {
      try {
        await this.reverseEntry(workspaceId, orphan.id);
        reversed += 1;
      } catch (error) {
        // Another sweep got there first.
        if (!(error instanceof LedgerPostingError && error.code === 'NOT_REVERSIBLE')) {
          throw error;
        }
      }
    }
    return reversed;
  }

  /**
   * Opening balance of every statement cash account: the `balance_start` of
   * its earliest statement against EQUITY_OPENING_BALANCE. A later statement's
   * starting balance is never used — the transactions before it are already
   * in the ledger, and it would count them twice. Idempotent per account.
   *
   * Likewise the `initial_balance` of every active wallet, on its own cash
   * account. An opening whose source is gone (statements trashed, wallet
   * deleted, deactivated or zeroed) is reversed.
   */
  async postOpeningBalances(workspaceId: string): Promise<OpeningResult[]> {
    const baseCurrency = await this.baseCurrencyOf(workspaceId);
    const system = await this.accountsService.systemAccountIds(workspaceId);
    const statements = await this.statementRepository.find({
      where: { workspaceId, deletedAt: IsNull() },
      select: [
        'id',
        'bankName',
        'accountNumber',
        'currency',
        'balanceStart',
        'statementDateFrom',
        'createdAt',
      ],
      order: { statementDateFrom: 'ASC', createdAt: 'ASC' },
    });

    // Undated statements sort last in Postgres, so the first seen per key is the earliest.
    const earliest = new Map<string, Statement>();
    for (const statement of statements) {
      const key = statementCashKey(statement.bankName, statement.accountNumber, statement.currency);
      if (!earliest.has(key)) {
        earliest.set(key, statement);
      }
    }

    const openingAccountId = system[LEDGER_ACCOUNT_CODES.OPENING_BALANCE];
    const results: OpeningResult[] = [];
    for (const statement of earliest.values()) {
      results.push(
        await this.postOpeningBalance(workspaceId, statement, baseCurrency, openingAccountId),
      );
    }

    const wallets = await this.walletRepository.find({
      where: { workspaceId, isActive: true, initialBalance: Not(0) },
      select: ['id', 'name', 'currency', 'initialBalance', 'createdAt'],
    });
    for (const wallet of wallets) {
      results.push(
        await this.postWalletOpeningBalance(workspaceId, wallet, baseCurrency, openingAccountId),
      );
    }

    // An account none of the above booked keeps no opening balance.
    const visited = new Set(results.map(result => result.cashAccountId));
    for (const entry of await this.liveOpeningEntries(workspaceId)) {
      const cashLine = entry.lines.find(line => line.accountId !== openingAccountId);
      if (cashLine && !visited.has(cashLine.accountId)) {
        const outcome = await this.entryRepository.manager.transaction(async manager => {
          await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
            `ledger-opening:${workspaceId}`,
          ]);
          const live = await this.liveOpeningEntry(manager, workspaceId, cashLine.accountId);
          return this.reconcile(
            manager,
            live,
            { skip: 'statement_deleted' },
            {
              workspaceId,
              source: JournalEntrySource.OPENING_BALANCE,
            },
          );
        });
        results.push({ cashAccountId: cashLine.accountId, outcome });
      }
    }
    return results;
  }

  private liveOpeningEntries(workspaceId: string): Promise<JournalEntry[]> {
    return this.entryRepository.find({
      where: {
        workspaceId,
        source: JournalEntrySource.OPENING_BALANCE,
        status: JournalEntryStatus.POSTED,
        reversalOfId: IsNull(),
      },
      relations: { lines: true },
    });
  }

  private async postOpeningBalance(
    workspaceId: string,
    statement: Statement,
    baseCurrency: string,
    openingAccountId: string,
  ): Promise<OpeningResult> {
    const currency = statement.currency.toUpperCase();
    const cashAccountId = await this.accountsService.statementCashAccountId(
      workspaceId,
      statement.bankName,
      statement.accountNumber,
      currency,
    );
    const legs = openingBalanceLegs(statement.balanceStart, cashAccountId, openingAccountId);
    const entryDate = toDateOnly(statement.statementDateFrom ?? statement.createdAt);
    // An unknown starting balance withdraws one booked earlier, like a zero one.
    const unknown = statement.balanceStart === null || statement.balanceStart === undefined;
    const plan = unknown
      ? ({ skip: 'no_balance_start' } as const)
      : await this.openingPlan(legs, currency, baseCurrency, entryDate, workspaceId);
    if ('failed' in plan) {
      return { cashAccountId, outcome: { status: 'failed', error: plan.failed } };
    }

    const outcome = await this.reconcileOpening(workspaceId, cashAccountId, plan);
    return { cashAccountId, outcome };
  }

  /**
   * A wallet's `initial_balance`, dated by its first transaction (or by when
   * the wallet was created). A wallet with statement rows mirrors a bank
   * account whose statements already carry its opening balance; booking both
   * would count it twice, so the statement wins.
   */
  private async postWalletOpeningBalance(
    workspaceId: string,
    wallet: Wallet,
    baseCurrency: string,
    openingAccountId: string,
  ): Promise<OpeningResult> {
    const mirrorsStatement = await this.transactionRepository.exists({
      where: { workspaceId, walletId: wallet.id, statementId: Not(IsNull()) },
    });
    if (mirrorsStatement) {
      return {
        cashAccountId: null,
        outcome: { status: 'skipped', reason: 'wallet_backed_by_statement' },
      };
    }

    const currency = wallet.currency.toUpperCase();
    const cashAccountId = await this.accountsService.walletCashAccountId(
      workspaceId,
      wallet,
      currency,
    );
    if (!cashAccountId) {
      return { cashAccountId: null, outcome: { status: 'skipped', reason: 'not_found' } };
    }
    const first = await this.transactionRepository.findOne({
      where: { workspaceId, walletId: wallet.id },
      select: ['id', 'transactionDate'],
      order: { transactionDate: 'ASC' },
    });
    const entryDate = toDateOnly(first?.transactionDate ?? wallet.createdAt);
    const legs = openingBalanceLegs(wallet.initialBalance, cashAccountId, openingAccountId);
    const plan = await this.openingPlan(legs, currency, baseCurrency, entryDate, workspaceId);
    if ('failed' in plan) {
      return { cashAccountId, outcome: { status: 'failed', error: plan.failed } };
    }

    const outcome = await this.reconcileOpening(workspaceId, cashAccountId, plan);
    return { cashAccountId, outcome };
  }

  /** The opening entry to book, or why it cannot be booked right now. */
  private async openingPlan(
    legs: Leg[],
    currency: string,
    baseCurrency: string,
    entryDate: string,
    workspaceId: string,
  ): Promise<EntryPlan | { skip: NotBooked } | { failed: string }> {
    if (legs.length === 0) {
      return { skip: 'zero_amount' };
    }
    try {
      return {
        entryDate,
        baseCurrency,
        memo: 'Opening balance',
        lines: await this.convert(legs, currency, baseCurrency, entryDate, workspaceId),
      };
    } catch (error) {
      if (error instanceof LedgerPostingError) {
        return { failed: `${error.code}: ${error.message}` };
      }
      throw error;
    }
  }

  private reconcileOpening(
    workspaceId: string,
    cashAccountId: string,
    plan: EntryPlan | { skip: NotBooked },
  ): Promise<PostingOutcome> {
    return this.entryRepository.manager.transaction(async manager => {
      // Two runs for one workspace would both find no opening entry and both book one.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `ledger-opening:${workspaceId}`,
      ]);
      const live = await this.liveOpeningEntry(manager, workspaceId, cashAccountId);
      return this.reconcile(manager, live, plan, {
        workspaceId,
        source: JournalEntrySource.OPENING_BALANCE,
      });
    });
  }

  /**
   * Makes the booked state match the plan, given the entry currently live for
   * the same source: leave it, reverse it, or reverse it and book the plan.
   */
  private async reconcile(
    manager: EntityManager,
    live: JournalEntry | null,
    plan: EntryPlan | { skip: NotBooked },
    target: Pick<EntryDraft, 'workspaceId' | 'source' | 'sourceTransactionId'>,
  ): Promise<PostingOutcome> {
    if ('skip' in plan) {
      if (!live) {
        return { status: 'skipped', reason: plan.skip };
      }
      const reversal = await this.reverseWithin(manager, live);
      return { status: 'reversed', entryId: reversal.id };
    }
    if (live && this.bookedAsPlanned(live, plan)) {
      return { status: 'unchanged', entryId: live.id };
    }
    if (live) {
      await this.reverseWithin(manager, live);
    }
    const entry = await this.book(manager, { ...target, ...plan });
    return { status: live ? 'reposted' : 'posted', entryId: entry.id };
  }

  /**
   * Books one entry: draft, lines, number, posted — in the caller's
   * transaction, re-checked for balance by the database at COMMIT.
   */
  async book(manager: EntityManager, draft: EntryDraft): Promise<JournalEntry> {
    const entry = await this.insertDraft(manager, draft);
    return this.promote(manager, entry, draft.userId ?? null);
  }

  /** Stores an entry as a draft with its lines. Drafts may be unbalanced. */
  async insertDraft(manager: EntityManager, draft: EntryDraft): Promise<JournalEntry> {
    const entries = manager.getRepository(JournalEntry);
    const entry = await entries.save(
      entries.create({
        workspaceId: draft.workspaceId,
        entryDate: draft.entryDate,
        baseCurrency: draft.baseCurrency,
        memo: draft.memo,
        source: draft.source,
        sourceTransactionId: draft.sourceTransactionId ?? null,
        reversalOfId: draft.reversalOfId ?? null,
        status: JournalEntryStatus.DRAFT,
        createdBy: draft.userId ?? null,
      }),
    );
    await this.replaceLines(manager, entry.id, draft.lines);
    return entry;
  }

  /** Swaps a draft's lines. The database refuses this on a booked entry. */
  async replaceLines(manager: EntityManager, entryId: string, lines: BaseLine[]): Promise<void> {
    const repo = manager.getRepository(JournalLine);
    await repo.delete({ entryId });
    if (lines.length > 0) {
      await repo.insert(
        lines.map((line, index) => ({ entryId, lineNo: index + 1, ...toLineColumns(line) })),
      );
    }
  }

  /** Draft -> posted: takes the next number and stamps the moment and the poster. */
  async promote(
    manager: EntityManager,
    entry: JournalEntry,
    userId: string | null,
  ): Promise<JournalEntry> {
    const entryNo = await this.nextEntryNo(manager, entry.workspaceId);
    const postedAt = new Date();
    await manager
      .getRepository(JournalEntry)
      .update(
        { id: entry.id },
        { status: JournalEntryStatus.POSTED, entryNo, postedAt, postedBy: userId },
      );
    return Object.assign(entry, {
      status: JournalEntryStatus.POSTED,
      entryNo,
      postedAt,
      postedBy: userId,
    });
  }

  /**
   * Rate from `currency` to the base on `date`; 1 for the base itself. A rate
   * borrowed from an earlier day is accepted up to LEDGER_MAX_RATE_AGE_DAYS old.
   */
  async rateFor(
    currency: string,
    baseCurrency: string,
    date: string,
    workspaceId: string,
  ): Promise<number> {
    if (currency.toUpperCase() === baseCurrency.toUpperCase()) {
      return 1;
    }
    const quote = await this.exchangeRatesService.getRateQuote(currency, baseCurrency, date, {
      maxStaleDays: LEDGER_MAX_RATE_AGE_DAYS,
      workspaceId,
    });
    const rate = quote?.rate ?? null;
    if (rate === null) {
      throw new LedgerPostingError(
        'FX_RATE_MISSING',
        `No ${currency}->${baseCurrency} exchange rate for ${date}`,
        { from: currency, to: baseCurrency, date },
      );
    }
    return rate;
  }

  private async planTransaction(
    tx: Transaction,
    baseCurrency: string,
  ): Promise<EntryPlan | { skip: NotBooked }> {
    const facts = factsOf(tx);
    const early = skipReason(facts);
    if (early) {
      return { skip: early };
    }
    const statement = tx.statementId
      ? await this.statementRepository.findOne({
          where: { id: tx.statementId, workspaceId: tx.workspaceId },
          select: ['id', 'bankName', 'accountNumber', 'deletedAt'],
        })
      : null;
    if (statement?.deletedAt) {
      return { skip: 'statement_deleted' };
    }

    const currency = tx.currency.toUpperCase();
    const system = await this.accountsService.systemAccountIds(tx.workspaceId);
    // Settling an invoice-sourced receivable clears Accounts Receivable rather
    // than booking new income: the revenue was already booked when the
    // invoice was sent, and booking it again here would count it twice.
    // Either the bill's single legacy link or any payment row pointing at this
    // transaction: one wire can settle four invoices, and each of those is a
    // payment, not a link.
    const [{ settles }]: Array<{ settles: boolean }> = await this.payableRepository.query(
      `SELECT EXISTS (
         SELECT 1
           FROM "payables" p
           LEFT JOIN "payable_payments" pp ON pp."payable_id" = p."id"
          WHERE p."workspace_id" = $1
            AND p."source" = $2
            AND p."deleted_at" IS NULL
            AND (p."linked_transaction_id" = $3 OR pp."transaction_id" = $3)
       ) AS "settles"`,
      [tx.workspaceId, PayableSource.INVOICE, tx.id],
    );
    const settlesInvoice = settles;
    const counterpart = settlesInvoice
      ? system[LEDGER_ACCOUNT_CODES.RECEIVABLES]
      : tx.categoryId
        ? await this.accountsService.categoryAccountId(tx.workspaceId, tx.categoryId)
        : null;
    const cash = await this.cashAccountOf(tx, statement, currency);

    const result = transactionLegs(facts, {
      cash: cash ?? system[LEDGER_ACCOUNT_CODES.CASH_UNALLOCATED],
      counterpart: counterpart ?? system[LEDGER_ACCOUNT_CODES.SUSPENSE],
      vatReceivable: system[LEDGER_ACCOUNT_CODES.VAT_RECEIVABLE],
      vatPayable: system[LEDGER_ACCOUNT_CODES.VAT_PAYABLE],
    });
    if ('skip' in result) {
      return result;
    }

    const entryDate = toDateOnly(tx.transactionDate);
    const memo =
      [tx.counterpartyName, tx.paymentPurpose]
        .map(part => part?.trim())
        .filter(Boolean)
        .join(' — ')
        .slice(0, MEMO_LIMIT) || null;

    return {
      entryDate,
      baseCurrency,
      memo,
      lines: await this.convert(result.legs, currency, baseCurrency, entryDate, tx.workspaceId),
    };
  }

  /** Statement, then wallet, then crypto wallet; null sends the money to CASH_UNALLOCATED. */
  private async cashAccountOf(
    tx: Transaction,
    statement: Statement | null,
    currency: string,
  ): Promise<string | null> {
    if (statement) {
      return this.accountsService.statementCashAccountId(
        tx.workspaceId,
        statement.bankName,
        statement.accountNumber,
        currency,
      );
    }
    if (tx.walletId) {
      const wallet = await this.walletRepository.findOne({
        where: { id: tx.walletId, workspaceId: tx.workspaceId },
        select: ['id', 'name', 'currency'],
      });
      if (wallet) {
        return this.accountsService.walletCashAccountId(tx.workspaceId, wallet, currency);
      }
    }
    if (tx.cryptoWalletId) {
      const cryptoWallet = await this.cryptoWalletRepository.findOne({
        where: { id: tx.cryptoWalletId, workspaceId: tx.workspaceId },
        select: ['id', 'label', 'address'],
      });
      if (cryptoWallet) {
        return this.accountsService.cryptoAccountId(tx.workspaceId, cryptoWallet);
      }
    }
    return null;
  }

  private async convert(
    legs: Leg[],
    currency: string,
    baseCurrency: string,
    entryDate: string,
    workspaceId: string,
  ): Promise<BaseLine[]> {
    const rate = await this.rateFor(currency, baseCurrency, entryDate, workspaceId);
    return toBaseLines(legs, currency, baseCurrency, rate);
  }

  private bookedAsPlanned(entry: JournalEntry, plan: EntryPlan): boolean {
    // The memo is description, not money: editing it does not warrant a reversal.
    return (
      toDateOnly(entry.entryDate) === plan.entryDate &&
      entry.baseCurrency === plan.baseCurrency &&
      sameLines(entry.lines.map(fromLineColumns), plan.lines)
    );
  }

  /** Books the reversal of `entry` in the caller's transaction and marks it reversed. */
  async reverseWithin(
    manager: EntityManager,
    entry: JournalEntry,
    options: { userId?: string | null; date?: string } = {},
  ): Promise<JournalEntry> {
    const lines = [...entry.lines].sort((a, b) => a.lineNo - b.lineNo).map(fromLineColumns);
    const reversal = await this.book(manager, {
      workspaceId: entry.workspaceId,
      entryDate: options.date ?? toDateOnly(entry.entryDate),
      baseCurrency: entry.baseCurrency,
      memo: `Reversal of #${entry.entryNo}`,
      source: entry.source,
      sourceTransactionId: entry.sourceTransactionId,
      reversalOfId: entry.id,
      lines: reversedLines(lines),
      userId: options.userId,
    });
    await manager
      .getRepository(JournalEntry)
      .update({ id: entry.id }, { status: JournalEntryStatus.REVERSED });
    return reversal;
  }

  private liveTransactionEntry(
    manager: EntityManager,
    workspaceId: string,
    transactionId: string,
  ): Promise<JournalEntry | null> {
    return manager.getRepository(JournalEntry).findOne({
      where: {
        workspaceId,
        sourceTransactionId: transactionId,
        source: JournalEntrySource.TRANSACTION,
        status: JournalEntryStatus.POSTED,
        reversalOfId: IsNull(),
      },
      relations: { lines: true },
    });
  }

  private liveOpeningEntry(
    manager: EntityManager,
    workspaceId: string,
    cashAccountId: string,
  ): Promise<JournalEntry | null> {
    return manager
      .getRepository(JournalEntry)
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.lines', 'line')
      .where('entry.workspaceId = :workspaceId', { workspaceId })
      .andWhere('entry.source = :source', { source: JournalEntrySource.OPENING_BALANCE })
      .andWhere('entry.status = :status', { status: JournalEntryStatus.POSTED })
      .andWhere('entry.reversalOfId IS NULL')
      .andWhere(
        'EXISTS (SELECT 1 FROM "journal_lines" cash WHERE cash."entry_id" = entry.id AND cash."account_id" = :cashAccountId)',
        { cashAccountId },
      )
      .getOne();
  }

  /** Per-workspace, gap-free: the counter row is locked until this transaction ends. */
  private async nextEntryNo(manager: EntityManager, workspaceId: string): Promise<string> {
    await manager.query(
      'INSERT INTO "ledger_counters" ("workspace_id") VALUES ($1) ON CONFLICT DO NOTHING',
      [workspaceId],
    );
    // Wrapped in a SELECT so the driver returns plain rows rather than [rows, count].
    const rows: Array<{ entry_no: string }> = await manager.query(
      `WITH taken AS (
         UPDATE "ledger_counters" SET "next_entry_no" = "next_entry_no" + 1
          WHERE "workspace_id" = $1
          RETURNING "next_entry_no" - 1 AS "entry_no"
       )
       SELECT "entry_no" FROM taken`,
      [workspaceId],
    );
    return String(rows[0].entry_no);
  }
}
