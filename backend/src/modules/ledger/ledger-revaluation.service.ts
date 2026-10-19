import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import {
  ActorType,
  AuditAction,
  EntityType,
  JournalEntry,
  JournalEntrySource,
  JournalEntryStatus,
} from '../../entities';
import { AuditService } from '../audit/audit.service';
import { LedgerAccountsService } from './ledger-accounts.service';
import { LEDGER_ACCOUNT_CODES } from './ledger-default-accounts';
import {
  type ForeignBalance,
  fromLineColumns,
  revaluationLines,
  sameLines,
} from './ledger-posting.rules';
import { LedgerPostingError, LedgerPostingService } from './ledger-posting.service';
import { LedgerSyncService } from './ledger-sync.service';

export interface Revaluation {
  entryId: string;
  entryNo: string | null;
  entryDate: string;
  postedAt: Date | null;
  /** Base-currency amounts booked to FX gain and FX loss. */
  gain: string;
  loss: string;
}

export type RevaluationResult =
  | { status: 'posted' | 'unchanged'; revaluation: Revaluation }
  | { status: 'nothing_to_revalue'; entryDate: string };

const toDate = (value: Date | string): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

/**
 * Revalues foreign-currency balances at the rate of a given day.
 *
 * Assets and liabilities held in a currency other than the base were booked
 * at the rates of their own days; a revaluation adjusts their base value to
 * the rate of the revaluation day, against FX gain or FX loss. Income,
 * expenses and equity stay at their historical rates.
 *
 * Revaluations run forward only: one per day, never before the latest, and
 * each is cumulative, so none needs reversing. Revaluing the same day again
 * replaces that day's entry if the balances moved since, and keeps it if not.
 */
