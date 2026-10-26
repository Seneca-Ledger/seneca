import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { countedSql } from '../../common/utils/counted-transactions.util';
import type { LinkContributionBody } from '../../contracts';
import { BalanceAccount } from '../../entities/balance-account.entity';
import {
  Transaction,
  TransactionType,
  TransferPairKind,
  TransferPairSource,
} from '../../entities/transaction.entity';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';

/**
 * How a transaction linked to an investment account moved money:
 * - `contribution`: an expense paid into the account (a one-leg transfer);
 * - `withdrawal`: income taken out of it (also a one-leg transfer);
 * - `income`: a dividend or interest it paid out — real income, so it is
 *   not paired and stays in every income figure.
 */
export type InvestmentFlowKind = 'contribution' | 'withdrawal' | 'income';

export interface InvestmentFlow {
  accountId: string;
  date: string;
  /** Always positive, in `currency`; the kind says which way it went. */
  amount: number;
  currency: string;
  kind: InvestmentFlowKind;
}

/** A flow with its amount in the workspace currency, at the rate of its own day. */
export interface ValuedInvestmentFlow extends InvestmentFlow {
  value: number;
}

/**
 * Money that moved between the user's cash and an investment account: the
 * links that say a row was a contribution, a withdrawal or a dividend, and the
 * dated flows the returns and the net-worth attribution are computed from.
 */
