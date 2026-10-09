import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import {
  CryptoWallet,
  type CryptoWalletBalance,
  CryptoWalletKind,
} from '../../entities/crypto-wallet.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import {
  CHAIN_NAMES,
  CHAINS,
  type ChainFamily,
  chainIdForAddress,
  familyForAddress,
  normalizeAddress,
  SUPPORTED_CHAIN_IDS,
} from './crypto.constants';
import { CryptoBalanceService } from './crypto-balance.service';
import type { CryptoHolding } from './crypto-holdings.service';
import { CryptoHoldingsService } from './crypto-holdings.service';
import { CryptoPriceService } from './crypto-price.service';
import type { WalletSyncResult } from './crypto-sync.service';
import { CryptoSyncService } from './crypto-sync.service';
import type { ConnectCryptoWalletDto } from './dto/connect-crypto-wallet.dto';
import type { ManualHoldingDto } from './dto/manual-holding.dto';

export interface CryptoWalletView {
  id: string;
  address: string | null;
  /** `onchain` is an address we read, `manual` is a line the user keeps. */
  kind: CryptoWalletKind;
  /**
   * The lines the user typed, for a manual wallet. An on-chain wallet's balances
   * are not repeated here: the holdings table already shows them, priced.
   */
  balances: CryptoWalletBalance[];
  chainId: number;
  chainName: string;
  label: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  transactionCount: number;
}

export interface CryptoSummary {
  currency: string;
  /** Current value of every holding, in the workspace currency. */
  portfolioValue: number;
  /** Booked value of incoming transfers over the window. */
  income: number;
  /** Booked value of outgoing transfers, including gas, over the window. */
  expense: number;
  walletCount: number;
  holdings: CryptoHolding[];
  /** Assets held that no price source knows, so the page can admit the gap. */
  unpriced: { asset: string; amount: string }[];
  /** What the portfolio cost, and what it has gained since — null when nothing is known. */
  cost: number | null;
  unrealized: number | null;
  /** Profit already taken, over the whole recorded history. */
  realized: number;
  /**
   * Percent change of the portfolio against yesterday's daily prices, holding
   * today's amounts fixed — the price move only. Null when yesterday's price is
   * missing for any holding, so a partial figure is never shown as the whole.
   */
  portfolioChangeSinceYesterday: number | null;
}

export interface CryptoTransactionView {
  id: string;
  date: string;
  walletId: string;
  walletLabel: string | null;
  walletAddress: string | null;
  walletChainName: string | null;
  direction: 'in' | 'out';
  asset: string | null;
  cryptoAmount: string | null;
  /** Booked value in `currency`. */
  amount: number;
  currency: string;
  counterparty: string | null;
  txHash: string | null;
}

