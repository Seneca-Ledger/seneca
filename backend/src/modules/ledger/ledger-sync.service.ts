import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import {
  ActorType,
  AuditAction,
  EntityType,
  JournalEntry,
  JournalEntrySource,
  JournalEntryStatus,
  Statement,
  Workspace,
} from '../../entities';
import { AuditService } from '../audit/audit.service';
import { statementCashKey } from './ledger-accounts.service';
import { LedgerPostingError, LedgerPostingService } from './ledger-posting.service';
import { LedgerSyncQueue } from './queue/ledger-sync.queue';

/** Rows per query while draining a workspace. */
const BATCH_SIZE = 200;
/** Upper bound on one job's work; the next sweep picks up the rest. */
const MAX_ROUNDS = 100;
/** A row that failed (a missing rate, say) is left alone this long before the next try. */
export const LEDGER_RETRY_AFTER = '1 hour';

export interface SyncReport {
  workspaceId: string;
  enabled: boolean;
  processed: number;
  failed: number;
  retryLater: number;
  orphansReversed: number;
  openingBalances: number;
}

export interface LedgerSettings {
  baseCurrency: string | null;
  enabled: boolean;
  /** The workspace's most frequent transaction currency: the sensible default base. */
  suggestedBaseCurrency: string | null;
  pendingTransactions: number;
}

export interface CashReconciliation {
  accountId: string;
  code: string;
  name: string;
  currency: string | null;
  ledgerBalance: string;
  /**
   * What the source says the account holds: `balance_end` of the latest live
   * statement of this bank account, or for a wallet its opening balance plus
   * the movements booked to it.
   */
  statementBalance: string | null;
  statementDate: string | null;
  difference: string | null;
  /** Without an opening balance the ledger starts at zero, and the gap is that balance. */
  hasOpeningBalance: boolean;
}

export interface LedgerIntegrity {
  baseCurrency: string | null;
  pendingTransactions: number;
  failingTransactions: number;
  failures: Array<{ transactionId: string; error: string; attemptedAt: Date }>;
  orphanEntries: number;
  unbalancedEntries: number;
  cashAccounts: CashReconciliation[];
  /**
   * The latest FX revaluation. `stale` once a foreign-currency line dated on
   * or before it was booked after it: the balances it revalued have moved.
   */
  lastRevaluation: { date: string; entryNo: string | null; stale: boolean } | null;
  /** True when every transaction is booked and every booked entry balances. */
  upToDate: boolean;
}

const count = (rows: Array<{ n: string | number }>): number => Number(rows[0]?.n ?? 0);

/**
 * Drains the queue of dirty transactions into the ledger, and reports on how
 * far the ledger and its sources agree.
 *
 * Work is found through `transactions.ledger_dirty`, which database triggers
 * set; this service only ever clears it, through LedgerPostingService, in the
 * same transaction that books the row.
 */
@Injectable()
export class LedgerSyncService {
  private readonly logger = new Logger(LedgerSyncService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(JournalEntry)
    private readonly entryRepository: Repository<JournalEntry>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly postingService: LedgerPostingService,
    private readonly auditService: AuditService,
    private readonly queue: LedgerSyncQueue,
  ) {}

  /**
   * Workspaces with the ledger on and something to do: dirty rows, orphaned
   * entries, or opening balances queued by a wallet change.
   */
  async workspacesNeedingSync(): Promise<string[]> {
    const rows: Array<{ workspace_id: string }> = await this.workspaceRepository.query(
      `SELECT DISTINCT t."workspace_id"
         FROM "transactions" t JOIN "workspaces" w ON w."id" = t."workspace_id"
        WHERE t."ledger_dirty" AND w."ledger_base_currency" IS NOT NULL
          AND (t."ledger_attempted_at" IS NULL OR t."ledger_attempted_at" < now() - $1::interval)
       UNION
       SELECT DISTINCT "workspace_id" FROM "journal_entries"
        WHERE "source" = 'transaction' AND "status" = 'posted'
          AND "reversal_of_id" IS NULL AND "source_transaction_id" IS NULL
       UNION
       SELECT "id" FROM "workspaces"
        WHERE "ledger_openings_dirty" AND "ledger_base_currency" IS NOT NULL
          AND ("ledger_openings_attempted_at" IS NULL
               OR "ledger_openings_attempted_at" < now() - $1::interval)`,
      [LEDGER_RETRY_AFTER],
    );
    return rows.map(row => row.workspace_id);
  }