@Injectable()
export class LedgerRevaluationService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly entryRepository: Repository<JournalEntry>,
    private readonly postingService: LedgerPostingService,
    private readonly accountsService: LedgerAccountsService,
    private readonly syncService: LedgerSyncService,
    private readonly auditService: AuditService,
  ) {}

  async revalue(workspaceId: string, userId: string, date: string): Promise<RevaluationResult> {
    if (date > toDate(new Date())) {
      throw new BadRequestException(appError('LEDGER_REVALUATION_FUTURE'));
    }
    const settings = await this.syncService.getSettings(workspaceId);
    if (!settings.baseCurrency) {
      throw new ConflictException(appError('LEDGER_DISABLED'));
    }
    // A pending transaction would be left out of the balances being revalued.
    if (settings.pendingTransactions > 0) {
      throw new ConflictException(
        appError('LEDGER_NOT_UP_TO_DATE', { pending: settings.pendingTransactions }),
      );
    }
    const baseCurrency = settings.baseCurrency;
    const system = await this.accountsService.systemAccountIds(workspaceId);

    // Rates first: they may need the network, which a database transaction should not wait on.
    const rates = new Map<string, number>();
    for (const currency of await this.foreignCurrencies(workspaceId, baseCurrency, date)) {
      rates.set(currency, await this.rateFor(currency, baseCurrency, date, workspaceId));
    }

    const result = await this.entryRepository.manager.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `ledger-revaluation:${workspaceId}`,
      ]);
      const latest = await this.latestRevaluation(manager, workspaceId);
      if (latest && toDate(latest.entryDate) > date) {
        throw new ConflictException(
          appError('LEDGER_REVALUATION_BACKDATED', { date: toDate(latest.entryDate) }),
        );
      }
      // The same day again: compare with that day's entry left out, and keep it
      // when nothing moved, so a repeated request books nothing.
      const sameDay = latest && toDate(latest.entryDate) === date ? latest : null;
      const balances = await this.foreignBalances(
        manager,
        workspaceId,
        baseCurrency,
        date,
        sameDay?.id ?? null,
      );
      const lines = revaluationLines(
        balances.filter(balance => rates.has(balance.currency)),
        currency => rates.get(currency) as number,
        baseCurrency,
        {
          fxGain: system[LEDGER_ACCOUNT_CODES.FX_GAIN],
          fxLoss: system[LEDGER_ACCOUNT_CODES.FX_LOSS],
        },
      );
      if (sameDay && sameLines(sameDay.lines.map(fromLineColumns), lines)) {
        return { entry: sameDay, changed: false };
      }
      if (sameDay) {
        await this.postingService.reverseWithin(manager, sameDay, { userId });
      }
      if (lines.length === 0) {
        return null;
      }
      const entry = await this.postingService.book(manager, {
        workspaceId,
        entryDate: date,
        baseCurrency,
        memo: `FX revaluation at ${date}`,
        source: JournalEntrySource.FX_REVALUATION,
        lines,
        userId,
      });
      return { entry, changed: true };
    });

    if (!result) {
      return { status: 'nothing_to_revalue', entryDate: date };
    }
    const [revaluation] = await this.describe(workspaceId, [result.entry.id]);
    if (!result.changed) {
      return { status: 'unchanged', revaluation };
    }
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.JOURNAL_ENTRY,
      entityId: result.entry.id,
      action: AuditAction.CREATE,
      meta: { kind: 'ledger_revalue', entryNo: result.entry.entryNo, date },
    });
    return { status: 'posted', revaluation };
  }

  /** Live revaluations, latest first. */
  async list(workspaceId: string): Promise<Revaluation[]> {
    const entries = await this.entryRepository.find({
      where: {
        workspaceId,
        source: JournalEntrySource.FX_REVALUATION,
        status: JournalEntryStatus.POSTED,
        reversalOfId: IsNull(),
      },
      select: ['id'],
      order: { entryDate: 'DESC' },
    });
    return this.describe(
      workspaceId,
      entries.map(entry => entry.id),
    );
  }

  private async rateFor(
    currency: string,
    baseCurrency: string,
    date: string,
    workspaceId: string,
  ): Promise<number> {
    try {
      return await this.postingService.rateFor(currency, baseCurrency, date, workspaceId);
    } catch (error) {
      if (error instanceof LedgerPostingError && error.code === 'FX_RATE_MISSING') {
        throw new UnprocessableEntityException(appError('LEDGER_FX_RATE_MISSING', error.params));
      }
      throw error;
    }
  }

  private latestRevaluation(
    manager: EntityManager,
    workspaceId: string,
  ): Promise<JournalEntry | null> {
    return manager.getRepository(JournalEntry).findOne({
      where: {
        workspaceId,
        source: JournalEntrySource.FX_REVALUATION,
        status: JournalEntryStatus.POSTED,
        reversalOfId: IsNull(),
      },
      order: { entryDate: 'DESC' },
      relations: { lines: true },
    });
  }

  private async foreignCurrencies(
    workspaceId: string,
    baseCurrency: string,
    date: string,
  ): Promise<string[]> {
    const rows: Array<{ currency: string }> = await this.entryRepository.query(
      `SELECT DISTINCT l."currency"
         FROM "journal_lines" l
         JOIN "journal_entries" e ON e."id" = l."entry_id"
         JOIN "ledger_accounts" a ON a."id" = l."account_id"
        WHERE e."workspace_id" = $1 AND e."status" <> 'draft' AND e."entry_date" <= $2
          AND l."currency" <> $3 AND a."account_type" IN ('asset', 'liability')
          AND a."code" <> $4`,
      [workspaceId, date, baseCurrency, LEDGER_ACCOUNT_CODES.SUSPENSE],
    );
    return rows.map(row => row.currency);
  }

  /**
   * Asset and liability balances per account and foreign currency, as booked
   * up to `date`. SUSPENSE is left out: it holds uncategorised income and
   * expenses, which stay at their historical rates like the categorised ones.
   */
  private async foreignBalances(
    manager: EntityManager,
    workspaceId: string,
    baseCurrency: string,
    date: string,
    excludeEntryId: string | null,
  ): Promise<ForeignBalance[]> {
    const rows: Array<{ account_id: string; currency: string; doc: string; base: string }> =
      await manager.query(
        `SELECT l."account_id", l."currency",
                sum(l."debit" - l."credit") AS "doc",
                sum(l."base_debit" - l."base_credit") AS "base"
           FROM "journal_lines" l
           JOIN "journal_entries" e ON e."id" = l."entry_id"
           JOIN "ledger_accounts" a ON a."id" = l."account_id"
          WHERE e."workspace_id" = $1 AND e."status" <> 'draft' AND e."entry_date" <= $2
            AND l."currency" <> $3 AND a."account_type" IN ('asset', 'liability')
            AND a."code" <> $5
            AND e."id" IS DISTINCT FROM $4
          GROUP BY l."account_id", l."currency"
          ORDER BY l."account_id", l."currency"`,
        [workspaceId, date, baseCurrency, excludeEntryId, LEDGER_ACCOUNT_CODES.SUSPENSE],
      );
    return rows.map(row => ({
      accountId: row.account_id,
      currency: row.currency,
      docMinor: toMinor(row.doc),
      baseMinor: toMinor(row.base),
    }));
  }

  private async describe(workspaceId: string, entryIds: string[]): Promise<Revaluation[]> {
    if (entryIds.length === 0) {
      return [];
    }
    const rows: Array<{
      id: string;
      entry_no: string | null;
      entry_date: string;
      posted_at: Date | null;
      gain: string;
      loss: string;
    }> = await this.entryRepository.query(
      `SELECT e."id", e."entry_no", e."entry_date"::text AS "entry_date", e."posted_at",
              coalesce(sum(l."base_credit") FILTER (WHERE a."code" = $3), 0) AS "gain",
              coalesce(sum(l."base_debit") FILTER (WHERE a."code" = $4), 0) AS "loss"
         FROM "journal_entries" e
         JOIN "journal_lines" l ON l."entry_id" = e."id"
         JOIN "ledger_accounts" a ON a."id" = l."account_id"
        WHERE e."workspace_id" = $1 AND e."id" = ANY($2::uuid[])
        GROUP BY e."id"
        ORDER BY e."entry_date" DESC`,
      [workspaceId, entryIds, LEDGER_ACCOUNT_CODES.FX_GAIN, LEDGER_ACCOUNT_CODES.FX_LOSS],
    );
    return rows.map(row => ({
      entryId: row.id,
      entryNo: row.entry_no,
      entryDate: row.entry_date,
      postedAt: row.posted_at,
      gain: fromMinor(toMinor(row.gain)).toFixed(2),
      loss: fromMinor(toMinor(row.loss)).toFixed(2),
    }));
  }
}