function daysAgo(days: number): Date {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

/** `2026-08` → from `2026-08-01` up to, not including, `2026-09-01`. */
function monthWindow(month: string): { since: string; until: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const next =
    monthIndex === 12 ? `${year + 1}-01` : `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return { since: `${month}-01`, until: `${next}-01` };
}
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);

  constructor(
    @InjectRepository(CryptoWallet)
    private readonly walletRepo: Repository<CryptoWallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly syncService: CryptoSyncService,
    private readonly priceService: CryptoPriceService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly auditService: AuditService,
    private readonly holdingsService: CryptoHoldingsService,
    private readonly balanceService: CryptoBalanceService,
  ) {}

  async findAll(workspaceId: string): Promise<CryptoWalletView[]> {
    const wallets = await this.walletRepo.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });

    const counts = await this.transactionRepo
      .createQueryBuilder('t')
      .select('t.crypto_wallet_id', 'walletId')
      .addSelect('COUNT(*)', 'count')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.crypto_wallet_id IS NOT NULL')
      .groupBy('t.crypto_wallet_id')
      .getRawMany<{ walletId: string; count: string }>();

    const countByWallet = new Map(counts.map(row => [row.walletId, Number(row.count)]));

    return wallets.map(wallet => ({
      id: wallet.id,
      address: wallet.address,
      kind: wallet.kind,
      balances: wallet.kind === CryptoWalletKind.MANUAL ? (wallet.balances ?? []) : [],
      chainId: wallet.chainId,
      chainName:
        wallet.kind === CryptoWalletKind.MANUAL
          ? 'Manual'
          : (CHAIN_NAMES[wallet.chainId] ?? 'Blockchain'),
      label: wallet.label,
      lastSyncedAt: wallet.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: wallet.lastSyncError,
      transactionCount: countByWallet.get(wallet.id) ?? 0,
    }));
  }

  /**
   * Connects one address on one or more networks and returns the wallets created.
   * Networks where the address is already connected are skipped; only when every
   * requested network is taken is that a conflict.
   */
  async connect(
    workspaceId: string,
    userId: string,
    dto: ConnectCryptoWalletDto,
  ): Promise<CryptoWalletView[]> {
    const family = familyForAddress(dto.address);
    const defaultChainId = chainIdForAddress(dto.address);
    const chainIds = [...new Set(dto.chainIds ?? [dto.chainId ?? defaultChainId])];
    // An address of one family on another family's chain would sync nothing, or
    // another address's history if the formats ever collided.
    if (!family || chainIds.some(id => id === null || CHAINS[id]?.family !== family)) {
      throw new BadRequestException('The address does not belong to the selected network');
    }

    const created: CryptoWallet[] = [];
    for (const chainId of chainIds as number[]) {
      const address = normalizeAddress(dto.address, chainId);
      const existing = await this.walletRepo.findOne({ where: { workspaceId, chainId, address } });
      if (existing) {
        continue;
      }
      created.push(
        await this.walletRepo.save(
          this.walletRepo.create({
            workspaceId,
            address,
            chainId,
            label: dto.label ?? null,
            connectedByUserId: userId,
          }),
        ),
      );
    }
    if (created.length === 0) {
      throw new ConflictException('This address is already connected to the workspace');
    }

    await this.recordAudit(
      created.map(wallet => ({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.CRYPTO_WALLET,
        entityId: wallet.id,
        action: AuditAction.CREATE,
        diff: { before: null, after: walletAuditSnapshot(wallet) },
        meta: { chain: CHAIN_NAMES[wallet.chainId] ?? null, chainId: wallet.chainId },
      })),
    );

    // A freshly connected wallet with no history looks broken, so pull it now —
    // every chain at once, since each has its own provider. A sync failure must
    // not lose the connection the user just made.
    await Promise.all(
      created.map(wallet => this.syncService.syncWallet(wallet).catch(() => undefined)),
    );

    const createdIds = new Set(created.map(wallet => wallet.id));
    return (await this.findAll(workspaceId)).filter(view => createdIds.has(view.id));
  }

  /**
   * Adds or replaces one hand-kept holding. Every such line of a workspace lives
   * on a single wallet of kind `manual`: it is not an address, so there is nothing
   * to sync and nothing to tell two of them apart by.
   */
  async upsertManualHolding(
    workspaceId: string,
    userId: string,
    dto: ManualHoldingDto,
  ): Promise<CryptoWalletView> {
    const asset = dto.asset.trim().toUpperCase();
    if (Number(dto.amount) <= 0) {
      throw new BadRequestException('An amount is a positive number');
    }

    const wallet = await this.getOrCreateManualWallet(workspaceId, userId, dto.label);
    const balance: CryptoWalletBalance = {
      asset,
      amount: dto.amount,
      ...(dto.costPerUnit === undefined ? {} : { costPerUnit: dto.costPerUnit }),
    };
    const balances = [...(wallet.balances ?? []).filter(item => item.asset !== asset), balance];
    await this.walletRepo.update(wallet.id, {
      balances,
      ...(dto.label ? { label: dto.label } : {}),
    });

    await this.recordAudit([
      {
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.CRYPTO_WALLET,
        entityId: wallet.id,
        action: AuditAction.UPDATE,
        meta: { asset, amount: dto.amount, manual: true },
      },
    ]);
    await this.balanceService.writePortfolioSnapshot(workspaceId, userId);

    const view = (await this.findAll(workspaceId)).find(item => item.id === wallet.id);
    if (!view) {
      throw new NotFoundException('Crypto wallet not found');
    }
    return view;
  }

  /** Removes one hand-kept holding. The wallet stays, even with nothing on it. */
  async removeManualHolding(workspaceId: string, userId: string, asset: string): Promise<void> {
    const ticker = asset.trim().toUpperCase();
    const wallet = await this.walletRepo.findOne({
      where: { workspaceId, kind: CryptoWalletKind.MANUAL },
    });
    const balance = wallet?.balances?.find(item => item.asset === ticker);
    if (!(wallet && balance)) {
      throw new NotFoundException('Holding not found');
    }

    await this.walletRepo.update(wallet.id, {
      balances: wallet.balances.filter(item => item.asset !== ticker),
    });
    await this.recordAudit([
      {
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.CRYPTO_WALLET,
        entityId: wallet.id,
        action: AuditAction.DELETE,
        meta: { asset: ticker, manual: true },
      },
    ]);
    await this.balanceService.writePortfolioSnapshot(workspaceId, userId);
  }

  private async getOrCreateManualWallet(
    workspaceId: string,
    userId: string,
    label?: string,
  ): Promise<CryptoWallet> {
    const existing = await this.walletRepo.findOne({
      where: { workspaceId, kind: CryptoWalletKind.MANUAL },
    });
    if (existing) {
      return existing;
    }
    return this.walletRepo.save(
      this.walletRepo.create({
        workspaceId,
        address: null,
        kind: CryptoWalletKind.MANUAL,
        // Not a chain: a manual line is not on one, and nothing may sync it.
        chainId: 0,
        label: label ?? 'Manual holdings',
        balances: [],
        connectedByUserId: userId,
      }),
    );
  }

  /**
   * Realized gains over a period, sale by sale. A year is the usual question, so
   * the controller takes one and turns it into the range.
   */
  getGains(workspaceId: string, range: { from?: string; to?: string }) {
    return this.holdingsService.realizedGains(workspaceId, range);
  }

  /** The year's sales split by whose wallet they happened in; for a tax return. */
  getGainsByOwner(workspaceId: string, range: { from?: string; to?: string }) {
    return this.holdingsService.realizedGainsByOwner(workspaceId, range);
  }

  /** The portfolio's value day by day, as the balance sheet recorded it. */
  getHistory(
    workspaceId: string,
    days: number,
  ): Promise<{ currency: string; series: { date: string; value: number }[] }> {
    return this.balanceService.getHistory(workspaceId, days);
  }

  /** The networks a wallet can be connected on, for the connect form. */
  getNetworks(): { chainId: number; name: string; family: ChainFamily; nativeAsset: string }[] {
    return SUPPORTED_CHAIN_IDS.map(chainId => ({
      chainId,
      name: CHAINS[chainId].name,
      family: CHAINS[chainId].family,
      nativeAsset: CHAINS[chainId].nativeAsset,
    }));
  }

  async sync(workspaceId: string, walletId: string, userId: string): Promise<WalletSyncResult> {
    const wallet = await this.getOwnedWallet(workspaceId, walletId);
    if (wallet.kind === CryptoWalletKind.MANUAL) {
      throw new BadRequestException('A manual holding has no chain to sync');
    }
    const result = await this.syncService.syncWallet(wallet);
    // A sync that found nothing new changed nothing worth a log entry.
    if (result.imported > 0) {
      await this.recordAudit([
        {
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.CRYPTO_WALLET,
          entityId: wallet.id,
          action: AuditAction.IMPORT,
          meta: {
            count: result.imported,
            skipped: result.skipped,
            chain: CHAIN_NAMES[wallet.chainId] ?? null,
            address: shortenAddress(wallet.address),
          },
        },
      ]);
    }
    return result;
  }

  /** Removes the wallet; its transactions go with it via ON DELETE CASCADE. */
  async remove(workspaceId: string, walletId: string, userId: string): Promise<void> {
    const wallet = await this.getOwnedWallet(workspaceId, walletId);
    const transactionCount = await this.transactionRepo.count({
      where: { workspaceId, cryptoWalletId: wallet.id },
    });
    await this.walletRepo.delete(wallet.id);
    await this.recordAudit([
      {
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.CRYPTO_WALLET,
        entityId: wallet.id,
        action: AuditAction.DELETE,
        diff: { before: walletAuditSnapshot(wallet), after: null },
        meta: { chain: CHAIN_NAMES[wallet.chainId] ?? null, transactionCount },
      },
    ]);
  }

  // Several wallets from one connect share a batch; an audit failure never fails the call.
  private async recordAudit(events: CreateAuditEventDto[]): Promise<void> {
    try {
      if (events.length === 1) {
        await this.auditService.createEvent(events[0]);
      } else {
        await this.auditService.createBatchEvents(events, randomUUID());
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for crypto wallet(s): ${message}`);
    }
  }

  /**
   * `month` (`YYYY-MM`) swaps the rolling window for that calendar month, so the
   * dashboard can compare how much came in and went out month by month. The
   * portfolio value stays the current one either way.
   */
  async getSummary(workspaceId: string, days = 30, month?: string): Promise<CryptoSummary> {
    const currency = await this.getWorkspaceCurrency(workspaceId);
    const window = month ? monthWindow(month) : { since: daysAgo(days), until: null };

    const [walletCount, flows, portfolio] = await Promise.all([
      this.walletRepo.count({ where: { workspaceId } }),
      this.getFlows(workspaceId, window.since, window.until),
      this.holdingsService.getHoldings(workspaceId, currency),
    ]);
    const holdings = portfolio.holdings;

    return {
      currency,
      portfolioValue: round2(holdings.reduce((total, holding) => total + holding.value, 0)),
      income: flows.income,
      expense: flows.expense,
      walletCount,
      holdings,
      unpriced: portfolio.unpriced,
      ...totalGain(holdings),
      portfolioChangeSinceYesterday: await this.getPortfolioChangeSinceYesterday(
        holdings,
        currency,
        workspaceId,
      ),
    };
  }

  /** The most recent booked transfers across the workspace's wallets, newest first. */
  async getRecentTransactions(workspaceId: string, limit = 20): Promise<CryptoTransactionView[]> {
    const [transactions, wallets] = await Promise.all([
      this.transactionRepo
        .createQueryBuilder('t')
        .where('t.workspace_id = :workspaceId', { workspaceId })
        .andWhere('t.crypto_wallet_id IS NOT NULL')
        .orderBy('t.transaction_date', 'DESC')
        .addOrderBy('t.id', 'DESC')
        .take(limit)
        .getMany(),
      this.walletRepo.find({
        where: { workspaceId },
        select: ['id', 'label', 'address', 'chainId'],
      }),
    ]);
    const walletById = new Map(wallets.map(wallet => [wallet.id, wallet]));

    return transactions.map(transaction => {
      const wallet = walletById.get(transaction.cryptoWalletId as string);
      return {
        id: transaction.id,
        date: new Date(transaction.transactionDate).toISOString(),
        walletId: transaction.cryptoWalletId as string,
        walletLabel: wallet?.label ?? null,
        walletAddress: wallet?.address ?? null,
        walletChainName: wallet ? (CHAIN_NAMES[wallet.chainId] ?? null) : null,
        direction: transaction.transactionType === TransactionType.INCOME ? 'in' : 'out',
        asset: transaction.cryptoAsset,
        cryptoAmount: transaction.cryptoAmount,
        amount: Number(transaction.amount),
        currency: transaction.currency,
        counterparty: transaction.counterpartyAccount ?? transaction.counterpartyName ?? null,
        txHash: transaction.cryptoTxHash,
      };
    });
  }

  /**
   * Yesterday's daily price is fetched once and then read from the cache the sync
   * fills. It is converted at today's rate, the same rate the current values use,
   * so the ratio is the price move alone. A price that cannot be fetched right now
   * (rate limit) hides the figure instead of failing the whole summary.
   */
  private async getPortfolioChangeSinceYesterday(
    holdings: CryptoHolding[],
    currency: string,
    workspaceId: string,
  ): Promise<number | null> {
    if (holdings.length === 0) {
      return null;
    }
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usdToCurrency = await this.exchangeRatesService.getRate(
      'USD',
      currency,
      undefined,
      workspaceId,
    );

    let now = 0;
    let before = 0;
    for (const holding of holdings) {
      const pastUsd = await this.priceService.getUsdPrice(holding.asset, dayAgo).catch(() => null);
      if (pastUsd === null) {
        return null;
      }
      now += holding.value;
      before += Number(holding.amount) * pastUsd * usdToCurrency;
    }
    if (before === 0) {
      return null;
    }
    return Math.round(((now - before) / before) * 10000) / 100;
  }

  private async getFlows(
    workspaceId: string,
    since: Date | string,
    until: string | null,
  ): Promise<{ income: number; expense: number }> {
    const query = this.transactionRepo
      .createQueryBuilder('t')
      .select('t.transaction_type', 'type')
      .addSelect('SUM(t.amount)', 'total')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.crypto_wallet_id IS NOT NULL')
      // A swap and a purchase from a bank account are paired moves, not income and
      // not spending; only their fee legs stay, and those are unpaired.
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere('t.transaction_date >= :since', { since })
      .andWhere(countedSql('t'));
    if (until) {
      query.andWhere('t.transaction_date < :until', { until });
    }
    const rows = await query
      .groupBy('t.transaction_type')
      .getRawMany<{ type: TransactionType; total: string }>();

    const totalFor = (type: TransactionType): number =>
      round2(Number(rows.find(row => row.type === type)?.total ?? 0));

    return {
      income: totalFor(TransactionType.INCOME),
      expense: totalFor(TransactionType.EXPENSE),
    };
  }

  private async getOwnedWallet(workspaceId: string, walletId: string): Promise<CryptoWallet> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId, workspaceId } });
    if (!wallet) {
      throw new NotFoundException('Crypto wallet not found');
    }
    return wallet;
  }

  private getWorkspaceCurrency(workspaceId: string): Promise<string> {
    return this.holdingsService.getWorkspaceCurrency(workspaceId);
  }
}

/** Plain wallet fields for the audit diff, with the address shortened. */
function walletAuditSnapshot(wallet: CryptoWallet): Record<string, unknown> {
  return {
    address: shortenAddress(wallet.address),
    chainId: wallet.chainId,
    chainName: CHAIN_NAMES[wallet.chainId] ?? null,
    label: wallet.label ?? null,
  };
}

function shortenAddress(address: string | null): string {
  if (!address) {
    return '';
  }
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/**
 * The portfolio's cost and profit are the sum of the holdings that have a basis.
 * An asset whose purchases are unknown is left out of the cost rather than counted
 * at zero, which would read as pure profit.
 */
function totalGain(holdings: CryptoHolding[]): {
  cost: number | null;
  unrealized: number | null;
  realized: number;
} {
  const withBasis = holdings.filter(holding => holding.cost !== null);
  const realized = round2(holdings.reduce((sum, holding) => sum + holding.realized, 0));
  if (withBasis.length === 0) {
    return { cost: null, unrealized: null, realized };
  }
  return {
    cost: round2(withBasis.reduce((sum, holding) => sum + (holding.cost ?? 0), 0)),
    unrealized: round2(withBasis.reduce((sum, holding) => sum + (holding.unrealized ?? 0), 0)),
    realized,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
