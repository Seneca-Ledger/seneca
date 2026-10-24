import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import { normalizePagination } from '../../common/utils/pagination.util';
import type {
  CreateJournalEntryBody,
  JournalEntriesQuery,
  JournalLineInput,
  ReverseJournalEntryBody,
  UpdateJournalEntryBody,
} from '../../contracts';
import {
  ActorType,
  AuditAction,
  Branch,
  Category,
  EntityType,
  JournalEntry,
  JournalEntrySource,
  JournalEntryStatus,
  JournalLine,
  LedgerAccount,
} from '../../entities';
import { AuditService } from '../audit/audit.service';
import type {
  JournalEntryResponseDto,
  JournalEntrySummaryDto,
  PaginatedJournalEntriesDto,
} from './dto/journal-entry-response.dto';
import {
  type BaseLine,
  baseDifference,
  fromLineColumns,
  type ManualLeg,
  manualBaseLines,
} from './ledger-posting.rules';
import { LedgerPostingError, LedgerPostingService } from './ledger-posting.service';

const decimal = (minor: number): string => fromMinor(minor).toFixed(2);
const today = (): string => new Date().toISOString().slice(0, 10);
const dateOnly = (value: Date | string): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

/** Turns engine errors into the API's coded errors; anything else passes through. */
function asHttpError(error: unknown): unknown {
  if (!(error instanceof LedgerPostingError)) {
    return error;
  }
  switch (error.code) {
    case 'LEDGER_DISABLED':
      return new ConflictException(appError('LEDGER_DISABLED'));
    case 'FX_RATE_MISSING':
      return new UnprocessableEntityException(appError('LEDGER_FX_RATE_MISSING', error.params));
    case 'NOT_REVERSIBLE':
      return new ConflictException(appError('LEDGER_ENTRY_NOT_REVERSIBLE'));
    default:
      return error;
  }
}

async function http<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw asHttpError(error);
  }
}

/**
 * The manual journal: drafts that can be edited freely, posting that freezes
 * them, and reversal as the only correction of a posted entry.
 *
 * Drafts store base amounts too, recomputed on every save, so a client can
 * show the running difference; posting recomputes once more at the entry
 * date and refuses anything that does not balance to the cent.
 */