@Injectable()
export class InvestmentFlowsService {
  constructor(
    @InjectRepository(BalanceAccount)
    private readonly accountRepository: Repository<BalanceAccount>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  /**
   * Links a transaction to an investment account as what it is to it:
   * - an expense is a contribution, money moved in;
   * - an income row is either a withdrawal, money taken back out, or the
   *   dividend or interest the account paid.
   * Moving money is a one-leg transfer of kind `investment`, so it leaves
   * every spending and income aggregate. A dividend is earned money: it stays
   * unpaired and keeps counting as income, the link only says where from.
   */
  async linkContribution(
    workspaceId: string,
    transactionId: string,
    accountId: string,
    role?: NonNullable<LinkContributionBody['role']>,
  ): Promise<Transaction> {
    const account = await this.accountRepository.findOne({ where: { id: accountId, workspaceId } });
    if (!account?.accountKind) {
      throw new NotFoundException(appError('INVESTMENTS_ACCOUNT_NOT_FOUND'));
    }
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
    });
    if (!transaction) {
      throw new NotFoundException(appError('INVESTMENTS_TRANSACTION_NOT_FOUND'));
    }
    const isExpense = transaction.transactionType === TransactionType.EXPENSE;
    const resolved = role ?? (isExpense ? 'contribution' : null);
    if (isExpense && resolved !== 'contribution') {
      throw new BadRequestException(appError('INVESTMENTS_EXPENSE_ONLY_CONTRIBUTION'));
    }
    if (!isExpense && resolved === 'contribution') {
      throw new BadRequestException(appError('INVESTMENTS_CONTRIBUTION_NOT_EXPENSE'));
    }
    if (!isExpense && resolved === null) {
      throw new BadRequestException(appError('INVESTMENTS_INCOME_ROLE_REQUIRED'));
    }
    if (
      transaction.transferPairId &&
      transaction.transferPairKind !== TransferPairKind.INVESTMENT
    ) {
      throw new BadRequestException(appError('INVESTMENTS_ROW_ALREADY_TRANSFER'));
    }
    transaction.investmentAccountId = accountId;
    const moved = resolved !== 'income';
    transaction.transferPairId = moved ? transaction.id : null;
    transaction.transferPairSource = moved ? TransferPairSource.MANUAL : null;
    transaction.transferPairKind = moved ? TransferPairKind.INVESTMENT : null;
    return this.transactionRepository.save(transaction);
  }

  async unlinkContribution(workspaceId: string, transactionId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
    });
    if (!transaction) {
      throw new NotFoundException(appError('INVESTMENTS_TRANSACTION_NOT_FOUND'));
    }
    if (!transaction.investmentAccountId) {
      throw new BadRequestException(appError('INVESTMENTS_ROW_NOT_CONTRIBUTION'));
    }
    transaction.investmentAccountId = null;
    // A dividend was never paired; only an investment pair is this link's to undo.
    if (transaction.transferPairKind === TransferPairKind.INVESTMENT) {
      transaction.transferPairId = null;
      transaction.transferPairSource = null;
      transaction.transferPairKind = null;
    }
    return this.transactionRepository.save(transaction);
  }

  /**
   * What was paid into each investment account between two days, less what
   * was taken out, left in the currency it moved in: the caller decides which
   * day's rate to value it at, and for an attribution that is the first day
   * of the window. Dividends are not here: they never went into the account.
   */
  async contributionsBetween(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<Map<string, Map<string, number>>> {
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.investment_account_id', 'accountId')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(COALESCE(t.debit, 0) - COALESCE(t.credit, 0)), 0)', 'total')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.investment_account_id IS NOT NULL')
      .andWhere('t.transfer_pair_kind = :kind', { kind: TransferPairKind.INVESTMENT })
      .andWhere(countedSql('t'))
      .andWhere('t.transaction_date > :from', { from })
      .andWhere('t.transaction_date <= :to', { to })
      .groupBy('t.investment_account_id')
      .addGroupBy('t.currency')
      .getRawMany<{ accountId: string; currency: string; total: string }>();

    const byAccount = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const amount = Number.parseFloat(row.total);
      if (!Number.isFinite(amount) || amount === 0) {
        continue;
      }
      const perCurrency = byAccount.get(row.accountId) ?? new Map<string, number>();
      const code = String(row.currency || '')
        .trim()
        .toUpperCase();
      perCurrency.set(code, (perCurrency.get(code) ?? 0) + amount);
      byAccount.set(row.accountId, perCurrency);
    }
    return byAccount;
  }

  /**
   * Every counted transaction linked to these accounts, one row each, in the
   * currency and on the day it happened. The returns page needs the dates;
   * the account cards only need the totals, which `valueFlows` gives them.
   */
  async loadFlows(workspaceId: string, accountIds: string[]): Promise<InvestmentFlow[]> {
    if (accountIds.length === 0) {
      return [];
    }
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.investment_account_id', 'accountId')
      .addSelect('t.transaction_date', 'date')
      .addSelect('t.currency', 'currency')
      .addSelect('t.transaction_type', 'type')
      .addSelect('t.transfer_pair_kind', 'pairKind')
      .addSelect('COALESCE(t.debit, 0)', 'debit')
      .addSelect('COALESCE(t.credit, 0)', 'credit')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.investment_account_id IN (:...accountIds)', { accountIds })
      .andWhere(countedSql('t'))
      .orderBy('t.transaction_date', 'ASC')
      .getRawMany<{
        accountId: string;
        date: string | Date;
        currency: string;
        type: TransactionType;
        pairKind: TransferPairKind | null;
        debit: string;
        credit: string;
      }>();

    const flows: InvestmentFlow[] = [];
    for (const row of rows) {
      const kind = flowKind(row.type, row.pairKind);
      if (!kind) {
        continue;
      }
      const amount = Math.abs(
        Number.parseFloat(kind === 'contribution' ? row.debit : row.credit) || 0,
      );
      if (amount === 0) {
        continue;
      }
      flows.push({
        accountId: row.accountId,
        date: toDateOnly(row.date),
        amount,
        currency: normalizeCurrencyCode(row.currency) || 'USD',
        kind,
      });
    }
    return flows;
  }

  /**
   * Flows in the workspace currency, each at the rate of the day it happened:
   * money paid in three years ago cost what it cost then. A currency with no
   * rate is left out and named in `missing`, never read as 1:1.
   */
  async valueFlows(
    workspaceId: string,
    flows: InvestmentFlow[],
    currency: string,
  ): Promise<{ flows: ValuedInvestmentFlow[]; missing: string[] }> {
    if (flows.length === 0) {
      return { flows: [], missing: [] };
    }
    const dates = [...new Set(flows.map(flow => flow.date))].sort();
    const converter = await CurrencyConverter.loadRange(
      this.exchangeRatesService,
      currency,
      flows.map(flow => flow.currency),
      dates,
      workspaceId,
    );
    return {
      flows: flows.map(flow => ({
        ...flow,
        value: converter.convert(flow.amount, flow.currency, flow.date),
      })),
      missing: converter.missing,
    };
  }
}

function flowKind(
  type: TransactionType,
  pairKind: TransferPairKind | null,
): InvestmentFlowKind | null {
  if (pairKind === TransferPairKind.INVESTMENT) {
    return type === TransactionType.EXPENSE ? 'contribution' : 'withdrawal';
  }
  // Unpaired and linked: only income can be that — a dividend or interest.
  if (!pairKind && type === TransactionType.INCOME) {
    return 'income';
  }
  return null;
}

function toDateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
