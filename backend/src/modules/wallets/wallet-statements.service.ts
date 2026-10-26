import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { AccountStatement } from '../../contracts';
import { Statement, StatementStatus } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { pickWalletForAccount, realAccountNumber } from './wallet-account-match';
import { WalletsService } from './wallets.service';

/** Statements whose rows are read and real; the same set the balance sheet trusts. */
const LIVE_STATEMENT_STATUSES = [
  StatementStatus.PARSED,
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
];

const toDateOnly = (value: string | Date | null): string | null =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

function toAccountStatement(statement: Statement, walletId: string | null): AccountStatement {
  return {
    id: statement.id,
    fileName: statement.fileName,
    bankName: statement.bankName,
    accountNumber: realAccountNumber(statement.accountNumber),
    currency: normalizeCurrencyCode(statement.currency),
    dateFrom: toDateOnly(statement.statementDateFrom),
    dateTo: toDateOnly(statement.statementDateTo),
    balanceStart: statement.balanceStart === null ? null : Number(statement.balanceStart),
    balanceEnd: statement.balanceEnd === null ? null : Number(statement.balanceEnd),
    transactionCount: statement.totalTransactions ?? 0,
    suggestedWalletId: walletId,
  };
}

/** The statements an account holds, and moving statements into or out of it. */
@Injectable()
export class WalletStatementsService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly wallets: WalletsService,
  ) {}

  /**
   * Bank statements no account holds yet, each with the account it most likely
   * belongs to. Receipts and manual entries are statements too, but not of a
   * bank account, so they are not offered.
   */
  async unlinked(workspaceId: string): Promise<AccountStatement[]> {
    const [statements, wallets] = await Promise.all([
      this.statementRepository
        .createQueryBuilder('statement')
        .where('statement.workspaceId = :workspaceId', { workspaceId })
        .andWhere('statement.walletId IS NULL')
        .andWhere('statement.deletedAt IS NULL')
        .andWhere('statement.status IN (:...statuses)', { statuses: LIVE_STATEMENT_STATUSES })
        .andWhere("statement.fileType <> 'image'")
        .andWhere("statement.fileName NOT LIKE 'manual-expense-%'")
        .andWhere(
          "((statement.accountNumber IS NOT NULL AND statement.accountNumber <> 'Unknown') OR statement.balanceEnd IS NOT NULL OR statement.totalTransactions > 1)",
        )
        .orderBy('statement.statementDateTo', 'DESC', 'NULLS LAST')
        .addOrderBy('statement.createdAt', 'DESC')
        .getMany(),
      this.statementRepository.manager.getRepository(Wallet).find({ where: { workspaceId } }),
    ]);

    return statements.map(statement =>
      toAccountStatement(
        statement,
        pickWalletForAccount(wallets, statement.accountNumber, statement.currency)?.id ?? null,
      ),
    );
  }

  /** The statements an account holds, latest first. */
  async of(id: string, workspaceId: string): Promise<AccountStatement[]> {
    const wallet = await this.wallets.findOne(id, workspaceId);
    const statements = await this.statementRepository
      .createQueryBuilder('statement')
      .where('statement.workspaceId = :workspaceId', { workspaceId })
      .andWhere('statement.walletId = :walletId', { walletId: wallet.id })
      .andWhere('statement.deletedAt IS NULL')
      .orderBy('statement.statementDateTo', 'DESC', 'NULLS LAST')
      .addOrderBy('statement.createdAt', 'DESC')
      .getMany();
    return statements.map(statement => toAccountStatement(statement, wallet.id));
  }

  /**
   * Moves statements, with all their rows, into the account. A row with no
   * owner yet takes the account's; one somebody already assigned keeps it.
   */
  async attach(
    id: string,
    workspaceId: string,
    statementIds: readonly string[],
  ): Promise<{ attached: number }> {
    const wallet = await this.wallets.findOne(id, workspaceId);
    const ids = [...new Set(statementIds)];
    const statements = await this.statementRepository.find({
      where: { id: In(ids), workspaceId, deletedAt: IsNull() },
      select: { id: true, currency: true },
    });
    if (statements.length !== ids.length) {
      throw new NotFoundException(appError('WALLET_STATEMENT_NOT_FOUND'));
    }
    const walletCurrency = normalizeCurrencyCode(wallet.currency);
    const foreign = statements.find(
      statement => normalizeCurrencyCode(statement.currency) !== walletCurrency,
    );
    if (foreign) {
      throw new BadRequestException(
        appError('WALLET_STATEMENT_CURRENCY_MISMATCH', {
          walletCurrency,
          currency: normalizeCurrencyCode(foreign.currency),
        }),
      );
    }

    await this.statementRepository.manager.transaction(async manager => {
      await manager.update(Statement, { id: In(ids), workspaceId }, { walletId: wallet.id });
      await manager.update(
        Transaction,
        { statementId: In(ids), workspaceId },
        { walletId: wallet.id },
      );
      if (wallet.ownerMemberId) {
        await manager.update(
          Transaction,
          { statementId: In(ids), workspaceId, ownerMemberId: IsNull() },
          { ownerMemberId: wallet.ownerMemberId },
        );
      }
    });
    return { attached: ids.length };
  }

  /** Takes a statement and its rows back out of the account. */
  async detach(id: string, workspaceId: string, statementId: string): Promise<void> {
    const wallet = await this.wallets.findOne(id, workspaceId);
    const statement = await this.statementRepository.findOne({
      where: { id: statementId, workspaceId, walletId: wallet.id },
      select: { id: true },
    });
    if (!statement) {
      throw new NotFoundException(appError('WALLET_STATEMENT_NOT_FOUND'));
    }
    await this.statementRepository.manager.transaction(async manager => {
      await manager.update(Statement, { id: statement.id, workspaceId }, { walletId: null });
      await manager.update(
        Transaction,
        { statementId: statement.id, workspaceId, walletId: wallet.id },
        { walletId: null },
      );
    });
  }
}
