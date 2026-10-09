import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { normalizePagination } from '../../common/utils/pagination.util';
import { EntityType } from '../../entities/audit-event.entity';
import { Category } from '../../entities/category.entity';
import {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import {
  Payable,
  PayableDirection,
  PayableSource,
  PayableStatus,
} from '../../entities/payable.entity';
import { PayablePayment } from '../../entities/payable-payment.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { AddPayablePaymentDto, AllocateTransactionDto } from './dto/add-payable-payment.dto';
import { CreatePayableDto } from './dto/create-payable.dto';
import { ExportFormat, FilterPayablesDto, PayablesSortOption } from './dto/filter-payables.dto';
import type { MarkPayablePaidDto } from './dto/mark-payable-paid.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { PayablesExportService } from './payables-export.service';

/** A transaction that may be the payment of a bill. */
export interface PaymentCandidate {
  id: string;
  transactionDate: string;
  amount: string;
  currency: string;
  counterpartyName: string;
  paymentPurpose: string;
  /** The counterparty or purpose names the bill's vendor. */
  vendorMatch: boolean;
}

/** A proposed split of one transaction over several bills. */
export interface AllocationSuggestion {
  transactionId: string;
  /** What is left of the transaction once payments already recorded are taken off. */
  available: number;
  currency: string;
  /** The bills add up to the whole of it, each one in full. */
  exact: boolean;
  unallocated: number;
  allocations: Array<{
    payableId: string;
    vendor: string;
    dueDate: string | null;
    outstanding: number;
    amount: number;
    /** This transaction covers only part of the bill. */
    partial: boolean;
  }>;
}

const CANDIDATE_LIMIT = 10;
/** How many open bills the exact-subset search looks at: 2^12 combinations. */
const ALLOCATION_POOL_SIZE = 12;
/** How long before its due date (or creation) a bill may already have been paid. */
const CANDIDATE_LOOKBACK_DAYS = 30;

@Injectable()
export class PayablesService {
  private readonly logger = new Logger(PayablesService.name);

  constructor(
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
    @InjectRepository(PayablePayment)
    private readonly paymentRepository: Repository<PayablePayment>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly notificationsService: NotificationsService,
    private readonly payablesExportService: PayablesExportService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreatePayableDto): Promise<Payable> {
    await this.assertLinkedEntitiesInWorkspace(
      workspaceId,
      dto.linkedTransactionId ?? null,
      dto.statementId ?? null,
    );

    const payable = this.payableRepository.create({
      workspaceId,
      createdById: userId,
      direction: dto.direction || PayableDirection.PAYABLE,
      vendor: dto.vendor,
      amount: dto.amount,
      currency: await this.workspaceCurrency.resolveFor(workspaceId, dto.currency),
      dueDate: this.parseDate(dto.dueDate),
      status: dto.status || PayableStatus.TO_PAY,
      linkedTransactionId: dto.linkedTransactionId || null,
      source: dto.source || PayableSource.MANUAL,
      isRecurring: dto.isRecurring ?? false,
      comment: dto.comment || null,
      statementId: dto.statementId || null,
      paidAt: dto.status === PayableStatus.PAID ? new Date() : null,
      dueSoonNotifiedAt: null,
    });

    return this.payableRepository.save(payable);
  }

  async findAll(workspaceId: string, filters: FilterPayablesDto) {
    const { page, limit, skip } = normalizePagination(filters);
    const queryBuilder = this.applySorting(this.buildFilteredQuery(workspaceId, filters), filters)
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async findOne(id: string, workspaceId: string): Promise<Payable> {
    const payable = await this.payableRepository.findOne({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!payable) {
      throw new NotFoundException('Payable not found');
    }

    return payable;
  }

  async update(
    id: string,
    workspaceId: string,
    _userId: string,
    dto: UpdatePayableDto,
  ): Promise<Payable> {
    const payable = await this.findOne(id, workspaceId);
    await this.assertLinkedEntitiesInWorkspace(
      workspaceId,
      dto.linkedTransactionId === undefined ? undefined : (dto.linkedTransactionId ?? null),
      dto.statementId === undefined ? undefined : (dto.statementId ?? null),
    );
    Object.assign(payable, this.normalizeUpdateDto(dto, payable));
    return this.payableRepository.save(payable);
  }

  /**
   * Marks a bill paid: plainly, against an existing transaction, or — paid in
   * cash — by recording the payment as a new transaction of a wallet. The
   * payment then reaches the ledger like any other transaction.
   *
   * Idempotent by state: the bill's row is locked, and a bill that is already
   * paid and linked is returned as it is, so a retried request never records
   * the cash payment twice.
   */
  async markAsPaid(
    id: string,
    workspaceId: string,
    userId: string,
    payload: MarkPayablePaidDto,
  ): Promise<Payable> {
    if (payload.linkedTransactionId && payload.payFromWalletId) {
      throw new BadRequestException(appError('PAYABLE_PAYMENT_AMBIGUOUS'));
    }
    await this.findOne(id, workspaceId);
    await this.assertLinkedTransactionInWorkspace(workspaceId, payload.linkedTransactionId ?? null);

    const saved = await this.payableRepository.manager.transaction(async manager => {
      const payable = await manager.getRepository(Payable).findOneOrFail({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (payload.payFromWalletId) {
        if (payable.status === PayableStatus.PAID && payable.linkedTransactionId) {
          return payable;
        }
        if (payable.linkedTransactionId) {
          throw new ConflictException(appError('PAYABLE_ALREADY_LINKED'));
        }
        payable.linkedTransactionId = await this.recordCashPayment(
          manager,
          payable,
          payload.payFromWalletId,
          payload,
        );
      }
      // Swapping the payment silently would leave the old one (a recorded cash
      // payment, say) in the books as well: the expense would count twice.
      if (
        payload.linkedTransactionId &&
        payable.linkedTransactionId &&
        payable.linkedTransactionId !== payload.linkedTransactionId
      ) {
        throw new ConflictException(appError('PAYABLE_ALREADY_LINKED'));
      }
      payable.linkedTransactionId = payload.linkedTransactionId || payable.linkedTransactionId;
      // Settling in full is one payment for everything still outstanding, so
      // the payment log is the whole truth and the status is derived from it.
      await this.recordPayment(manager, payable, {
        amount: this.outstandingOf(payable),
        paidOn: payload.paidOn ?? this.toDateString(new Date()),
        transactionId: payable.linkedTransactionId,
        createdById: userId,
      });
      return this.applyPaymentTotals(manager, payable, workspaceId);
    });

    try {
      await this.notificationsService.createForWorkspaceMembers({
        workspaceId,
        actorId: userId,
        type: NotificationType.PAYABLE_MARKED_PAID,
        category: NotificationCategory.WORKSPACE_ACTIVITY,
        severity: NotificationSeverity.INFO,
        messageKey: 'payable.marked_paid',
        messageParams: { vendor: saved.vendor },
        entityType: EntityType.PAYABLE,
        entityId: saved.id,
        meta: {
          payableId: saved.id,
          direction: saved.direction,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send payable paid notification for ${saved.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return saved;
  }

  private async recordCashPayment(
    manager: EntityManager,
    payable: Payable,
    walletId: string,
    payload: Pick<MarkPayablePaidDto, 'paidOn' | 'categoryId'>,
    /** What was handed over now; the whole bill when not said otherwise. */
    paidAmount?: number,
  ): Promise<string> {
    const workspaceId = payable.workspaceId;
    const wallet = await manager.getRepository(Wallet).findOne({
      where: { id: walletId, workspaceId },
      select: ['id', 'currency'],
    });
    if (!wallet) {
      throw new BadRequestException(appError('PAYABLE_WALLET_NOT_FOUND'));
    }
    const currency = payable.currency.toUpperCase();
    if (wallet.currency.toUpperCase() !== currency) {
      throw new BadRequestException(
        appError('PAYABLE_WALLET_CURRENCY_MISMATCH', {
          walletCurrency: wallet.currency.toUpperCase(),
          currency,
        }),
      );
    }
    if (payload.categoryId) {
      const category = await manager.getRepository(Category).exists({
        where: { id: payload.categoryId, workspaceId },
      });
      if (!category) {
        throw new BadRequestException(appError('PAYABLE_CATEGORY_NOT_FOUND'));
      }
    }

    const isIncome = payable.direction === PayableDirection.RECEIVABLE;
    const amount = this.round2(paidAmount ?? Number(payable.amount));
    const transactions = manager.getRepository(Transaction);
    const transaction = await transactions.save(
      transactions.create({
        workspaceId,
        statementId: null,
        walletId: wallet.id,
        transactionDate: payload.paidOn ? new Date(payload.paidOn) : new Date(),
        counterpartyName: payable.vendor,
        paymentPurpose: payable.comment || payable.vendor,
        amount,
        debit: isIncome ? null : amount,
        credit: isIncome ? amount : null,
        currency,
        transactionType: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
        categoryId: payload.categoryId ?? null,
        // The user recorded this payment by hand.
        isVerified: true,
      }),
    );
    return transaction.id;
  }

  /**
   * Transactions that may be the payment of a bill: same currency, amount and
   * direction, dated from a month before it was due (or created) up to today,
   * not a duplicate, not on a trashed statement and not settling another bill.
   * Those naming the vendor come first, then the ones closest to the due date.
   */
  /** The payments against a bill, newest first. */
  async listPayments(id: string, workspaceId: string): Promise<PayablePayment[]> {
    await this.findOne(id, workspaceId);
    return this.paymentRepository.find({
      where: { payableId: id, workspaceId },
      order: { paidOn: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Records part of the money, or all of it.
   *
   * The amount is what the bill is credited with; a processor fee is held
   * separately, because the client owes nothing extra while the bank received
   * less. The status follows the sum of the payments — nobody sets it.
   */
  async addPayment(
    id: string,
    workspaceId: string,
    userId: string,
    dto: AddPayablePaymentDto,
  ): Promise<Payable> {
    if (dto.linkedTransactionId && dto.payFromWalletId) {
      throw new BadRequestException(appError('PAYABLE_PAYMENT_AMBIGUOUS'));
    }
    await this.findOne(id, workspaceId);
    await this.assertLinkedTransactionInWorkspace(workspaceId, dto.linkedTransactionId ?? null);

    return this.payableRepository.manager.transaction(async manager => {
      const payable = await manager.getRepository(Payable).findOneOrFail({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });

      const outstanding = this.outstandingOf(payable);
      const amount = this.round2(dto.amount);
      if (amount <= 0) {
        throw new BadRequestException(appError('PAYABLE_PAYMENT_NOT_POSITIVE'));
      }
      if (amount > outstanding + 0.005) {
        throw new BadRequestException(
          appError('PAYABLE_PAYMENT_EXCEEDS_OUTSTANDING', {
            outstanding: outstanding.toFixed(2),
          }),
        );
      }

      let transactionId = dto.linkedTransactionId ?? null;
      if (dto.payFromWalletId) {
        transactionId = await this.recordCashPayment(
          manager,
          payable,
          dto.payFromWalletId,
          { paidOn: dto.paidOn, categoryId: dto.categoryId },
          amount,
        );
      }

      await this.recordPayment(manager, payable, {
        amount,
        feeAmount: dto.feeAmount ? this.round2(dto.feeAmount) : 0,
        paidOn: dto.paidOn ?? this.toDateString(new Date()),
        transactionId,
        comment: dto.comment ?? null,
        createdById: userId,
      });

      // The first payment keeps the legacy single link, which is what the
      // ledger and the older screens read.
      if (transactionId && !payable.linkedTransactionId) {
        payable.linkedTransactionId = transactionId;
      }
      return this.applyPaymentTotals(manager, payable, workspaceId);
    });
  }

  /** Undoes one payment; the status falls back to whatever the rest adds up to. */
  async removePayment(id: string, paymentId: string, workspaceId: string): Promise<Payable> {
    await this.findOne(id, workspaceId);
    return this.payableRepository.manager.transaction(async manager => {
      const payments = manager.getRepository(PayablePayment);
      const payment = await payments.findOne({
        where: { id: paymentId, payableId: id, workspaceId },
      });
      if (!payment) {
        throw new NotFoundException(appError('PAYABLE_PAYMENT_NOT_FOUND'));
      }
      await payments.delete({ id: paymentId });

      const remaining = await payments.find({ where: { payableId: id, workspaceId } });
      const payable = await manager
        .getRepository(Payable)
        .findOneOrFail({ where: { id, workspaceId } });
      if (payment.transactionId && payable.linkedTransactionId === payment.transactionId) {
        payable.linkedTransactionId = remaining[0]?.transactionId ?? null;
      }
      return this.applyPaymentTotals(manager, payable, workspaceId);
    });
  }

  /**
   * Spreads one transaction over several bills — the lump-sum wire that covers
   * four invoices, which otherwise matches none of them.
   */
  async allocateTransaction(
    workspaceId: string,
    userId: string,
    dto: AllocateTransactionDto,
  ): Promise<Payable[]> {
    await this.assertLinkedTransactionInWorkspace(workspaceId, dto.transactionId);
    const settled: Payable[] = [];
    for (const allocation of dto.allocations) {
      settled.push(
        await this.addPayment(allocation.payableId, workspaceId, userId, {
          amount: allocation.amount,
          feeAmount: allocation.feeAmount,
          paidOn: dto.paidOn,
          linkedTransactionId: dto.transactionId,
          comment: dto.comment,
        }),
      );
    }
    return settled;
  }

  /**
   * Proposes which bills one transaction covers.
   *
   * The lump sum that pays four invoices matches none of them on its own, so
   * the split has to be guessed: first a set of bills that adds up to the
   * amount exactly, otherwise the oldest ones until the money runs out. The
   * caller confirms it through `allocateTransaction` — nothing is written here.
   */
  async suggestAllocation(
    workspaceId: string,
    transactionId: string,
  ): Promise<AllocationSuggestion> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found in workspace');
    }

    const total = this.round2(
      Number(transaction.amount ?? transaction.debit ?? transaction.credit ?? 0),
    );
    const spent = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'sum')
      .where('payment.transactionId = :transactionId', { transactionId })
      .andWhere('payment.workspaceId = :workspaceId', { workspaceId })
      .getRawOne<{ sum: string }>();
    const available = this.round2(total - Number(spent?.sum ?? 0));

    const empty: AllocationSuggestion = {
      transactionId,
      available,
      currency: this.normalizeCurrency(transaction.currency),
      exact: false,
      unallocated: available,
      allocations: [],
    };
    if (available <= 0.005) {
      return empty;
    }

    const rows: Array<{
      id: string;
      vendor: string;
      due_date: string | null;
      outstanding: string;
    }> = await this.payableRepository.query(
      `SELECT p."id", p."vendor", p."due_date"::text AS "due_date",
              (p."amount" - COALESCE(p."paid_amount", 0))::text AS "outstanding"
         FROM "payables" p
        WHERE p."workspace_id" = $1
          AND p."deleted_at" IS NULL
          AND upper(p."currency") = upper($2)
          AND p."direction" = $3
          AND p."status" NOT IN ('paid', 'archived')
          AND p."amount" - COALESCE(p."paid_amount", 0) > 0.005
          AND NOT EXISTS (
            SELECT 1 FROM "payable_payments" pp
             WHERE pp."payable_id" = p."id" AND pp."transaction_id" = $4
          )
        ORDER BY COALESCE(
                   p."vendor" <> '' AND position(lower(p."vendor") IN lower($5)) > 0,
                   false
                 ) DESC,
                 p."due_date" NULLS LAST,
                 p."id"
        LIMIT $6`,
      [
        workspaceId,
        transaction.currency,
        transaction.transactionType === TransactionType.INCOME
          ? PayableDirection.RECEIVABLE
          : PayableDirection.PAYABLE,
        transactionId,
        transaction.counterpartyName ?? '',
        ALLOCATION_POOL_SIZE,
      ],
    );
    if (rows.length === 0) {
      return empty;
    }

    const pool = rows.map(row => ({
      payableId: row.id,
      vendor: row.vendor,
      dueDate: row.due_date,
      outstanding: this.round2(Number(row.outstanding)),
    }));

    const exact = this.exactSubset(
      pool.map(bill => bill.outstanding),
      available,
    );
    if (exact) {
      return {
        ...empty,
        exact: true,
        unallocated: 0,
        allocations: exact.map(index => ({
          ...pool[index],
          amount: pool[index].outstanding,
          partial: false,
        })),
      };
    }

    // Nothing adds up: pay the oldest bills in full and leave the last one short.
    let left = available;
    const allocations = [];
    for (const bill of pool) {
      if (left <= 0.005) {
        break;
      }
      const amount = Math.min(left, bill.outstanding);
      allocations.push({
        ...bill,
        amount: this.round2(amount),
        partial: amount < bill.outstanding - 0.005,
      });
      left = this.round2(left - amount);
    }
    return { ...empty, unallocated: this.round2(left), allocations };
  }

  /**
   * The smallest set of bills that adds up to the amount, by index.
   *
   * Exhaustive over at most 2^12 combinations — the pool is capped, so this
   * stays a few thousand additions rather than a search problem.
   */
  private exactSubset(amounts: number[], target: number): number[] | null {
    let best: number[] | null = null;
    for (let mask = 1; mask < 1 << amounts.length; mask++) {
      const picked: number[] = [];
      let sum = 0;
      for (let index = 0; index < amounts.length; index++) {
        if (mask & (1 << index)) {
          picked.push(index);
          sum += amounts[index];
        }
      }
      if (Math.abs(sum - target) <= 0.01 && (!best || picked.length < best.length)) {
        best = picked;
      }
    }
    return best;
  }

  private async recordPayment(
    manager: EntityManager,
    payable: Payable,
    input: {
      amount: number;
      feeAmount?: number;
      paidOn: string;
      transactionId: string | null;
      comment?: string | null;
      createdById: string | null;
    },
  ): Promise<void> {
    const payments = manager.getRepository(PayablePayment);
    // Idempotent per (bill, transaction): a retried request re-applies the
    // same bank row rather than crediting the bill twice.
    if (input.transactionId) {
      const existing = await payments.findOne({
        where: { payableId: payable.id, transactionId: input.transactionId },
      });
      if (existing) {
        return;
      }
    }
    await payments.save(
      payments.create({
        payableId: payable.id,
        workspaceId: payable.workspaceId,
        amount: input.amount,
        feeAmount: input.feeAmount ?? 0,
        paidOn: input.paidOn,
        transactionId: input.transactionId,
        comment: input.comment ?? null,
        createdById: input.createdById,
      }),
    );
  }

  /**
   * Recomputes a bill whose amount changed outside the payment log — a credit
   * note lowering what a client owes, say: a part-paid invoice credited down
   * to what already arrived is paid, with no new payment.
   */
  async recomputeFromPayments(
    manager: EntityManager,
    id: string,
    workspaceId: string,
  ): Promise<Payable> {
    return this.applyPaymentTotals(manager, id, workspaceId);
  }

  /** Recomputes `paid_amount`, the status and `paid_at` from the payment log. */
  private async applyPaymentTotals(
    manager: EntityManager,
    target: Payable | string,
    workspaceId: string,
  ): Promise<Payable> {
    const payables = manager.getRepository(Payable);
    // Given the entity, it is saved as it stands: a caller that has just set
    // `linkedTransactionId` must not lose it to a re-read.
    const payable =
      typeof target === 'string'
        ? await payables.findOneOrFail({ where: { id: target, workspaceId } })
        : target;
    const payments = await manager
      .getRepository(PayablePayment)
      .find({ where: { payableId: payable.id, workspaceId } });

    const paid = this.round2(payments.reduce((sum, row) => sum + Number(row.amount), 0));
    const total = Number(payable.amount);
    const fullyPaid = paid >= total - 0.005;
    const lastPaidOn = payments
      .map(row => row.paidOn)
      .sort()
      .at(-1);

    payable.paidAmount = paid;
    // A bill can close with no payment at all — credited down to nothing — and
    // then the day it closed is today, not the date of a payment there is none of.
    const settledOn = lastPaidOn ? new Date(`${lastPaidOn}T00:00:00.000Z`) : new Date();
    payable.paidAt = fullyPaid ? (payable.paidAt ?? settledOn) : null;
    // An archived bill stays archived: it was withdrawn, not paid.
    if (payable.status !== PayableStatus.ARCHIVED) {
      payable.status = fullyPaid
        ? PayableStatus.PAID
        : paid > 0
          ? PayableStatus.PARTIALLY_PAID
          : this.unpaidStatusOf(payable);
    }
    return payables.save(payable);
  }

  /** What an unpaid bill reads as: overdue if its day has passed, else to pay. */
  private unpaidStatusOf(payable: Payable): PayableStatus {
    if (payable.status === PayableStatus.SCHEDULED) {
      return PayableStatus.SCHEDULED;
    }
    const due = payable.dueDate ? this.toDateString(payable.dueDate) : null;
    return due && due < this.toDateString(new Date())
      ? PayableStatus.OVERDUE
      : PayableStatus.TO_PAY;
  }

  private outstandingOf(payable: Payable): number {
    return this.round2(Number(payable.amount) - Number(payable.paidAmount ?? 0));
  }

  private round2(value: number): number {
    return Math.round(Number(value) * 100) / 100;
  }

  async findPaymentCandidates(id: string, workspaceId: string): Promise<PaymentCandidate[]> {
    const payable = await this.findOne(id, workspaceId);
    const anchor = payable.dueDate ?? payable.createdAt;
    const rows: Array<{
      id: string;
      transaction_date: string;
      amount: string;
      currency: string;
      counterparty_name: string;
      payment_purpose: string;
      vendor_match: boolean;
    }> = await this.transactionRepository.query(
      `SELECT t."id", t."transaction_date"::text AS "transaction_date",
              coalesce(t."amount", t."debit", t."credit")::text AS "amount", t."currency",
              t."counterparty_name", t."payment_purpose",
              (position(lower($5) IN lower(t."counterparty_name")) > 0
               OR position(lower($5) IN lower(t."payment_purpose")) > 0) AS "vendor_match"
         FROM "transactions" t
         LEFT JOIN "statements" s ON s."id" = t."statement_id"
        WHERE t."workspace_id" = $1
          AND upper(t."currency") = upper($2)
          -- No exact-amount rule: a client who underpays, pays in instalments,
          -- has a processor fee deducted, or sends one wire for four invoices
          -- still sent the money for this bill. Anything with money left on it
          -- is a candidate; the exact match, then the closest, comes first.
          AND t."transaction_type" = $4
          AND t."transaction_date" BETWEEN least($6::date, $7::date) - $8::int AND current_date
          AND NOT t."is_duplicate"
          AND ${countedSql('t')}
          AND (t."statement_id" IS NULL OR s."deleted_at" IS NULL)
          -- Not already applied to this bill, and not already spent in full on
          -- others: one wire can settle four invoices, but only up to its own
          -- amount.
          AND NOT EXISTS (
            SELECT 1 FROM "payable_payments" pp
             WHERE pp."transaction_id" = t."id" AND pp."payable_id" = $9
          )
          AND COALESCE((
                SELECT SUM(pp."amount") FROM "payable_payments" pp
                 WHERE pp."transaction_id" = t."id"
              ), 0) < coalesce(t."amount", t."debit", t."credit") - 0.005
          -- A bill carrying the legacy single link but no payment rows still
          -- has that transaction spoken for.
          AND NOT EXISTS (
            SELECT 1 FROM "payables" p
             WHERE p."linked_transaction_id" = t."id"
               AND p."id" <> $9
               AND p."deleted_at" IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM "payable_payments" pp WHERE pp."payable_id" = p."id"
               )
          )
        ORDER BY abs(coalesce(t."amount", t."debit", t."credit") - $3) <= 0.01 DESC,
                 "vendor_match" DESC,
                 abs(coalesce(t."amount", t."debit", t."credit") - $3),
                 abs(t."transaction_date" - $6::date),
                 t."id"
        LIMIT $10`,
      [
        workspaceId,
        payable.currency,
        this.outstandingOf(payable),
        payable.direction === PayableDirection.RECEIVABLE
          ? TransactionType.INCOME
          : TransactionType.EXPENSE,
        payable.vendor,
        this.toDateString(anchor),
        this.toDateString(payable.createdAt),
        CANDIDATE_LOOKBACK_DAYS,
        payable.id,
        CANDIDATE_LIMIT,
      ],
    );
    return rows.map(row => ({
      id: row.id,
      transactionDate: row.transaction_date,
      amount: row.amount,
      currency: row.currency,
      counterpartyName: row.counterparty_name,
      paymentPurpose: row.payment_purpose,
      vendorMatch: row.vendor_match,
    }));
  }

  private toDateString(value: Date | string): string {
    return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  }

  async archive(id: string, workspaceId: string, _userId: string): Promise<Payable> {
    const payable = await this.findOne(id, workspaceId);
    payable.status = PayableStatus.ARCHIVED;
    return this.payableRepository.save(payable);
  }

  async remove(id: string, workspaceId: string, _userId: string): Promise<void> {
    const payable = await this.findOne(id, workspaceId);
    await this.payableRepository.softRemove(payable);
  }

  async getSummary(
    workspaceId: string,
    direction: PayableDirection = PayableDirection.PAYABLE,
  ): Promise<{
    toPay: number;
    overdue: number;
    dueThisWeek: number;
    paidThisMonth: number;
    paidTotal: number;
    toPayCount: number;
    overdueCount: number;
    paidTotalCount: number;
  }> {
    const rows = await this.payableRepository.find({
      where: { workspaceId, direction, deletedAt: IsNull() },
      select: {
        id: true,
        status: true,
        dueDate: true,
        amount: true,
        currency: true,
        paidAt: true,
        updatedAt: true,
      },
    });
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['currency'],
    });
    const targetCurrency = this.normalizeCurrency(workspace?.currency);
    const rateCache = new Map<string, number>();

    const now = new Date();
    const startOfToday = this.startOfDay(now);
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    let toPay = 0;
    let overdue = 0;
    let dueThisWeek = 0;
    let paidThisMonth = 0;
    let paidTotal = 0;
    let toPayCount = 0;
    let overdueCount = 0;
    let paidTotalCount = 0;

    for (const row of rows) {
      const amount = await this.convertSummaryAmount(
        Number(row.amount || 0),
        row.currency,
        targetCurrency,
        rateCache,
        workspaceId,
      );
      const dueDate = this.parseDate(row.dueDate);
      const paidAt = this.parseDate(row.paidAt ?? row.updatedAt);
      const effectiveOverdue =
        dueDate !== null &&
        dueDate < startOfToday &&
        ![PayableStatus.PAID, PayableStatus.ARCHIVED].includes(row.status);

      if (effectiveOverdue) {
        overdue += amount;
        overdueCount += 1;
      } else if (row.status === PayableStatus.TO_PAY || row.status === PayableStatus.SCHEDULED) {
        toPay += amount;
        toPayCount += 1;
        if (dueDate && dueDate >= startOfToday && dueDate <= endOfWeek) {
          dueThisWeek += amount;
        }
      }

      if (
        row.status === PayableStatus.PAID &&
        paidAt &&
        paidAt >= startOfMonth &&
        paidAt <= endOfMonth
      ) {
        paidThisMonth += amount;
      }

      if (row.status === PayableStatus.PAID) {
        paidTotal += amount;
        paidTotalCount += 1;
      }
    }

    return {
      toPay,
      overdue,
      dueThisWeek,
      paidThisMonth,
      paidTotal,
      toPayCount,
      overdueCount,
      paidTotalCount,
    };
  }

  async getExportData(workspaceId: string, filters: FilterPayablesDto): Promise<Payable[]> {
    return this.applySorting(this.buildFilteredQuery(workspaceId, filters), filters).getMany();
  }

  private applySorting(
    queryBuilder: ReturnType<PayablesService['buildFilteredQuery']>,
    filters: FilterPayablesDto,
  ) {
    switch (filters.sort) {
      case PayablesSortOption.DUE_DATE_DESC:
        return queryBuilder.orderBy('payable.dueDate', 'DESC', 'NULLS LAST');
      case PayablesSortOption.AMOUNT_DESC:
        return queryBuilder.orderBy('payable.amount', 'DESC');
      case PayablesSortOption.VENDOR_ASC:
        return queryBuilder.orderBy('payable.vendor', 'ASC');
      default:
        return queryBuilder.orderBy('payable.dueDate', 'ASC', 'NULLS LAST');
    }
  }

  async exportData(
    workspaceId: string,
    filters: FilterPayablesDto,
  ): Promise<{ filePath: string; fileName: string; contentType: string }> {
    const data = await this.getExportData(workspaceId, filters);
    return this.payablesExportService.exportPayables(data, filters.format || ExportFormat.EXCEL);
  }

  isOverdue(payable: Pick<Payable, 'status' | 'dueDate'>): boolean {
    if (!payable.dueDate) {
      return false;
    }

    if ([PayableStatus.PAID, PayableStatus.ARCHIVED].includes(payable.status)) {
      return false;
    }

    return this.startOfDay(payable.dueDate) < this.startOfDay(new Date());
  }

  async findOverduePayables(): Promise<Payable[]> {
    return this.payableRepository
      .createQueryBuilder('payable')
      .where('payable.deletedAt IS NULL')
      .andWhere('payable.status IN (:...statuses)', {
        statuses: [PayableStatus.TO_PAY, PayableStatus.SCHEDULED],
      })
      .andWhere('payable.dueDate < :today', {
        today: this.startOfDay(new Date()),
      })
      .getMany();
  }

  /**
   * Feeds due-soon reminders only.
   * ponytail: payables only — receivable reminders need their own message key
   * and wording ("chase the customer", not "pay the vendor"); add a direction
   * argument here once those translations exist.
   */
  async findDueSoonPayables(days = 7): Promise<Payable[]> {
    const today = this.startOfDay(new Date());
    const targetDate = new Date(today);
    targetDate.setUTCDate(targetDate.getUTCDate() + days);

    return this.payableRepository
      .createQueryBuilder('payable')
      .where('payable.deletedAt IS NULL')
      .andWhere('payable.direction = :direction', { direction: PayableDirection.PAYABLE })
      .andWhere('payable.status IN (:...statuses)', {
        statuses: [PayableStatus.TO_PAY, PayableStatus.SCHEDULED],
      })
      .andWhere('payable.dueSoonNotifiedAt IS NULL')
      .andWhere('payable.dueDate BETWEEN :from AND :to', {
        from: today,
        to: targetDate,
      })
      .getMany();
  }

  async markOverduePayables(): Promise<Payable[]> {
    const overduePayables = await this.findOverduePayables();
    const updated: Payable[] = [];

    for (const payable of overduePayables) {
      if (payable.status === PayableStatus.OVERDUE) {
        continue;
      }

      payable.status = PayableStatus.OVERDUE;
      updated.push(await this.payableRepository.save(payable));
    }

    return updated;
  }

  async markDueSoonNotified(id: string): Promise<void> {
    const payable = await this.payableRepository.findOne({
      where: { id },
      select: ['id', 'dueSoonNotifiedAt'],
    });
    if (!payable) {
      throw new NotFoundException('Payable not found');
    }

    payable.dueSoonNotifiedAt = new Date();
    await this.payableRepository.save(payable);
  }

  private buildFilteredQuery(workspaceId: string, filters: FilterPayablesDto) {
    const queryBuilder = this.payableRepository
      .createQueryBuilder('payable')
      .where('payable.workspaceId = :workspaceId', { workspaceId })
      .andWhere('payable.deletedAt IS NULL')
      .andWhere('payable.direction = :direction', {
        direction: filters.direction || PayableDirection.PAYABLE,
      });

    if (!filters.includeArchived) {
      queryBuilder.andWhere('payable.status != :archivedStatus', {
        archivedStatus: PayableStatus.ARCHIVED,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('payable.status = :status', { status: filters.status });
    }

    if (filters.source) {
      queryBuilder.andWhere('payable.source = :source', { source: filters.source });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        "(LOWER(payable.vendor) LIKE :search OR LOWER(COALESCE(payable.comment, '')) LIKE :search)",
        {
          search: `%${filters.search.toLowerCase()}%`,
        },
      );
    }

    if (filters.minAmount !== undefined) {
      queryBuilder.andWhere('payable.amount >= :minAmount', { minAmount: filters.minAmount });
    }

    if (filters.maxAmount !== undefined) {
      queryBuilder.andWhere('payable.amount <= :maxAmount', { maxAmount: filters.maxAmount });
    }

    const dueDateFrom = this.parseDate(filters.dueDateFrom);
    const dueDateTo = this.parseDate(filters.dueDateTo);
    if (dueDateFrom && dueDateTo) {
      queryBuilder.andWhere('payable.dueDate BETWEEN :dueDateFrom AND :dueDateTo', {
        dueDateFrom,
        dueDateTo,
      });
    } else if (dueDateFrom) {
      queryBuilder.andWhere('payable.dueDate >= :dueDateFrom', { dueDateFrom });
    } else if (dueDateTo) {
      queryBuilder.andWhere('payable.dueDate <= :dueDateTo', { dueDateTo });
    }

    return queryBuilder;
  }

  private normalizeUpdateDto(dto: UpdatePayableDto, current: Payable): Partial<Payable> {
    const nextStatus = dto.status ?? current.status;
    const willBePaid = nextStatus === PayableStatus.PAID;

    return {
      ...dto,
      dueDate: dto.dueDate !== undefined ? this.parseDate(dto.dueDate) : undefined,
      linkedTransactionId:
        dto.linkedTransactionId === undefined ? undefined : dto.linkedTransactionId,
      comment: dto.comment === undefined ? undefined : dto.comment,
      statementId: dto.statementId === undefined ? undefined : dto.statementId,
      paidAt: willBePaid ? current.paidAt || new Date() : null,
    };
  }

  private async assertLinkedEntitiesInWorkspace(
    workspaceId: string,
    linkedTransactionId?: string | null,
    statementId?: string | null,
  ): Promise<void> {
    if (linkedTransactionId !== undefined) {
      await this.assertLinkedTransactionInWorkspace(workspaceId, linkedTransactionId);
    }

    if (statementId !== undefined) {
      await this.assertStatementInWorkspace(workspaceId, statementId);
    }
  }

  private async assertLinkedTransactionInWorkspace(
    workspaceId: string,
    linkedTransactionId: string | null,
  ): Promise<void> {
    if (!linkedTransactionId) {
      return;
    }

    const transaction = await this.transactionRepository.findOne({
      where: { id: linkedTransactionId, workspaceId },
      select: ['id'],
    });

    if (!transaction) {
      throw new BadRequestException('Linked transaction not found in workspace');
    }
  }

  private async assertStatementInWorkspace(
    workspaceId: string,
    statementId: string | null,
  ): Promise<void> {
    if (!statementId) {
      return;
    }

    const statement = await this.statementRepository.findOne({
      where: { id: statementId, workspaceId },
      select: ['id'],
    });

    if (!statement) {
      throw new BadRequestException('Statement not found in workspace');
    }
  }

  private parseDate(value?: string | Date | null): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const normalized = value.length <= 10 ? `${value}T00:00:00.000Z` : value;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
  }

  private normalizeCurrency(currency: string | null | undefined): string {
    return currencyCodeOrDefault(currency);
  }

  private async convertSummaryAmount(
    amount: number,
    sourceCurrency: string | null | undefined,
    targetCurrency: string,
    rateCache: Map<string, number>,
    workspaceId: string,
  ): Promise<number> {
    if (!Number.isFinite(amount) || amount === 0) {
      return 0;
    }

    const source = this.normalizeCurrency(sourceCurrency);
    if (source === targetCurrency) {
      return amount;
    }

    const cacheKey = `${source}:${targetCurrency}`;
    let rate = rateCache.get(cacheKey);
    if (rate === undefined) {
      rate = await this.exchangeRatesService.getRate(
        source,
        targetCurrency,
        undefined,
        workspaceId,
      );
      rateCache.set(cacheKey, rate);
    }

    return amount * rate;
  }
}