@Injectable()
export class LedgerEntriesService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly entryRepository: Repository<JournalEntry>,
    @InjectRepository(LedgerAccount)
    private readonly accountRepository: Repository<LedgerAccount>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly postingService: LedgerPostingService,
    private readonly auditService: AuditService,
  ) {}

  async list(workspaceId: string, query: JournalEntriesQuery): Promise<PaginatedJournalEntriesDto> {
    const { page, limit, skip } = normalizePagination(query, { defaultLimit: 50 });
    const qb = this.entryRepository
      .createQueryBuilder('entry')
      .where('entry.workspaceId = :workspaceId', { workspaceId });
    if (query.status) {
      qb.andWhere('entry.status = :status', { status: query.status });
    }
    if (query.source) {
      qb.andWhere('entry.source = :source', { source: query.source });
    }
    if (query.dateFrom) {
      qb.andWhere('entry.entryDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('entry.entryDate <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.accountId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM "journal_lines" hit WHERE hit."entry_id" = entry.id AND hit."account_id" = :accountId)',
        { accountId: query.accountId },
      );
    }

    // Drafts have no number yet; they sort after the booked entries of their date.
    const [entries, total] = await qb
      .orderBy('entry.entryDate', 'DESC')
      .addOrderBy('entry.entryNo', 'DESC', 'NULLS FIRST')
      .addOrderBy('entry.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totals = new Map<string, string>();
    if (entries.length > 0) {
      const rows: Array<{ entry_id: string; total: string }> = await this.entryRepository.query(
        `SELECT "entry_id", sum("base_debit")::numeric(15,2) AS "total"
           FROM "journal_lines" WHERE "entry_id" = ANY($1) GROUP BY "entry_id"`,
        [entries.map(entry => entry.id)],
      );
      for (const row of rows) {
        totals.set(row.entry_id, row.total);
      }
    }

    return {
      data: entries.map(entry => ({
        ...this.summaryOf(entry),
        baseTotal: totals.get(entry.id) ?? '0.00',
      })),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async findOne(workspaceId: string, id: string): Promise<JournalEntryResponseDto> {
    const entry = await this.entryRepository.findOne({
      where: { id, workspaceId },
      relations: { lines: { account: true } },
      withDeleted: true,
    });
    if (!entry) {
      throw new NotFoundException(appError('LEDGER_ENTRY_NOT_FOUND'));
    }
    const reversal =
      entry.status === JournalEntryStatus.REVERSED
        ? await this.entryRepository.findOne({
            where: { workspaceId, reversalOfId: entry.id },
            select: {
              id: true,
            },
          })
        : null;

    const lines = [...entry.lines].sort((a, b) => a.lineNo - b.lineNo);
    const base = lines.map(fromLineColumns);
    const debit = base.filter(line => line.side === 'debit').reduce((s, l) => s + l.baseMinor, 0);
    const credit = base.filter(line => line.side === 'credit').reduce((s, l) => s + l.baseMinor, 0);

    return {
      ...this.summaryOf(entry),
      sourceTransactionId: entry.sourceTransactionId,
      reversedById: reversal?.id ?? null,
      postedBy: entry.postedBy,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      lines: lines.map((line, index) => ({
        lineNo: line.lineNo,
        accountId: line.accountId,
        accountCode: line.account.code,
        accountName: line.account.name,
        side: base[index].side,
        amount: decimal(base[index].amountMinor),
        currency: line.currency,
        baseAmount: decimal(base[index].baseMinor),
        fxRate: line.fxRate,
        categoryId: line.categoryId,
        branchId: line.branchId,
      })),
      totals: {
        baseDebit: decimal(debit),
        baseCredit: decimal(credit),
        difference: decimal(debit - credit),
      },
    };
  }

  async createDraft(
    workspaceId: string,
    userId: string,
    dto: CreateJournalEntryBody,
  ): Promise<JournalEntryResponseDto> {
    const entry = await http(async () => {
      const baseCurrency = await this.postingService.baseCurrencyOf(workspaceId);
      const lines = await this.prepareLines(workspaceId, baseCurrency, dto.entryDate, dto.lines);
      return this.entryRepository.manager.transaction(manager =>
        this.postingService.insertDraft(manager, {
          workspaceId,
          entryDate: dto.entryDate,
          baseCurrency,
          memo: dto.memo?.trim() || null,
          source: JournalEntrySource.MANUAL,
          lines,
          userId,
        }),
      );
    });
    return this.findOne(workspaceId, entry.id);
  }

  async updateDraft(
    workspaceId: string,
    id: string,
    dto: UpdateJournalEntryBody,
  ): Promise<JournalEntryResponseDto> {
    await http(() =>
      this.entryRepository.manager.transaction(async manager => {
        const entry = await this.lockDraft(manager, workspaceId, id);
        const entryDate = dto.entryDate ?? dateOnly(entry.entryDate);
        const inputs = dto.lines ?? (await this.storedInputs(manager, entry.id));
        // Base currency is the ledger's current one: a draft is not booked yet.
        const baseCurrency = await this.postingService.baseCurrencyOf(workspaceId);
        const lines = await this.prepareLines(workspaceId, baseCurrency, entryDate, inputs);

        await manager.getRepository(JournalEntry).update(
          { id: entry.id },
          {
            entryDate,
            baseCurrency,
            memo: dto.memo === undefined ? entry.memo : dto.memo?.trim() || null,
          },
        );
        await this.postingService.replaceLines(manager, entry.id, lines);
      }),
    );
    return this.findOne(workspaceId, id);
  }

  /** Drafts only. A posted entry stays for good; it can only be reversed. */
  async removeDraft(workspaceId: string, id: string): Promise<void> {
    await this.entryRepository.manager.transaction(async manager => {
      await this.lockDraft(manager, workspaceId, id);
      await manager.getRepository(JournalEntry).delete({ id, workspaceId });
    });
  }

  /**
   * Books a draft. Idempotent: posting an entry that is already booked
   * returns it unchanged, so a retried request does not fail.
   */
  async post(workspaceId: string, id: string, userId: string): Promise<JournalEntryResponseDto> {
    const posted = await http(() =>
      this.entryRepository.manager.transaction(async manager => {
        const entry = await manager.getRepository(JournalEntry).findOne({
          where: { id, workspaceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!entry) {
          throw new NotFoundException(appError('LEDGER_ENTRY_NOT_FOUND'));
        }
        if (entry.status !== JournalEntryStatus.DRAFT) {
          return false;
        }

        // Recomputed at the entry date with the current chart: an account
        // may have been retired, or a rate corrected, since the draft was saved.
        const baseCurrency = await this.postingService.baseCurrencyOf(workspaceId);
        const entryDate = dateOnly(entry.entryDate);
        const inputs = await this.storedInputs(manager, entry.id);
        const lines = await this.prepareLines(workspaceId, baseCurrency, entryDate, inputs);
        this.assertBookable(lines, baseCurrency);

        await manager.getRepository(JournalEntry).update({ id: entry.id }, { baseCurrency });
        await this.postingService.replaceLines(manager, entry.id, lines);
        await this.postingService.promote(manager, entry, userId);
        return true;
      }),
    );

    const result = await this.findOne(workspaceId, id);
    if (posted) {
      await this.audit(workspaceId, userId, id, 'post', { status: 'draft' }, result);
    }
    return result;
  }

  /**
   * Reverses a posted entry with a mirror entry. Idempotent: reversing an
   * entry that is already reversed returns the existing reversal.
   */
  async reverse(
    workspaceId: string,
    id: string,
    userId: string,
    dto: ReverseJournalEntryBody,
  ): Promise<JournalEntryResponseDto> {
    const existing = await this.existingReversal(workspaceId, id);
    if (existing) {
      return this.findOne(workspaceId, existing);
    }

    try {
      const reversal = await this.postingService.reverseEntry(workspaceId, id, {
        userId,
        date: dto.date ?? today(),
      });
      const result = await this.findOne(workspaceId, reversal.id);
      await this.audit(workspaceId, userId, id, 'reverse', { status: 'posted' }, result);
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(appError('LEDGER_ENTRY_NOT_FOUND'));
      }
      // A concurrent request may have reversed it first.
      const raced = await this.existingReversal(workspaceId, id);
      if (raced) {
        return this.findOne(workspaceId, raced);
      }
      throw asHttpError(error);
    }
  }

  private async existingReversal(workspaceId: string, id: string): Promise<string | null> {
    const reversal = await this.entryRepository.findOne({
      where: { workspaceId, reversalOfId: id },
      select: {
        id: true,
      },
    });
    return reversal?.id ?? null;
  }

  private async lockDraft(
    manager: EntityManager,
    workspaceId: string,
    id: string,
  ): Promise<JournalEntry> {
    const entry = await manager.getRepository(JournalEntry).findOne({
      where: { id, workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!entry) {
      throw new NotFoundException(appError('LEDGER_ENTRY_NOT_FOUND'));
    }
    if (entry.status !== JournalEntryStatus.DRAFT || entry.source !== JournalEntrySource.MANUAL) {
      throw new ConflictException(appError('LEDGER_ENTRY_NOT_DRAFT'));
    }
    return entry;
  }

  /** A stored draft's lines, back in the shape a client sends. */
  private async storedInputs(manager: EntityManager, entryId: string): Promise<JournalLineInput[]> {
    const rows = await manager
      .getRepository(JournalLine)
      .find({ where: { entryId }, order: { lineNo: 'ASC' } });
    return rows.map(row => {
      const line = fromLineColumns(row);
      return {
        accountId: line.accountId,
        side: line.side,
        amount: decimal(line.amountMinor),
        currency: line.currency,
        categoryId: line.categoryId,
        branchId: line.branchId,
      };
    });
  }

  /**
   * Validates lines against this workspace and converts them to base
   * currency. Every reference is checked here, so a client gets a coded error
   * naming the line rather than a constraint failure at COMMIT.
   */
  private async prepareLines(
    workspaceId: string,
    baseCurrency: string,
    entryDate: string,
    inputs: JournalLineInput[],
  ): Promise<BaseLine[]> {
    const accountIds = [...new Set(inputs.map(input => input.accountId))];
    const accounts = accountIds.length
      ? await this.accountRepository.find({ where: { id: In(accountIds), workspaceId } })
      : [];
    const accountById = new Map(accounts.map(account => [account.id, account]));

    const categoryIds = [
      ...new Set(inputs.flatMap(input => (input.categoryId ? [input.categoryId] : []))),
    ];
    const branchIds = [
      ...new Set(inputs.flatMap(input => (input.branchId ? [input.branchId] : []))),
    ];
    const [categories, branches] = await Promise.all([
      categoryIds.length
        ? this.categoryRepository.find({
            where: { id: In(categoryIds), workspaceId },
            select: {
              id: true,
            },
          })
        : [],
      branchIds.length
        ? this.branchRepository.find({
            where: { id: In(branchIds), workspaceId },
            select: {
              id: true,
            },
          })
        : [],
    ]);
    const knownCategories = new Set(categories.map(category => category.id));
    const knownBranches = new Set(branches.map(branch => branch.id));

    const known = { accounts: accountById, categories: knownCategories, branches: knownBranches };
    const legs = inputs.map((input, index) => this.toLeg(input, index, baseCurrency, known));

    const rates = new Map<string, number>();
    for (const currency of new Set(legs.map(leg => leg.currency))) {
      rates.set(
        currency,
        await this.postingService.rateFor(currency, baseCurrency, entryDate, workspaceId),
      );
    }
    return manualBaseLines(legs, baseCurrency, currency => rates.get(currency) ?? Number.NaN);
  }

  /** One validated line. Throws a coded error naming what is wrong with it. */
  private toLeg(
    input: JournalLineInput,
    index: number,
    baseCurrency: string,
    known: {
      accounts: Map<string, LedgerAccount>;
      categories: Set<string>;
      branches: Set<string>;
    },
  ): ManualLeg {
    const account = known.accounts.get(input.accountId);
    if (!account) {
      throw new BadRequestException(appError('LEDGER_ACCOUNT_NOT_FOUND'));
    }
    if (!account.isPostable) {
      throw new UnprocessableEntityException(
        appError('LEDGER_ACCOUNT_NOT_POSTABLE', { code: account.code }),
      );
    }
    const currency = (input.currency ?? account.currency ?? baseCurrency).toUpperCase();
    if (account.currency && account.currency !== currency) {
      throw new UnprocessableEntityException(
        appError('LEDGER_ACCOUNT_CURRENCY_MISMATCH', {
          code: account.code,
          currency: account.currency,
        }),
      );
    }
    const unknownCategory = input.categoryId && !known.categories.has(input.categoryId);
    const unknownBranch = input.branchId && !known.branches.has(input.branchId);
    if (unknownCategory || unknownBranch) {
      throw new BadRequestException(
        appError('LEDGER_LINE_REFERENCE_NOT_FOUND', { line: index + 1 }),
      );
    }
    const amountMinor = toMinor(input.amount);
    if (amountMinor <= 0) {
      throw new BadRequestException('Line amounts must be greater than zero');
    }
    return {
      accountId: account.id,
      side: input.side,
      amountMinor,
      currency,
      categoryId: input.categoryId ?? null,
      branchId: input.branchId ?? null,
    };
  }

  private assertBookable(lines: BaseLine[], baseCurrency: string): void {
    if (lines.length < 2) {
      throw new UnprocessableEntityException(appError('LEDGER_ENTRY_TOO_FEW_LINES'));
    }
    const difference = baseDifference(lines);
    if (difference !== 0) {
      throw new UnprocessableEntityException(
        appError('LEDGER_ENTRY_UNBALANCED', {
          difference: decimal(difference),
          currency: baseCurrency,
        }),
      );
    }
  }

  private summaryOf(entry: JournalEntry): Omit<JournalEntrySummaryDto, 'baseTotal'> {
    return {
      id: entry.id,
      entryNo: entry.entryNo,
      entryDate: dateOnly(entry.entryDate),
      baseCurrency: entry.baseCurrency,
      memo: entry.memo,
      status: entry.status,
      source: entry.source,
      reversalOfId: entry.reversalOfId,
      postedAt: entry.postedAt,
    };
  }

  /** Posting and reversal move balances; database.md wants every such change logged. */
  private async audit(
    workspaceId: string,
    userId: string,
    entryId: string,
    kind: 'post' | 'reverse',
    before: object,
    after: JournalEntryResponseDto,
  ): Promise<void> {
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.JOURNAL_ENTRY,
      entityId: entryId,
      action: AuditAction.UPDATE,
      meta: { kind: `ledger_${kind}`, entryNo: after.entryNo },
      diff: { before, after },
    });
  }
}
