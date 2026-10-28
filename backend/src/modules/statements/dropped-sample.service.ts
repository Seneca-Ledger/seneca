import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { assertWorkspaceRefs } from '../../common/utils/workspace-refs.util';
import type { ConvertDroppedSampleBody } from '../../contracts';
import { Wallet, WorkspaceMember } from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { Statement } from '../../entities/statement.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { transactionCreatedEvent } from '../notifications/events/notification-events';

import { ensureCanModifyStatement } from './statement-access';
import { walletOwnerMemberId } from './statement-accounts';

function normalizePositiveAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * A row the parser dropped (a warning with its sample) booked after all, as
 * the person corrected it: one transaction on the statement, on the account
 * the statement belongs to.
 */
@Injectable()
export class DroppedSampleService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly auditService: AuditService,
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  async convert(
    statement: Statement,
    userId: string,
    workspaceId: string,
    payload: ConvertDroppedSampleBody,
  ): Promise<{ statement: Statement; transaction: Transaction }> {
    await ensureCanModifyStatement(this.workspaceMemberRepository, statement, userId, workspaceId);

    const warnings = statement.parsingDetails?.warnings || [];
    const droppedSamples = statement.parsingDetails?.droppedSamples || [];
    const warning = payload.warning || warnings[payload.index] || null;
    const warningTxKey = warning?.match(/tx#\d+/i)?.[0]?.toLowerCase() || null;
    const sampleIndex = droppedSamples.findIndex(sample => {
      const sampleTxKey = sample.reason.match(/tx#\d+/i)?.[0]?.toLowerCase() || null;
      return sample.reason === warning || Boolean(warningTxKey && sampleTxKey === warningTxKey);
    });
    const sample = sampleIndex >= 0 ? droppedSamples[sampleIndex] : null;

    if (!(sample || warning)) {
      throw new NotFoundException(appError('STATEMENT_SAMPLE_NOT_FOUND'));
    }

    const transactionDate = new Date(payload.transaction.transactionDate);
    if (Number.isNaN(transactionDate.getTime())) {
      throw new BadRequestException(appError('STATEMENT_TRANSACTION_DATE_INVALID'));
    }

    const debit = normalizePositiveAmount(payload.transaction.debit);
    const credit = normalizePositiveAmount(payload.transaction.credit);

    if (!(debit || credit)) {
      throw new BadRequestException(appError('STATEMENT_AMOUNT_REQUIRED'));
    }

    const transactionType = debit ? TransactionType.EXPENSE : TransactionType.INCOME;
    const amount = debit || credit || 0;
    const originalTransaction = sample?.transaction as
      | Record<string, string | number | null | undefined>
      | undefined;

    const walletId =
      payload.transaction.walletId || (originalTransaction?.walletId as string) || null;
    const categoryId =
      payload.transaction.categoryId || (originalTransaction?.categoryId as string) || null;
    const branchId =
      payload.transaction.branchId || (originalTransaction?.branchId as string) || null;
    await assertWorkspaceRefs(this.transactionRepository.manager, workspaceId, {
      categoryId,
      branchId,
      walletId,
    });

    const transaction = this.transactionRepository.create({
      workspaceId,
      statementId: statement.id,
      transactionDate: new Date(transactionDate.toISOString().slice(0, 10)),
      documentNumber:
        payload.transaction.documentNumber ||
        (originalTransaction?.documentNumber as string) ||
        null,
      counterpartyName:
        payload.transaction.counterpartyName?.trim() ||
        String(originalTransaction?.counterpartyName || '').trim() ||
        'Неизвестный контрагент',
      counterpartyBin:
        payload.transaction.counterpartyBin ||
        (originalTransaction?.counterpartyBin as string) ||
        null,
      counterpartyAccount:
        payload.transaction.counterpartyAccount ||
        (originalTransaction?.counterpartyAccount as string) ||
        null,
      counterpartyBank:
        payload.transaction.counterpartyBank ||
        (originalTransaction?.counterpartyBank as string) ||
        null,
      debit: debit ?? null,
      credit: credit ?? null,
      amount,
      currency: currencyCodeOrDefault(
        payload.transaction.currency || String(originalTransaction?.currency || ''),
        statement.currency,
      ),
      paymentPurpose:
        payload.transaction.paymentPurpose?.trim() ||
        String(originalTransaction?.paymentPurpose || '').trim() ||
        'Не указано',
      categoryId,
      categorySource: payload.transaction.categoryId ? TransactionCategorySource.MANUAL : null,
      branchId,
      walletId,
      // Same rule as the import path: the row starts on whoever owns the wallet.
      ownerMemberId: walletId
        ? await walletOwnerMemberId(this.walletRepository, walletId, workspaceId)
        : null,
      article: payload.transaction.article || (originalTransaction?.article as string) || null,
      comments: payload.transaction.comments || (originalTransaction?.comments as string) || null,
      transactionType,
      isVerified: true,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    const nextDroppedSamples =
      sampleIndex >= 0
        ? droppedSamples.filter((_, index) => index !== sampleIndex)
        : droppedSamples;
    const warningToRemove = warning || sample?.reason || null;
    const nextWarnings = warnings.filter(currentWarning => currentWarning !== warningToRemove);

    statement.totalTransactions = Number(statement.totalTransactions || 0) + 1;
    statement.totalDebit = Number(statement.totalDebit || 0) + (debit || 0);
    statement.totalCredit = Number(statement.totalCredit || 0) + (credit || 0);
    statement.parsingDetails = {
      ...(statement.parsingDetails || {}),
      warnings: nextWarnings,
      droppedSamples: nextDroppedSamples,
      transactionsCreated: Number(statement.parsingDetails?.transactionsCreated || 0) + 1,
    };

    const savedStatement = await this.statementRepository.save(statement);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      actorLabel: (await this.userRepository.findOne({ where: { id: userId } }))?.email || 'User',
      entityType: EntityType.TRANSACTION,
      entityId: savedTransaction.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: savedTransaction },
      meta: {
        source: 'statement-dropped-sample-conversion',
        statementId: statement.id,
        droppedSampleIndex: payload.index,
      },
      severity: Severity.INFO,
      isUndoable: false,
    });
    this.eventEmitter?.emit(
      'transaction.created',
      transactionCreatedEvent(savedTransaction, 'dropped_sample'),
    );

    return {
      statement: savedStatement,
      transaction: savedTransaction,
    };
  }
}
