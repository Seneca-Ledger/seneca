import { randomUUID } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { type EntityTarget, In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { toMinor } from '../../common/utils/money.util';
import {
  applyOwnerFilter,
  assertOwnerMemberInWorkspace,
  type OwnerFilter,
} from '../../common/utils/transaction-owner.util';
import { redactPrivate, redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Branch } from '../../entities/branch.entity';
import { Category, CategoryType } from '../../entities/category.entity';
import { Payable } from '../../entities/payable.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import {
  TaxSource,
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { ensurePrivateCategory } from '../categories/private-category';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import type { DataDeletedEvent } from '../notifications/events/notification-events';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import type { BulkUpdateItemDto } from './dto/bulk-update-transaction.dto';
import type { SplitPartDto, SplitTransactionDto } from './dto/split-transaction.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';

export type TransactionWithConversion = Transaction & {
  convertedAmount?: number;
  conversionRate?: number;
  convertedCurrency?: string;
};

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    statementRepository: Repository<Statement>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly taxAssignmentService: TaxAssignmentService,
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  private async resolveActorName(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['name', 'email'],
    });
    return user?.name || user?.email || 'User';
  }

  private async invalidateReports(userId: string): Promise<void> {
    const key = `reports:version:${userId}`;
    await this.cacheManager.set(key, Date.now().toString(), 0);
  }

  /** Checked in the workspace being edited, not the one the user registered with. */
  private async ensureCanEditStatements(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );
  }

  async findAll(
    workspaceId: string,
    filters: {
      statementId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      type?: string;
      categoryId?: string;
      currency?: string;
      convertTo?: string;
      owner?: OwnerFilter;
      page?: number;
      limit?: number;
    },
    viewerMemberId: string | null = null,
  ): Promise<{ data: TransactionWithConversion[]; total: number; page: number; limit: number }> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .leftJoinAndSelect('transaction.statement', 'statement')
      .andWhere('(transaction.statementId IS NULL OR statement.deletedAt IS NULL)')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .leftJoinAndSelect('transaction.reimbursementOf', 'reimbursementOf');

    applyOwnerFilter(query, 'transaction', filters.owner ?? { kind: 'all' });

    if (filters.statementId) {
      query.andWhere('transaction.statementId = :statementId', {
        statementId: filters.statementId,
      });
    }

    if (filters.dateFrom) {
      query.andWhere('transaction.transactionDate >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters.dateTo) {
      query.andWhere('transaction.transactionDate <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    if (filters.type === 'transfer') {
      query.andWhere('transaction.transferPairId IS NOT NULL');
    } else if (filters.type) {
      query.andWhere('transaction.transactionType = :type', { type: filters.type });
    }

    if (filters.categoryId) {
      query.andWhere('transaction.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters.currency) {
      query.andWhere('UPPER(transaction.currency) = :currency', {
        currency: filters.currency.toUpperCase(),
      });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    query.orderBy('transaction.transactionDate', 'DESC').skip(skip).take(limit);

    const [rows, total] = await query.getManyAndCount();
    const rawData = redactPrivateRows(rows, viewerMemberId);

    if (!filters.convertTo) {
      return { data: rawData, total, page, limit };
    }

    const targetCurrency = filters.convertTo.toUpperCase();
    const items = rawData.map(tx => ({
      amount: Number(tx.amount) || Number(tx.debit) || Number(tx.credit) || 0,
      currency: currencyCodeOrDefault(tx.currency),
      date: tx.transactionDate,
    }));
    const conversions = await this.exchangeRatesService.bulkConvert(
      items,
      targetCurrency,
      workspaceId,
    );

    const data: TransactionWithConversion[] = rawData.map((tx, i) => {
      const conv = conversions[i];
      return Object.assign(Object.create(Object.getPrototypeOf(tx)), tx, {
        convertedAmount: conv.converted,
        conversionRate: conv.rate,
        convertedCurrency: targetCurrency,
      });
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, workspaceId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, workspaceId },
      relations: ['category', 'branch', 'wallet'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /** `findOne` as the caller is allowed to read it. */
  async findOneFor(
    id: string,
    workspaceId: string,
    viewerMemberId: string | null,
  ): Promise<Transaction> {
    return redactPrivate(await this.findOne(id, workspaceId), viewerMemberId);
  }

  /**
   * Refuses edits that would put a filed return out of step with its data.
   *
   * A locked transaction has been reported to a tax authority. Its money and
   * its tax are therefore fixed; everything else about it — comments, wallet,
   * counterparty spelling — stays editable, so locking does not turn the row
   * into a museum piece.
   */
  private assertTaxEditable(transaction: Transaction, updateDto: UpdateTransactionDto): void {
    if (!transaction.taxLocked) {
      return;
    }

    const frozen: Array<keyof UpdateTransactionDto> = [
      'amount',
      'debit',
      'credit',
      'amountForeign',
      'exchangeRate',
      'transactionType',
      'categoryId',
      'transactionDate',
      // Changing it would re-convert the tax at a different rate than the one
      // the filed figure was built from.
      'currency',
    ];

    const attempted = frozen.filter(field => updateDto[field] !== undefined);
    if (attempted.length > 0) {
      throw new BadRequestException(
        `Cannot change ${attempted.join(', ')} on a transaction that is part of a filed tax return. Reopen the return first.`,
      );
    }
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    updateDto: UpdateTransactionDto,
    batchId?: string | null,
    viewerMemberId: string | null = null,
  ): Promise<Transaction> {
    await this.ensureCanEditStatements(userId, workspaceId);
    const transaction = await this.findOne(id, workspaceId);
    await this.assertWorkspaceOwnedRefs(updateDto, workspaceId);
    const movedForPrivacy = await this.applyPrivacy(transaction, updateDto, viewerMemberId);
    const before = { ...transaction };
    const previousCategoryId = transaction.categoryId;
    this.assertTaxEditable(transaction, updateDto);

    // Recalculate amount if debit/credit changed
    if (updateDto.debit !== undefined || updateDto.credit !== undefined) {
      const debit = updateDto.debit !== undefined ? updateDto.debit : transaction.debit;
      const credit = updateDto.credit !== undefined ? updateDto.credit : transaction.credit;
      updateDto.amount = debit || credit || 0;

      // Update transaction type
      if (debit && debit > 0) {
        updateDto.transactionType = TransactionType.EXPENSE;
      } else if (credit && credit > 0) {
        updateDto.transactionType = TransactionType.INCOME;
      }
    } else if (
      updateDto.amountForeign !== undefined &&
      updateDto.exchangeRate !== undefined &&
      updateDto.amount === undefined
    ) {
      const nativeAmount = Number(updateDto.amountForeign) * Number(updateDto.exchangeRate);
      updateDto.amount = nativeAmount;
    }

    Object.assign(transaction, updateDto);

    // `findOne` loaded the relation objects. On save TypeORM takes a loaded
    // relation over the foreign-key column, so a changed id would silently be
    // written back as the old one. Drop the stale objects; the id is the truth.
    if (updateDto.categoryId !== undefined) {
      transaction.category = undefined as unknown as Category | null;
    }
    if (updateDto.branchId !== undefined) {
      transaction.branch = undefined as unknown as Branch | null;
    }
    if (updateDto.walletId !== undefined) {
      transaction.wallet = undefined as unknown as Wallet | null;
    }
    if (updateDto.ownerMemberId !== undefined) {
      transaction.ownerMember = undefined as unknown as WorkspaceMember | null;
    }

    // A category the user picked is sticky: re-classification leaves it alone.
    // Moving in or out of `Private` is not such a pick — it would overwrite the
    // reason the row was categorised the way it was, which the owner still needs.
    if (
      !movedForPrivacy &&
      updateDto.categoryId !== undefined &&
      updateDto.categoryId !== previousCategoryId
    ) {
      transaction.categorySource = updateDto.categoryId ? TransactionCategorySource.MANUAL : null;
      transaction.categoryReason = null;
    }

    const saved = await this.transactionRepository.save(transaction);
    await this.invalidateReports(userId);

    // Audit: capture transaction update with before/after snapshot.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: {
        updatedFields: Object.keys(updateDto),
      },
      batchId: batchId ?? null,
      isUndoable: true,
    });

    // A correction teaches by itself: the row's own category is what the payee
    // history reads next time, so there is nothing else to record.

    return saved;
  }

  /**
   * Moves a row in or out of the workspace's `Private` category.
   *
   * Only the owner of a row may hide it: a row the household shares has nobody
   * to keep a secret from, and a row somebody else owns is not yours to hide.
   *
   * The category really moves rather than being masked when read. A mask would
   * make every total depend on who is asking, and two such totals differ by
   * exactly the hidden amount.
   */
  private async applyPrivacy(
    transaction: Transaction,
    updateDto: UpdateTransactionDto,
    viewerMemberId: string | null,
  ): Promise<boolean> {
    if (updateDto.isPrivate === undefined || updateDto.isPrivate === transaction.isPrivate) {
      // Drop the key rather than blank it: `Object.assign` copies an
      // `undefined` value too, and the row would then look changed to the audit
      // — "changed: isPrivate" on an edit that touched nothing of the sort.
      // biome-ignore lint/performance/noDelete: an undefined assignment, which is what the rule suggests, creates the key and marks the row as changed
      delete updateDto.isPrivate;
      return false;
    }

    if (updateDto.isPrivate) {
      if (!transaction.ownerMemberId || transaction.ownerMemberId !== viewerMemberId) {
        throw new BadRequestException(appError('TRANSACTION_PRIVATE_NOT_OWNER'));
      }
      const privateCategory = await ensurePrivateCategory(
        this.categoryRepository,
        transaction.workspaceId,
        transaction.transactionType === TransactionType.INCOME
          ? CategoryType.INCOME
          : CategoryType.EXPENSE,
      );
      transaction.privateCategoryId = transaction.categoryId;
      // Through the DTO, not the entity: `findOne` loaded the `category`
      // relation, and on save a loaded relation wins over the column, so an id
      // assigned here alone would be written back as the old one. The block
      // below already drops the stale object for a DTO-driven change.
      updateDto.categoryId = privateCategory.id;
    } else {
      updateDto.categoryId = transaction.privateCategoryId ?? undefined;
      transaction.privateCategoryId = null;
    }
    return true;
  }

  async bulkUpdate(
    workspaceId: string,
    userId: string,
    items: BulkUpdateItemDto[],
    viewerMemberId: string | null = null,
  ): Promise<Transaction[]> {
    await this.ensureCanEditStatements(userId, workspaceId);
    const updatedTransactions: Transaction[] = [];
    const batchId = items.length > 1 ? randomUUID() : null;

    for (const item of items) {
      try {
        const transaction = await this.update(
          item.id,
          workspaceId,
          userId,
          item.updates,
          batchId,
          viewerMemberId,
        );
        updatedTransactions.push(transaction);
      } catch (error) {
        console.error('Error updating transaction %s:', item.id, error);
      }
    }

    if (updatedTransactions.length > 0) {
      await this.invalidateReports(userId);
    }

    return updatedTransactions;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Rejects an id that belongs to another workspace before it is written onto a
   * transaction. `@IsUUID()` on the DTO only proves the shape of the string, so
   * without this a caller can point their own row at another tenant's category,
   * branch or wallet — whose name then comes back to them through the
   * `relations` loads in `findOne` / `getSplitParts`.
   *
   * ponytail: app-level check; a composite FK on (id, workspace_id) would
   * enforce it in the database, but that needs a migration over existing rows.
   */
  private async assertWorkspaceOwned(
    entity: EntityTarget<{ id: string; workspaceId: string }>,
    ids: Array<string | null | undefined>,
    workspaceId: string,
  ): Promise<void> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) {
      return;
    }

    const found = await this.transactionRepository.manager
      .getRepository(entity)
      .countBy({ id: In(unique), workspaceId });

    if (found !== unique.length) {
      throw new NotFoundException('Referenced record not found in this workspace');
    }
  }

  /** Every workspace-scoped reference an update body can carry. */
  private assertWorkspaceOwnedRefs(
    updateDto: Pick<UpdateTransactionDto, 'categoryId' | 'branchId' | 'walletId' | 'ownerMemberId'>,
    workspaceId: string,
  ): Promise<unknown> {
    return Promise.all([
      this.assertWorkspaceOwned(Category, [updateDto.categoryId], workspaceId),
      this.assertWorkspaceOwned(Branch, [updateDto.branchId], workspaceId),
      this.assertWorkspaceOwned(Wallet, [updateDto.walletId], workspaceId),
      assertOwnerMemberInWorkspace(
        this.workspaceMemberRepository,
        workspaceId,
        updateDto.ownerMemberId,
      ),
    ]);
  }

  /**
   * Builds the sibling template: every column a split part inherits verbatim from
   * the row it was split from. An allowlist, so a newly added column is inherited
   * only once someone decides it should be.
   *
   * Excluded on purpose: `id` and the createdAt/updatedAt timestamps; the loaded
   * relation objects (category, wallet, branch, ...), so saving a part never
   * cascades into them; the per-part money columns (amount/debit/credit/
   * amountForeign) and the split markers, which `split()` assigns itself;
   * `fingerprint`, which backfill recomputes from the post-split amount; and the
   * duplicate-flag columns, unreachable because a flagged row cannot be split.
   */
  private cloneForSplit(source: Transaction): Partial<Transaction> {
    return {
      workspaceId: source.workspaceId,
      statementId: source.statementId,
      transactionDate: source.transactionDate,
      documentNumber: source.documentNumber,
      counterpartyName: source.counterpartyName,
      counterpartyBin: source.counterpartyBin,
      counterpartyAccount: source.counterpartyAccount,
      counterpartyBank: source.counterpartyBank,
      counterpartyCountry: source.counterpartyCountry,
      counterpartyVatId: source.counterpartyVatId,
      currency: source.currency,
      exchangeRate: source.exchangeRate,
      paymentPurpose: source.paymentPurpose,
      categoryId: source.categoryId,
      // The rate carries over, but never the assessed figures: those belong to
      // the pre-split amount, and copying them onto each part would multiply
      // the transaction's tax by the number of parts. `split()` re-assesses
      // every part from its own amount and category instead.
      taxRateId: source.taxRateId,
      taxSource: source.taxSource,
      branchId: source.branchId,
      walletId: source.walletId,
      // Each part starts on the same person as the whole; splitting a shared
      // purchase between two people is done by reassigning the parts afterwards.
      ownerMemberId: source.ownerMemberId,
      article: source.article,
      activityType: source.activityType,
      vendorNormalized: source.vendorNormalized,
      categoryHint: source.categoryHint,
      transactionNature: source.transactionNature,
      taxDetected: source.taxDetected,
      enrichmentConfidence: source.enrichmentConfidence,
      transactionType: source.transactionType,
      comments: source.comments,
      isVerified: source.isVerified,
      importSessionId: source.importSessionId,
    };
  }

  /**
   * Guards that a transaction may be split, and returns its authoritative amount.
   *
   * Called twice: once outside the DB transaction as a cheap fast path, and again
   * on the locked row, which is the read the parts are actually derived from.
   */
  private assertSplittable(transaction: Transaction, dto: SplitTransactionDto): number {
    if (transaction.splitGroupId) {
      throw new BadRequestException('Transaction is already part of a split');
    }

    // A duplicate-flagged row is excluded from dashboards and reports. Splitting it
    // would produce siblings that default to isDuplicate=false, so the sibling
    // amounts would reappear in those totals. Refuse instead.
    if (transaction.isDuplicate) {
      throw new BadRequestException('Cannot split a transaction marked as a duplicate');
    }

    // A locked row has already been reported on a filed return. Splitting it
    // re-assesses the tax across the parts, which would change figures that
    // have been submitted to a tax authority.
    if (transaction.taxLocked) {
      throw new BadRequestException(
        'Cannot split a transaction that is part of a filed tax return',
      );
    }

    const total = Number(
      transaction.amount ?? transaction.debit ?? transaction.credit ?? Number.NaN,
    );
    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException('Cannot split a transaction without a positive amount');
    }

    const partsTotal = this.round2(dto.parts.reduce((sum, part) => sum + Number(part.amount), 0));
    // Round the drift too: |99.99 - 100| is 0.010000000000005 in binary floating
    // point, which would reject the very boundary the tolerance exists to accept.
    if (this.round2(Math.abs(partsTotal - total)) > 0.01) {
      throw new BadRequestException(`Split parts must sum to ${total}, received ${partsTotal}`);
    }

    return total;
  }

  /**
   * Divides a transaction's money across its parts.
   *
   * The requested amounts are rounded to cents and the LAST part absorbs the
   * residual, so the parts sum to `total` (and `foreignTotal`) exactly rather than
   * drifting by the cent the validation tolerance permits.
   */
  private allocateParts(
    total: number,
    foreignTotal: number | null,
    parts: SplitPartDto[],
  ): { amounts: number[]; foreignAmounts: (number | null)[] } {
    const amounts = parts.map(part => this.round2(Number(part.amount)));
    const lastIndex = amounts.length - 1;
    amounts[lastIndex] = this.round2(
      total - amounts.slice(0, lastIndex).reduce((sum, value) => sum + value, 0),
    );

    const foreignAmounts: (number | null)[] = amounts.map(amount =>
      foreignTotal === null ? null : this.round2((foreignTotal * amount) / total),
    );
    if (foreignTotal !== null) {
      foreignAmounts[lastIndex] = this.round2(
        foreignTotal -
          foreignAmounts.slice(0, lastIndex).reduce((sum, value) => sum + (value ?? 0), 0),
      );
    }

    return { amounts, foreignAmounts };
  }

  /**
   * Splits one transaction into N parts in place.
   *
   * The original row becomes part 0 and N-1 siblings are inserted; the parts sum
   * to the original amount, so balance/dashboard/reports/budgets aggregates need
   * no awareness of splits at all.
   */
  async split(
    id: string,
    workspaceId: string,
    userId: string,
    dto: SplitTransactionDto,
  ): Promise<Transaction[]> {
    await this.ensureCanEditStatements(userId, workspaceId);
    const original = await this.findOne(id, workspaceId);
    await this.assertWorkspaceOwned(
      Category,
      dto.parts.map(part => part.categoryId),
      workspaceId,
    );
    // Fast path only: reject an obviously invalid request before opening a DB
    // transaction and taking a row lock. The authoritative check is the one below.
    this.assertSplittable(original, dto);

    const before = { ...original };
    const splitGroupId = randomUUID();

    const saved = await this.transactionRepository.manager.transaction(async manager => {
      const repo = manager.getRepository(Transaction);

      // Re-read under a write lock: the fast-path check ran outside this
      // transaction, so a concurrent split — or an update() changing the amount or
      // the type — may have landed since. Everything below therefore derives from
      // `locked`, never from the stale `original`.
      const locked = await repo.findOne({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Transaction not found');
      }

      const total = this.assertSplittable(locked, dto);
      const isExpense = locked.transactionType === TransactionType.EXPENSE;
      const rawForeign = locked.amountForeign ?? null;
      const { amounts, foreignAmounts } = this.allocateParts(
        total,
        rawForeign === null ? null : Number(rawForeign),
        dto.parts,
      );

      const template = this.cloneForSplit(locked);
      const rows: Transaction[] = [];

      for (const [index, part] of dto.parts.entries()) {
        const amount = amounts[index];
        const row = index === 0 ? locked : repo.create(template as Transaction);

        row.amount = amount;
        row.debit = isExpense ? amount : null;
        row.credit = isExpense ? null : amount;
        row.amountForeign = foreignAmounts[index];
        row.splitGroupId = splitGroupId;
        row.splitIndex = index;
        // Part 0 would otherwise keep a fingerprint hashed from the pre-split
        // amount. Null on every part so backfillFingerprints recomputes them all.
        row.fingerprint = null;

        // Per-part override, else keep what the row already inherited.
        row.categoryId = part.categoryId ?? row.categoryId;
        row.paymentPurpose = part.paymentPurpose ?? row.paymentPurpose;
        row.comments = part.comments ?? row.comments;

        // Re-assessed after the category override, because a part moved to a
        // different category may fall under a different rule. A rate the user
        // picked by hand is carried through; an auto-assigned one is derived
        // again from the part's own amount and category.
        const assignment = await this.taxAssignmentService.resolve({
          workspaceId,
          transactionDate: row.transactionDate,
          amountMinor: toMinor(amount),
          categoryId: row.categoryId,
          transactionType: row.transactionType,
          transactionNature: row.transactionNature,
          explicitTaxRateId: row.taxSource === TaxSource.MANUAL ? row.taxRateId : null,
          counterpartyCountry: row.counterpartyCountry,
          counterpartyVatId: row.counterpartyVatId,
        });

        row.taxRateId = assignment.taxRateId;
        row.taxRuleId = assignment.taxRuleId;
        row.taxSource = assignment.taxSource;
        row.taxAmount = assignment.taxAmount;
        row.taxNetAmount = assignment.taxNetAmount;
        row.taxReverseCharge = assignment.taxReverseCharge;
        row.taxNotionalAmount = assignment.taxNotionalAmount;

        rows.push(await repo.save(row));
      }

      return rows;
    });

    await this.invalidateReports(userId);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { operation: 'split', splitGroupId, partCount: saved.length },
      isUndoable: false,
    });

    return saved;
  }

  /**
   * Returns every part of the split group the given transaction belongs to,
   * ordered as the split created them. An unsplit transaction is a group of one.
   */
  async getSplitParts(id: string, workspaceId: string): Promise<Transaction[]> {
    const transaction = await this.findOne(id, workspaceId);
    if (!transaction.splitGroupId) {
      return [transaction];
    }

    return this.transactionRepository.find({
      // Same relations as findOne, so a caller gets one shape either way.
      where: { workspaceId, splitGroupId: transaction.splitGroupId },
      relations: ['category', 'branch', 'wallet'],
      order: { splitIndex: 'ASC' },
    });
  }

  /**
   * Merges a split group back into a single row: the lowest splitIndex survives
   * carrying the group's total, the other parts are deleted. The inverse of
   * split(), and like it invisible to every aggregate, since the total is unchanged.
   *
   * The survivor keeps its own categoryId, paymentPurpose and comments — i.e.
   * part 0's, which may be a per-part override rather than what the row held
   * before it was split. Those pre-split values are not stored anywhere, so they
   * cannot be restored; that loss is accepted, not an oversight.
   */
  async unsplit(id: string, workspaceId: string, userId: string): Promise<Transaction> {
    await this.ensureCanEditStatements(userId, workspaceId);

    // Fast path only: reject an obviously invalid request before opening a DB
    // transaction and taking row locks. The authoritative read is the locked one.
    const target = await this.findOne(id, workspaceId);
    if (!target.splitGroupId) {
      throw new BadRequestException('Transaction is not part of a split');
    }
    const splitGroupId = target.splitGroupId;

    // Plain copies for the audit diff, not entities: spreading drops the
    // entity's own methods.
    let before: Array<Partial<Transaction>> = [];
    let repointed = { duplicates: 0, receipts: 0, payables: 0 };

    const merged = await this.transactionRepository.manager.transaction(async manager => {
      const repo = manager.getRepository(Transaction);

      // Lock the whole group in one ordered statement. A concurrent unsplit of the
      // same group queues here instead of double-counting the total or deleting
      // rows this one already folded in, and the shared ORDER BY gives both
      // statements the same lock order, so they queue rather than deadlock.
      // No relations: Postgres cannot lock the nullable side of an outer join.
      const parts = await repo.find({
        where: { workspaceId, splitGroupId },
        order: { splitIndex: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      // Empty means the group is gone — another request unsplit it while this one
      // waited for the lock. A single part is a group that lost its siblings some
      // other way; clearing its markers below is the right repair either way.
      if (parts.length === 0) {
        throw new BadRequestException('Transaction is not part of a split');
      }

      before = parts.map(part => ({ ...part }));

      // A part can be flagged as a duplicate AFTER the split: isSameSplitGroup only
      // excludes pairs sharing a splitGroupId, so a part stays comparable against
      // rows in other statements and markDuplicates can flag it at any time. A
      // flagged row is excluded from reports, so merging would either inflate
      // reported spend (a flagged sibling folded into the unflagged survivor) or
      // erase the whole charge (part 0 flagged, survivor keeps isDuplicate). Refuse,
      // as assertSplittable does on the way in — with its own message, so the two
      // sides are distinguishable. Checked on the locked rows: the flag may have
      // landed after the unlocked read.
      if (parts.some(part => part.isDuplicate)) {
        throw new BadRequestException(
          'Cannot unsplit a group containing a transaction marked as a duplicate',
        );
      }

      const [survivor, ...rest] = parts;
      // Falls back the same way assertSplittable reads an amount. Unreachable while
      // split() always writes `amount`, but the two sides should not disagree about
      // where a part's money lives.
      const total = this.round2(
        parts.reduce((sum, part) => sum + Number(part.amount ?? part.debit ?? part.credit ?? 0), 0),
      );
      // Null only when no part carries a foreign amount at all. A group whose
      // foreign amounts genuinely total 0 keeps the 0, mirroring split(), which
      // passes a present-but-zero amountForeign through as a number rather than
      // treating it as absent.
      const hasForeign = parts.some(part => (part.amountForeign ?? null) !== null);
      const foreignTotal = hasForeign
        ? this.round2(parts.reduce((sum, part) => sum + Number(part.amountForeign ?? 0), 0))
        : null;
      const isExpense = survivor.transactionType === TransactionType.EXPENSE;

      survivor.amount = total;
      survivor.debit = isExpense ? total : null;
      survivor.credit = isExpense ? null : total;
      survivor.amountForeign = foreignTotal;
      survivor.splitGroupId = null;
      survivor.splitIndex = null;
      // The stored hash was computed from the part amount, which just changed.
      // A stale hash makes a later import treat a genuine transaction as a
      // duplicate and drop it; null lets backfillFingerprints recompute it.
      survivor.fingerprint = null;

      const saved = await repo.save(survivor);

      if (rest.length > 0) {
        // Every FK pointing at transactions.id is ON DELETE SET NULL, so deleting a
        // part silently unlinks whatever referenced it. Repoint at the survivor
        // FIRST — after the delete the FK has already been nulled and the link is
        // unrecoverable. The survivor represents the whole charge again, so it is
        // the right target for all three.
        const removedIds = rest.map(part => part.id);

        // Without this, a transaction whose master was a deleted part is left
        // isDuplicate=true with duplicateOfId=null: excluded from reports forever,
        // with no master and no UI path to unflag it. The survivor cannot be
        // repointed at itself here — a row with duplicateOfId set always has
        // isDuplicate set too, which the guard above already rejected.
        const duplicates = await manager
          .getRepository(Transaction)
          .update({ workspaceId, duplicateOfId: In(removedIds) }, { duplicateOfId: survivor.id });

        const receipts = await manager
          .getRepository(Receipt)
          .update({ workspaceId, transactionId: In(removedIds) }, { transactionId: survivor.id });

        const payables = await manager
          .getRepository(Payable)
          .update(
            { workspaceId, linkedTransactionId: In(removedIds) },
            { linkedTransactionId: survivor.id },
          );

        repointed = {
          duplicates: duplicates.affected ?? 0,
          receipts: receipts.affected ?? 0,
          payables: payables.affected ?? 0,
        };

        await repo.remove(rest);
      }

      return saved;
    });

    await this.invalidateReports(userId);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: merged.id,
      action: AuditAction.UPDATE,
      diff: { before, after: merged },
      meta: {
        operation: 'unsplit',
        splitGroupId,
        partCount: before.length,
        duplicatesRepointed: repointed.duplicates,
        receiptsRepointed: repointed.receipts,
        payablesRepointed: repointed.payables,
      },
      isUndoable: false,
    });

    return merged;
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.ensureCanEditStatements(userId, workspaceId);
    const transaction = await this.findOne(id, workspaceId);
    // Use delete for simplicity; entity already validated for ownership.

    await this.transactionRepository.delete(transaction.id);
    await this.invalidateReports(userId);

    // Audit: record deletion for potential rollback.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: transaction.id,
      action: AuditAction.DELETE,
      diff: { before: transaction, after: null },
      meta: {
        statementId: transaction.statementId,
      },
      isUndoable: true,
    });

    this.eventEmitter?.emit('data.deleted', {
      workspaceId,
      actorId: userId,
      actorName: await this.resolveActorName(userId),
      entityType: 'transaction',
      entityLabel: transaction.documentNumber || transaction.counterpartyName,
      count: 1,
    } satisfies DataDeletedEvent);
  }
}
