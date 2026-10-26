import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceCrudBaseService } from '../../common/services/workspace-crud-base.service';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { assertOwnerMemberInWorkspace } from '../../common/utils/transaction-owner.util';
import type {
  CreateWalletBody,
  UpdateWalletBody,
  WalletItem,
  WalletReconciliation,
  WalletSeries,
  WalletSummary,
} from '../../contracts';
import { Statement, StatementStatus } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { DEBT_WALLET_TYPES, Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import {
  addAmount,
  type CurrencyAmounts,
  CurrencyConverter,
  normalizeCurrencyCode,
} from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';

/** Statements whose rows are read and real; the same set the balance sheet trusts. */
const LIVE_STATEMENT_STATUSES = [
  StatementStatus.PARSED,
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
];

/** A closing balance within a cent of the booked one is the same balance. */
const RECONCILE_TOLERANCE = 0.01;

const round2 = (value: number) => Math.round(value * 100) / 100;

const toDateOnly = (value: string | Date | null): string | null =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

type Totals = { net: number; count: number; pending: number; lastDate: string | null };

@Injectable()
export class WalletsService extends WorkspaceCrudBaseService<Wallet> {
  constructor(
    @InjectRepository(Wallet)
    repository: Repository<Wallet>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {
    super(repository, 'Wallet');
  }

  async create(workspaceId: string, userId: string, createDto: CreateWalletBody): Promise<Wallet> {
    await assertOwnerMemberInWorkspace(
      this.workspaceMemberRepository,
      workspaceId,
      createDto.ownerMemberId,
    );

    // wallets.user_id is NOT NULL: without it every create failed with a 500.
    const wallet = this.repository.create({
      workspaceId,
      userId,
      ...createDto,
      type: createDto.type ?? 'checking',
      currency: await this.workspaceCurrency.resolveFor(workspaceId, createDto.currency),
      initialBalance: createDto.initialBalance || 0,
      isActive: true,
    });

    return this.repository.save(wallet);
  }

  override async update(id: string, workspaceId: string, dto: UpdateWalletBody): Promise<Wallet> {
    await assertOwnerMemberInWorkspace(
      this.workspaceMemberRepository,
      workspaceId,
      dto.ownerMemberId,
    );
    return super.update(id, workspaceId, dto);
  }

  /** Every account of the workspace with its balance, for `GET /wallets`. */
  async list(workspaceId: string): Promise<WalletItem[]> {
    const wallets = await this.findAll(workspaceId);
    return this.withBalances(workspaceId, wallets);
  }

  async findOneWithBalance(id: string, workspaceId: string): Promise<WalletItem> {
    const wallet = await this.findOne(id, workspaceId);
    const [item] = await this.withBalances(workspaceId, [wallet]);
    return item;
  }

  /** Active accounts summed in the workspace currency, at today's rate. */
  async summary(workspaceId: string): Promise<WalletSummary> {
    const target = normalizeCurrencyCode(await this.workspaceCurrency.resolve(workspaceId));
    const active = (await this.list(workspaceId)).filter(wallet => wallet.isActive);

    const assets: CurrencyAmounts = new Map();
    const debts: CurrencyAmounts = new Map();
    for (const wallet of active) {
      const currency = normalizeCurrencyCode(wallet.currency);
      if (DEBT_WALLET_TYPES.includes(wallet.type)) {
        addAmount(debts, currency, -wallet.balance);
      } else {
        addAmount(assets, currency, wallet.balance);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const currencies = new Set([...assets.keys(), ...debts.keys()]);
    const converter = await CurrencyConverter.load(
      this.exchangeRates,
      target,
      [...currencies].map(currency => ({ currency, date: today })),
      workspaceId,
    );
    const assetsTotal = converter.convertAll(assets, today);
    const debtsTotal = converter.convertAll(debts, today);
    const unconverted = converter.missing.map(currency => ({
      currency,
      assets: round2(assets.get(currency) ?? 0),
      debts: round2(debts.get(currency) ?? 0),
    }));

    return {
      currency: target,
      assets: round2(assetsTotal),
      debts: round2(debtsTotal),
      unconverted,
    };
  }

  /** The balance at the end of each day the account moved, oldest first. */
  async series(id: string, workspaceId: string): Promise<WalletSeries> {
    const wallet = await this.findOne(id, workspaceId);
    const rows = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('transaction')
        .select('transaction.transactionDate', 'date')
        .addSelect(
          'COALESCE(SUM(transaction.credit), 0) - COALESCE(SUM(transaction.debit), 0)',
          'net',
        )
        .where('transaction.workspaceId = :workspaceId', { workspaceId })
        .andWhere('transaction.walletId = :walletId', { walletId: wallet.id }),
      'transaction',
    )
      .groupBy('transaction.transactionDate')
      .orderBy('transaction.transactionDate', 'ASC')
      .getRawMany<{ date: string | Date; net: string }>();

    let balance = Number(wallet.initialBalance) || 0;
    return rows.map(row => {
      balance += Number(row.net) || 0;
      return { date: toDateOnly(row.date) as string, balance: round2(balance) };
    });
  }

  private async withBalances(workspaceId: string, wallets: Wallet[]): Promise<WalletItem[]> {
    if (wallets.length === 0) {
      return [];
    }
    const walletIds = wallets.map(wallet => wallet.id);
    const [totals, reconciliations] = await Promise.all([
      this.totals(workspaceId, walletIds),
      this.reconciliations(workspaceId, wallets),
    ]);

    return wallets.map(wallet => {
      const total = totals.get(wallet.id);
      return {
        id: wallet.id,
        workspaceId: wallet.workspaceId,
        userId: wallet.userId,
        name: wallet.name,
        type: wallet.type,
        accountNumber: wallet.accountNumber,
        bankName: wallet.bankName,
        currency: wallet.currency,
        initialBalance: String(wallet.initialBalance ?? '0'),
        isActive: wallet.isActive,
        ownerMemberId: wallet.ownerMemberId,
        balance: round2((Number(wallet.initialBalance) || 0) + (total?.net ?? 0)),
        transactionCount: total?.count ?? 0,
        pendingReviewCount: total?.pending ?? 0,
        lastActivityAt: total?.lastDate ?? null,
        reconciliation: reconciliations.get(wallet.id) ?? null,
        createdAt: wallet.createdAt.toISOString(),
        updatedAt: wallet.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Counted movements per account, in one pass; rows still in Review are only
   * counted, so the page can say why a balance lags the bank.
   */
  private async totals(workspaceId: string, walletIds: string[]): Promise<Map<string, Totals>> {
    const [counted, pending] = await Promise.all([
      onlyCounted(
        this.transactionRepository
          .createQueryBuilder('transaction')
          .select('transaction.walletId', 'walletId')
          .addSelect(
            'COALESCE(SUM(transaction.credit), 0) - COALESCE(SUM(transaction.debit), 0)',
            'net',
          )
          .addSelect('COUNT(*)', 'count')
          .addSelect('MAX(transaction.transactionDate)', 'lastDate')
          .where('transaction.workspaceId = :workspaceId', { workspaceId })
          .andWhere('transaction.walletId IN (:...walletIds)', { walletIds }),
        'transaction',
      )
        .groupBy('transaction.walletId')
        .getRawMany<{ walletId: string; net: string; count: string; lastDate: string | null }>(),
      this.transactionRepository
        .createQueryBuilder('transaction')
        .select('transaction.walletId', 'walletId')
        .addSelect('COUNT(*)', 'count')
        .where('transaction.workspaceId = :workspaceId', { workspaceId })
        .andWhere('transaction.walletId IN (:...walletIds)', { walletIds })
        .andWhere('transaction.isVerified = false')
        .andWhere('transaction.isDuplicate = false')
        .groupBy('transaction.walletId')
        .getRawMany<{ walletId: string; count: string }>(),
    ]);

    const totals = new Map<string, Totals>();
    for (const row of counted) {
      totals.set(row.walletId, {
        net: Number(row.net) || 0,
        count: Number(row.count) || 0,
        pending: 0,
        lastDate: toDateOnly(row.lastDate),
      });
    }
    for (const row of pending) {
      const total = totals.get(row.walletId) ?? { net: 0, count: 0, pending: 0, lastDate: null };
      total.pending = Number(row.count) || 0;
      totals.set(row.walletId, total);
    }
    return totals;
  }

  /**
   * The latest statement of each account that states a closing balance,
   * against the balance booked up to its last day. One query per account that
   * has such a statement; a workspace has a handful of accounts.
   */
  private async reconciliations(
    workspaceId: string,
    wallets: Wallet[],
  ): Promise<Map<string, WalletReconciliation>> {
    const latest = await this.statementRepository
      .createQueryBuilder('statement')
      .distinctOn(['statement.walletId'])
      .select(['statement.id', 'statement.walletId', 'statement.balanceEnd'])
      .addSelect('statement.statementDateTo')
      .where('statement.workspaceId = :workspaceId', { workspaceId })
      .andWhere('statement.walletId IN (:...walletIds)', {
        walletIds: wallets.map(wallet => wallet.id),
      })
      .andWhere('statement.deletedAt IS NULL')
      .andWhere('statement.balanceEnd IS NOT NULL')
      .andWhere('statement.statementDateTo IS NOT NULL')
      .andWhere('statement.status IN (:...statuses)', { statuses: LIVE_STATEMENT_STATUSES })
      .orderBy('statement.walletId')
      .addOrderBy('statement.statementDateTo', 'DESC')
      .addOrderBy('statement.createdAt', 'DESC')
      .getMany();

    const byId = new Map(wallets.map(wallet => [wallet.id, wallet]));
    const result = new Map<string, WalletReconciliation>();
    for (const statement of latest) {
      const wallet = statement.walletId ? byId.get(statement.walletId) : undefined;
      const date = toDateOnly(statement.statementDateTo);
      if (!(wallet && date)) {
        continue;
      }
      const booked = await onlyCounted(
        this.transactionRepository
          .createQueryBuilder('transaction')
          .select(
            'COALESCE(SUM(transaction.credit), 0) - COALESCE(SUM(transaction.debit), 0)',
            'net',
          )
          .where('transaction.workspaceId = :workspaceId', { workspaceId })
          .andWhere('transaction.walletId = :walletId', { walletId: wallet.id })
          .andWhere('transaction.transactionDate <= :date', { date }),
        'transaction',
      ).getRawOne<{ net: string }>();

      const computedBalance = round2(
        (Number(wallet.initialBalance) || 0) + Number(booked?.net ?? 0),
      );
      const statementBalance = round2(Number(statement.balanceEnd));
      result.set(wallet.id, {
        statementId: statement.id,
        date,
        statementBalance,
        computedBalance,
        matches: Math.abs(computedBalance - statementBalance) <= RECONCILE_TOLERANCE,
      });
    }
    return result;
  }
}
