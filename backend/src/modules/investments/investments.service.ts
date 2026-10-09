import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { BalanceAccount, BalanceAccountKind } from '../../entities/balance-account.entity';
import {
  InvestmentAssetClass,
  InvestmentHolding,
  InvestmentPriceSource,
} from '../../entities/investment-holding.entity';
import {
  Transaction,
  TransactionType,
  TransferPairKind,
  TransferPairSource,
} from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { BalanceService } from '../balance/balance.service';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import type { CreateInvestmentAccountDto } from './dto/create-investment-account.dto';
import type { UpsertHoldingDto } from './dto/upsert-holding.dto';
import { pricedUnits } from './metal-weight.util';
import { normalizeStockSymbol, StockPriceService } from './stock-price.service';

const INVESTMENTS_SECTION_CODE = 'ASSET_INVESTMENTS';

export interface HoldingView {
  id: string;
  symbol: string | null;
  name: string;
  assetClass: InvestmentAssetClass;
  quantity: number;
  price: number;
  priceCurrency: string;
  priceSource: InvestmentPriceSource;
  pricedAt: Date | null;
  /** quantity × price in the workspace currency. */
  value: number;
}

export interface InvestmentAccountView {
  id: string;
  name: string;
  kind: BalanceAccountKind;
  currency: string;
  value: number;
  /** Sum of the expenses linked to this account as contributions. */
  contributed: number;
  /** Money taken back out of the account to the user's own cash. */
  withdrawn: number;
  /** Dividends and interest the account paid out. */
  income: number;
  /** Contributed less withdrawn: what the user still has in it. */
  netInvested: number;
  /** Value less net invested, plus what it paid out. */
  gain: number;
  holdings: HoldingView[];
}

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
 * Investment and retirement accounts: sub-accounts of the balance sheet's
 * "Investments" section with holdings behind them. Every change writes the
 * account's value as today's balance snapshot, so the sheet and net worth
 * read the same number this service computed.
 */
@Injectable()
export class InvestmentsService {
  constructor(
    @InjectRepository(BalanceAccount)
    private readonly accountRepository: Repository<BalanceAccount>,
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly balanceService: BalanceService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly stockPriceService: StockPriceService,
  ) {}