  /**
   * Books every dirty transaction of a workspace, reverses entries whose
   * transaction was deleted, and refreshes opening balances. A failing row is
   * recorded on the row and skipped; it never blocks the others.
   */
  async syncWorkspace(workspaceId: string, options: { force?: boolean } = {}): Promise<SyncReport> {
    const report: SyncReport = {
      workspaceId,
      enabled: false,
      processed: 0,
      failed: 0,
      retryLater: 0,
      orphansReversed: 0,
      openingBalances: 0,
    };
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['id', 'ledgerBaseCurrency'],
    });
    if (!workspace?.ledgerBaseCurrency) {
      return report;
    }
    report.enabled = true;

    // Rows edited mid-posting stay dirty; they are not retried within this run.
    const changed: string[] = [];
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const rows: Array<{ id: string }> = await this.workspaceRepository.query(
        `SELECT "id" FROM "transactions"
          WHERE "workspace_id" = $1 AND "ledger_dirty"
            AND ("ledger_attempted_at" IS NULL OR "ledger_attempted_at" < now() - $2::interval)
            AND NOT ("id" = ANY($3::uuid[]))
          ORDER BY "transaction_date", "created_at"
          LIMIT $4`,
        [workspaceId, LEDGER_RETRY_AFTER, changed, BATCH_SIZE],
      );
      if (rows.length === 0) {
        break;
      }
      for (const { id } of rows) {
        await this.postOne(workspaceId, id, report, changed);
      }
    }

    report.orphansReversed = await this.postingService.reverseOrphans(workspaceId);

    // Cleared before booking: a wallet changed meanwhile raises it again.
    const [, queued] = await this.workspaceRepository.query(
      `UPDATE "workspaces" SET "ledger_openings_dirty" = false
        WHERE "id" = $1 AND "ledger_openings_dirty"`,
      [workspaceId],
    );
    if (options.force || queued > 0 || report.processed > 0 || report.orphansReversed > 0) {
      report.openingBalances = await this.refreshOpenings(workspaceId);
    }
    return report;
  }

  /**
   * Books every opening balance; one that fails (a missing rate, usually)
   * queues the openings again for a later attempt. Returns how many changed.
   */
  private async refreshOpenings(workspaceId: string): Promise<number> {
    let booked = 0;
    const failures: string[] = [];
    try {
      const openings = await this.postingService.postOpeningBalances(workspaceId);
      booked = openings.filter(result =>
        ['posted', 'reposted', 'reversed'].includes(result.outcome.status),
      ).length;
      for (const { outcome } of openings) {
        if (outcome.status === 'failed') {
          failures.push(outcome.error);
        }
      }
    } catch (error) {
      failures.push((error as Error).message);
    }
    if (failures.length > 0) {
      this.logger.warn(
        `Opening balances for workspace ${workspaceId} not all booked: ${failures.join('; ')}`,
      );
      // Queued again, but left alone for a while: a missing rate rarely appears at once.
      await this.workspaceRepository.query(
        `UPDATE "workspaces"
            SET "ledger_openings_dirty" = true, "ledger_openings_attempted_at" = now()
          WHERE "id" = $1`,
        [workspaceId],
      );
    }
    return booked;
  }

  private async postOne(
    workspaceId: string,
    transactionId: string,
    report: SyncReport,
    changed: string[],
  ): Promise<void> {
    try {
      await this.postingService.postTransaction(workspaceId, transactionId);
      report.processed += 1;
    } catch (error) {
      if (error instanceof LedgerPostingError && error.code === 'TRANSACTION_CHANGED') {
        changed.push(transactionId);
        report.retryLater += 1;
        return;
      }
      report.failed += 1;
      const message =
        error instanceof LedgerPostingError
          ? `${error.code}: ${error.message}`
          : `UNEXPECTED: ${(error as Error).message}`;
      this.logger.warn(`Ledger posting failed for transaction ${transactionId}: ${message}`);
      // Not a fact of the entry, so the trigger leaves the dirty flag as it is.
      await this.workspaceRepository.query(
        `UPDATE "transactions" SET "ledger_error" = $2, "ledger_attempted_at" = now() WHERE "id" = $1`,
        [transactionId, message.slice(0, 1000)],
      );
    }
  }

  async getSettings(workspaceId: string): Promise<LedgerSettings> {
    const [workspace, suggested, pending] = await Promise.all([
      this.workspaceRepository.findOne({
        where: { id: workspaceId },
        select: ['id', 'ledgerBaseCurrency'],
      }),
      this.workspaceRepository.query(
        `SELECT upper("currency") AS "currency" FROM "transactions"
          WHERE "workspace_id" = $1 GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
        [workspaceId],
      ) as Promise<Array<{ currency: string }>>,
      this.workspaceRepository.query(
        `SELECT count(*) AS n FROM "transactions" WHERE "workspace_id" = $1 AND "ledger_dirty"`,
        [workspaceId],
      ) as Promise<Array<{ n: string }>>,
    ]);
    const baseCurrency = workspace?.ledgerBaseCurrency ?? null;
    return {
      baseCurrency,
      enabled: baseCurrency !== null,
      suggestedBaseCurrency: suggested[0]?.currency ?? null,
      pendingTransactions: count(pending),
    };
  }

  /**
   * Switches the ledger on in `baseCurrency` and queues the whole history for
   * booking. The base can still change while nothing is booked; once an entry
   * exists it is fixed, since every booked amount was converted into it.
   */
  async enable(workspaceId: string, userId: string, baseCurrency: string): Promise<LedgerSettings> {
    const normalized = baseCurrency.toUpperCase();
    const current = (await this.getSettings(workspaceId)).baseCurrency;

    if (current !== normalized) {
      if (current !== null) {
        const booked = await this.entryRepository.count({ where: { workspaceId } });
        if (booked > 0) {
          throw new ConflictException(
            appError('LEDGER_BASE_CURRENCY_LOCKED', { currency: current }),
          );
        }
      }
      await this.workspaceRepository.update(
        { id: workspaceId },
        { ledgerBaseCurrency: normalized },
      );
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.WORKSPACE,
        entityId: workspaceId,
        action: AuditAction.UPDATE,
        meta: { kind: 'ledger_base_currency' },
        diff: {
          before: { ledgerBaseCurrency: current },
          after: { ledgerBaseCurrency: normalized },
        },
      });
    }

    await this.queue.enqueue(workspaceId);
    return this.getSettings(workspaceId);
  }

  async requestSync(workspaceId: string): Promise<void> {
    await this.queue.enqueue(workspaceId);
  }

  /**
   * How far the ledger can be trusted right now: the sync backlog, failures,
   * orphans, any entry that does not balance (always zero while the database
   * trigger holds), and each bank account's ledger balance against its latest
   * statement.
   */
  async integrity(workspaceId: string): Promise<LedgerIntegrity> {
    const settings = await this.getSettings(workspaceId);
    const [failing, failures, orphans, unbalanced, cash, lastRevaluation] = await Promise.all([
      this.workspaceRepository.query(
        `SELECT count(*) AS n FROM "transactions"
          WHERE "workspace_id" = $1 AND "ledger_dirty" AND "ledger_error" IS NOT NULL`,
        [workspaceId],
      ) as Promise<Array<{ n: string }>>,
      this.workspaceRepository.query(
        `SELECT "id" AS "transactionId", "ledger_error" AS "error", "ledger_attempted_at" AS "attemptedAt"
           FROM "transactions"
          WHERE "workspace_id" = $1 AND "ledger_dirty" AND "ledger_error" IS NOT NULL
          ORDER BY "ledger_attempted_at" DESC LIMIT 20`,
        [workspaceId],
      ) as Promise<LedgerIntegrity['failures']>,
      this.entryRepository.count({
        where: {
          workspaceId,
          source: JournalEntrySource.TRANSACTION,
          status: JournalEntryStatus.POSTED,
          reversalOfId: IsNull(),
          sourceTransactionId: IsNull(),
        },
      }),
      this.workspaceRepository.query(
        `SELECT count(*) AS n FROM (
           SELECT e."id" FROM "journal_entries" e JOIN "journal_lines" l ON l."entry_id" = e."id"
            WHERE e."workspace_id" = $1 AND e."status" <> 'draft'
            GROUP BY e."id" HAVING sum(l."base_debit") <> sum(l."base_credit")
         ) unbalanced`,
        [workspaceId],
      ) as Promise<Array<{ n: string }>>,
      this.cashReconciliation(workspaceId),
      this.lastRevaluation(workspaceId),
    ]);

    const failingTransactions = count(failing);
    return {
      baseCurrency: settings.baseCurrency,
      pendingTransactions: settings.pendingTransactions,
      failingTransactions,
      failures,
      orphanEntries: orphans,
      unbalancedEntries: count(unbalanced),
      cashAccounts: cash,
      lastRevaluation,
      upToDate:
        settings.enabled &&
        settings.pendingTransactions === 0 &&
        orphans === 0 &&
        count(unbalanced) === 0,
    };
  }

  private async lastRevaluation(workspaceId: string): Promise<LedgerIntegrity['lastRevaluation']> {
    const [row]: Array<{ date: string; entry_no: string | null; stale: boolean }> =
      await this.workspaceRepository.query(
        `SELECT e."entry_date"::text AS "date", e."entry_no",
                EXISTS (
                  SELECT 1 FROM "journal_entries" x JOIN "journal_lines" l ON l."entry_id" = x."id"
                   WHERE x."workspace_id" = e."workspace_id" AND x."status" <> 'draft'
                     AND x."source" <> 'fx_revaluation' AND x."entry_date" <= e."entry_date"
                     AND x."posted_at" > e."posted_at" AND l."currency" <> e."base_currency"
                ) AS "stale"
           FROM "journal_entries" e
          WHERE e."workspace_id" = $1 AND e."source" = 'fx_revaluation'
            AND e."status" = 'posted' AND e."reversal_of_id" IS NULL
          ORDER BY e."entry_date" DESC LIMIT 1`,
        [workspaceId],
      );
    return row ? { date: row.date, entryNo: row.entry_no, stale: row.stale } : null;
  }

  private async cashReconciliation(workspaceId: string): Promise<CashReconciliation[]> {
    const accounts: Array<{
      id: string;
      code: string;
      name: string;
      currency: string | null;
      statement_account_key: string | null;
      balance: string;
      has_opening: boolean;
      wallet_balance: string | null;
    }> = await this.workspaceRepository.query(
      // A wallet's own rows book to it unless they sit on a statement, and
      // duplicates and unconfirmed rows are not booked at all; its opening
      // balance is booked only for an active wallet with no statement rows.
      // The expected balance follows the same rules.
      `SELECT a."id", a."code", a."name", a."currency", a."statement_account_key",
              -- NULL for a statement account, which has no wallet.
              (CASE WHEN w."id" IS NULL THEN NULL
                    WHEN w."is_active" AND NOT EXISTS (
                      SELECT 1 FROM "transactions" st
                       WHERE st."wallet_id" = w."id" AND st."statement_id" IS NOT NULL
                    ) THEN w."initial_balance" ELSE 0 END
               + coalesce((
                 SELECT sum(CASE WHEN t."transaction_type" = 'income' THEN 1 ELSE -1 END
                            * coalesce(t."amount", t."debit", t."credit"))
                   FROM "transactions" t
                  WHERE t."wallet_id" = w."id" AND t."statement_id" IS NULL
                    AND NOT t."is_duplicate" AND ${countedSql('t')}
                    AND upper(t."currency") = upper(w."currency")
               ), 0))::numeric(15,2) AS "wallet_balance",
              coalesce((SELECT sum(l."debit" - l."credit")
                          FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
                         WHERE l."account_id" = a."id" AND e."status" <> 'draft'), 0)::numeric(15,2) AS "balance",
              EXISTS (SELECT 1 FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
                       WHERE l."account_id" = a."id" AND e."source" = 'opening_balance'
                         AND e."status" = 'posted' AND e."reversal_of_id" IS NULL) AS "has_opening"
         FROM "ledger_accounts" a
         LEFT JOIN "wallets" w ON w."id" = a."wallet_id"
        WHERE a."workspace_id" = $1 AND a."deleted_at" IS NULL
          AND (a."statement_account_key" IS NOT NULL OR w."id" IS NOT NULL)
        ORDER BY a."name"`,
      [workspaceId],
    );
    if (accounts.length === 0) {
      return [];
    }

    const statements = await this.statementRepository.find({
      where: { workspaceId, deletedAt: IsNull() },
      select: [
        'id',
        'bankName',
        'accountNumber',
        'currency',
        'balanceEnd',
        'statementDateTo',
        'createdAt',
      ],
      order: { statementDateTo: 'DESC', createdAt: 'DESC' },
    });
    const latest = new Map<string, Statement>();
    for (const statement of statements) {
      if (statement.balanceEnd === null || statement.balanceEnd === undefined) {
        continue;
      }
      const key = statementCashKey(statement.bankName, statement.accountNumber, statement.currency);
      if (!latest.has(key)) {
        latest.set(key, statement);
      }
    }

    return accounts.map(account => {
      const statement = account.statement_account_key
        ? latest.get(account.statement_account_key)
        : undefined;
      const sourceBalance = account.wallet_balance ?? statement?.balanceEnd;
      const statementBalance =
        sourceBalance !== undefined && sourceBalance !== null
          ? fromMinor(toMinor(sourceBalance)).toFixed(2)
          : null;
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        currency: account.currency,
        ledgerBalance: account.balance,
        statementBalance,
        statementDate: statement?.statementDateTo
          ? String(statement.statementDateTo).slice(0, 10)
          : null,
        difference:
          statementBalance === null
            ? null
            : fromMinor(toMinor(account.balance) - toMinor(statementBalance)).toFixed(2),
        hasOpeningBalance: account.has_opening,
      };
    });
  }
}
