import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { absAmount, daysBetween } from './transfer-pairing.matcher';
import { CANDIDATE_WINDOW_DAYS, DAY_MS, TransferPairingService } from './transfer-pairing.service';

/** A row moved to (or from) another of the user's own accounts, from the transaction drawer. */
@Injectable()
export class TransferToAccountService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly pairing: TransferPairingService,
  ) {}

  /**
   * Marks a row as money moved to (or from) another of the user's accounts.
   * The other leg already in that account (same amount and currency, opposite
   * direction, within a week) is linked; when there is none, as for cash out
   * of an ATM into the Cash account, it is booked there, confirmed, and linked.
   */
  async transferToAccount(
    workspaceId: string,
    transactionId: string,
    walletId: string,
  ): Promise<{ transferPairId: string; createdId: string | null }> {
    const row = await this.pairing.findOwned(workspaceId, transactionId);
    const wallet = await this.transactionRepository.manager
      .getRepository(Wallet)
      .findOne({ where: { id: walletId, workspaceId } });
    if (!wallet) {
      throw new NotFoundException(appError('WALLET_NOT_FOUND'));
    }
    if (row.walletId === wallet.id) {
      throw new BadRequestException(appError('TRANSFER_SAME_ACCOUNT'));
    }

    const opposite =
      row.transactionType === TransactionType.EXPENSE
        ? TransactionType.INCOME
        : TransactionType.EXPENSE;
    const at = new Date(row.transactionDate).getTime();
    const amount = absAmount(row);
    const existing = (
      await this.pairing
        .unpairedQuery(workspaceId)
        .andWhere('t.walletId = :walletId', { walletId: wallet.id })
        .andWhere('t.transactionType = :opposite', { opposite })
        .andWhere('UPPER(t.currency) = UPPER(:currency)', { currency: row.currency })
        .andWhere('t.transactionDate BETWEEN :since AND :until', {
          since: new Date(at - CANDIDATE_WINDOW_DAYS * DAY_MS),
          until: new Date(at + CANDIDATE_WINDOW_DAYS * DAY_MS),
        })
        .getMany()
    )
      .filter(candidate => Math.abs(absAmount(candidate) - amount) < 0.005)
      .sort(
        (a, b) =>
          daysBetween(a.transactionDate, row.transactionDate) -
          daysBetween(b.transactionDate, row.transactionDate),
      )[0];
    if (existing) {
      return {
        transferPairId: await this.pairing.link(workspaceId, row.id, existing.id),
        createdId: null,
      };
    }

    const mirror = await this.transactionRepository.save(
      this.transactionRepository.create({
        workspaceId,
        walletId: wallet.id,
        ownerMemberId: wallet.ownerMemberId,
        transactionDate: row.transactionDate,
        transactionType: opposite,
        amount,
        debit: opposite === TransactionType.EXPENSE ? amount : null,
        credit: opposite === TransactionType.INCOME ? amount : null,
        currency: row.currency,
        counterpartyName: row.counterpartyName,
        paymentPurpose: row.paymentPurpose,
        isVerified: true,
      }),
    );
    return {
      transferPairId: await this.pairing.link(workspaceId, row.id, mirror.id),
      createdId: mirror.id,
    };
  }
}