  async listAccounts(workspaceId: string): Promise<InvestmentAccountView[]> {
    await this.balanceService.seedDefaultAccounts(workspaceId);
    const currency = await this.workspaceCurrency(workspaceId);
    const accounts = await this.accountRepository.find({
      where: {
        workspaceId,
        accountKind: In([BalanceAccountKind.INVESTMENT, BalanceAccountKind.RETIREMENT]),
      },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    if (accounts.length === 0) return [];
    const holdings = await this.holdingRepository.find({
      where: { workspaceId, accountId: In(accounts.map(account => account.id)) },
      order: { createdAt: 'ASC' },
    });
    const { flows } = await this.valueFlows(
      workspaceId,
      await this.loadFlows(
        workspaceId,
        accounts.map(account => account.id),
      ),
      currency,
    );
    const views: InvestmentAccountView[] = [];
    for (const account of accounts) {
      const rows: HoldingView[] = [];
      for (const holding of holdings.filter(item => item.accountId === account.id)) {
        rows.push(await this.holdingView(holding, currency));
      }
      const value = round2(rows.reduce((sum, row) => sum + row.value, 0));
      const totals = { contribution: 0, withdrawal: 0, income: 0 };
      for (const flow of flows) {
        if (flow.accountId === account.id) totals[flow.kind] += flow.value;
      }
      const netInvested = totals.contribution - totals.withdrawal;
      views.push({
        id: account.id,
        name: account.name,
        kind: account.accountKind as BalanceAccountKind,
        currency,
        value,
        contributed: round2(totals.contribution),
        withdrawn: round2(totals.withdrawal),
        income: round2(totals.income),
        netInvested: round2(netInvested),
        gain: round2(value - netInvested + totals.income),
        holdings: rows,
      });
    }
    return views;
  }

  async createAccount(
    userId: string,
    workspaceId: string,
    dto: CreateInvestmentAccountDto,
  ): Promise<InvestmentAccountView> {
    await this.balanceService.seedDefaultAccounts(workspaceId);
    const section = await this.accountRepository.findOne({
      where: { workspaceId, code: INVESTMENTS_SECTION_CODE },
    });
    if (!section) throw new NotFoundException('Investments section not found');
    const created = await this.balanceService.createCustomAccount(userId, workspaceId, {
      name: dto.name,
      parentId: section.id,
    });
    await this.accountRepository.update(
      { id: created.id, workspaceId },
      { accountKind: dto.kind ?? BalanceAccountKind.INVESTMENT },
    );
    const view = (await this.listAccounts(workspaceId)).find(account => account.id === created.id);
    if (!view) throw new NotFoundException('Investment account not found');
    return view;
  }

  async deleteAccount(userId: string, workspaceId: string, accountId: string): Promise<void> {
    await this.requireAccount(workspaceId, accountId);
    await this.holdingRepository.delete({ workspaceId, accountId });
    await this.transactionRepository.update(
      { workspaceId, investmentAccountId: accountId },
      {
        investmentAccountId: null,
        transferPairId: null,
        transferPairSource: null,
        transferPairKind: null,
      },
    );
    await this.balanceService.deleteCustomAccount(userId, workspaceId, accountId);
  }

  async addHolding(
    userId: string,
    workspaceId: string,
    accountId: string,
    dto: UpsertHoldingDto,
  ): Promise<HoldingView> {
    await this.requireAccount(workspaceId, accountId);
    if (!(dto.name || dto.symbol)) {
      throw new BadRequestException('A holding needs a name or a symbol');
    }
    const symbol = dto.symbol ? this.normalizeSymbol(dto.symbol) : null;
    const holding = this.holdingRepository.create({
      workspaceId,
      accountId,
      symbol,
      name: dto.name ?? symbol ?? '',
      assetClass: dto.assetClass ?? InvestmentAssetClass.OTHER,
      quantity: dto.quantity ?? 0,
      price: dto.price ?? 0,
      priceCurrency: (dto.priceCurrency ?? 'USD').toUpperCase(),
      priceSource: InvestmentPriceSource.MANUAL,
      pricedAt: dto.price !== undefined ? new Date() : null,
    });
    const saved = await this.holdingRepository.save(holding);
    if (saved.symbol && dto.price === undefined) {
      await this.refreshPrices(userId, workspaceId, [saved.id]);
    }
    await this.writeSnapshot(userId, workspaceId, accountId);
    return this.holdingView(
      await this.requireHolding(workspaceId, saved.id),
      await this.workspaceCurrency(workspaceId),
    );
  }

  async updateHolding(
    userId: string,
    workspaceId: string,
    holdingId: string,
    dto: UpsertHoldingDto,
  ): Promise<HoldingView> {
    const holding = await this.requireHolding(workspaceId, holdingId);
    if (dto.symbol !== undefined) {
      holding.symbol = dto.symbol ? this.normalizeSymbol(dto.symbol) : null;
    }
    if (dto.name !== undefined) holding.name = dto.name;
    if (dto.assetClass !== undefined) holding.assetClass = dto.assetClass;
    if (dto.quantity !== undefined) holding.quantity = dto.quantity;
    if (dto.price !== undefined) {
      holding.price = dto.price;
      holding.priceSource = InvestmentPriceSource.MANUAL;
      holding.pricedAt = new Date();
    }
    if (dto.priceCurrency !== undefined) holding.priceCurrency = dto.priceCurrency.toUpperCase();
    await this.holdingRepository.save(holding);
    await this.writeSnapshot(userId, workspaceId, holding.accountId);
    return this.holdingView(holding, await this.workspaceCurrency(workspaceId));
  }

  async deleteHolding(userId: string, workspaceId: string, holdingId: string): Promise<void> {
    const holding = await this.requireHolding(workspaceId, holdingId);
    await this.holdingRepository.remove(holding);
    await this.writeSnapshot(userId, workspaceId, holding.accountId);
  }

  /** Workspaces holding something that has a price to fetch. */
  async workspacesWithPricedHoldings(): Promise<string[]> {
    const rows = await this.holdingRepository
      .createQueryBuilder('holding')
      .select('DISTINCT holding.workspaceId', 'workspaceId')
      .where('holding.symbol IS NOT NULL')
      .getRawMany<{ workspaceId: string }>();
    return rows.map(row => row.workspaceId);
  }

  /**
   * Fetches a price for every holding with a symbol (stocks and funds from
   * Stooq) and rewrites the snapshots of the accounts that changed. Returns how
   * many holdings got a price. Coins are not here: they live in `crypto_wallets`.
   */
  async refreshPrices(
    userId: string | null,
    workspaceId: string,
    onlyIds?: string[],
  ): Promise<number> {
    const holdings = await this.holdingRepository.find({
      where: onlyIds ? { workspaceId, id: In(onlyIds) } : { workspaceId },
    });
    const priced = holdings.filter(holding => holding.symbol);
    if (priced.length === 0) return 0;

    const stocks = await this.stockPriceService.getPrices(
      priced.map(holding => holding.symbol as string),
    );

    let updated = 0;
    const touched = new Set<string>();
    for (const holding of priced) {
      const quote = stocks.get(normalizeStockSymbol(holding.symbol as string));
      if (!quote) continue;
      holding.price = quote.price;
      holding.priceCurrency = quote.currency;
      holding.priceSource = InvestmentPriceSource.AUTO;
      holding.pricedAt = new Date();
      await this.holdingRepository.save(holding);
      touched.add(holding.accountId);
      updated += 1;
    }
    for (const accountId of touched) {
      await this.writeSnapshot(userId, workspaceId, accountId);
    }
    return updated;
  }

  /**
   * Marks an expense as money moved into an investment account. The row
   * becomes a one-leg transfer of kind `investment`: it leaves every spending
   * aggregate, and the account's holdings carry the money from here on.
   */
  async linkContribution(
    workspaceId: string,
    transactionId: string,
    accountId: string,
  ): Promise<Transaction> {
    await this.requireAccount(workspaceId, accountId);
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.transactionType !== TransactionType.EXPENSE) {
      throw new BadRequestException('Only an expense can be a contribution');
    }
    if (
      transaction.transferPairId &&
      transaction.transferPairKind !== TransferPairKind.INVESTMENT
    ) {
      throw new BadRequestException('This row is already linked as a transfer');
    }
    transaction.investmentAccountId = accountId;
    transaction.transferPairId = transaction.id;
    transaction.transferPairSource = TransferPairSource.MANUAL;
    transaction.transferPairKind = TransferPairKind.INVESTMENT;
    return this.transactionRepository.save(transaction);
  }

  async unlinkContribution(workspaceId: string, transactionId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.transferPairKind !== TransferPairKind.INVESTMENT) {
      throw new BadRequestException('This row is not a contribution');
    }
    transaction.investmentAccountId = null;
    transaction.transferPairId = null;
    transaction.transferPairSource = null;
    transaction.transferPairKind = null;
    return this.transactionRepository.save(transaction);
  }

  /** Holdings grouped by asset class, valued in the workspace currency; for net worth. */
  async valueByAssetClass(
    workspaceId: string,
    excludedAccountIds: Set<string> = new Set(),
  ): Promise<Map<InvestmentAssetClass, number>> {
    const currency = await this.workspaceCurrency(workspaceId);
    const holdings = await this.holdingRepository.find({ where: { workspaceId } });
    const totals = new Map<InvestmentAssetClass, number>();
    for (const holding of holdings) {
      // An account the page is not showing takes its holdings with it.
      if (excludedAccountIds.has(holding.accountId)) {
        continue;
      }
      const view = await this.holdingView(holding, currency);
      totals.set(holding.assetClass, (totals.get(holding.assetClass) ?? 0) + view.value);
    }
    return totals;
  }

  private normalizeSymbol(symbol: string): string {
    return normalizeStockSymbol(symbol);
  }

  private async holdingView(holding: InvestmentHolding, currency: string): Promise<HoldingView> {
    const quantity = Number(holding.quantity);
    const price = Number(holding.price);
    // A metal lot is priced per fine troy ounce, not per piece.
    const value = await this.convert(
      pricedUnits(holding) * price,
      holding.priceCurrency,
      currency,
      holding.workspaceId,
    );
    return {
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      assetClass: holding.assetClass,
      quantity,
      price,
      priceCurrency: holding.priceCurrency,
      priceSource: holding.priceSource,
      pricedAt: holding.pricedAt,
      value: round2(value),
    };
  }

  /**
   * The account's value today, written where the balance sheet and net worth
   * read it. Public because the metals service keeps its own account the same way.
   */
  async writeSnapshot(
    userId: string | null,
    workspaceId: string,
    accountId: string,
  ): Promise<void> {
    const currency = await this.workspaceCurrency(workspaceId);
    const holdings = await this.holdingRepository.find({ where: { workspaceId, accountId } });
    let total = 0;
    for (const holding of holdings) {
      total += (await this.holdingView(holding, currency)).value;
    }
    await this.balanceService.updateSnapshot(userId, workspaceId, {
      accountId,
      amount: round2(total),
      currency,
    });
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
    if (accountIds.length === 0) return [];
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
      if (!kind) continue;
      const amount = Math.abs(
        Number.parseFloat(kind === 'contribution' ? row.debit : row.credit) || 0,
      );
      if (amount === 0) continue;
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
    if (flows.length === 0) return { flows: [], missing: [] };
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

  private async requireAccount(workspaceId: string, accountId: string): Promise<BalanceAccount> {
    const account = await this.accountRepository.findOne({ where: { id: accountId, workspaceId } });
    if (!account?.accountKind) {
      throw new NotFoundException('Investment account not found');
    }
    return account;
  }

  private async requireHolding(workspaceId: string, holdingId: string): Promise<InvestmentHolding> {
    const holding = await this.holdingRepository.findOne({ where: { id: holdingId, workspaceId } });
    if (!holding) throw new NotFoundException('Holding not found');
    return holding;
  }

  /** Public for the metals service, which prices lots in the same currency. */
  async workspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['currency'],
    });
    const normalized = String(workspace?.currency || '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
  }

  private async convert(
    amount: number,
    from: string,
    to: string,
    workspaceId: string,
  ): Promise<number> {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    const source = (from || to).toUpperCase();
    if (source === to) return amount;
    const rate = await this.exchangeRatesService.getRateOrNull(source, to, undefined, workspaceId);
    return rate === null ? 0 : amount * rate;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function flowKind(
  type: TransactionType,
  pairKind: TransferPairKind | null,
): InvestmentFlowKind | null {
  if (pairKind === TransferPairKind.INVESTMENT) {
    return type === TransactionType.EXPENSE ? 'contribution' : 'withdrawal';
  }
  // Unpaired and linked: only income can be that — a dividend or interest.
  if (!pairKind && type === TransactionType.INCOME) return 'income';
  return null;
}

function toDateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
