import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { countedSql } from '../../common/utils/counted-transactions.util';
import type {
  CreateInvestmentAccountBody,
  InvestmentHolding as HoldingView,
  InvestmentAccount as InvestmentAccountView,
  UpsertHoldingBody,
} from '../../contracts';
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
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { pricedUnits } from './metal-weight.util';
import { normalizeStockSymbol, StockPriceService } from './stock-price.service';

const INVESTMENTS_SECTION_CODE = 'ASSET_INVESTMENTS';

export type { HoldingView, InvestmentAccountView };

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
    const contributed = await this.contributedByAccount(
      workspaceId,
      accounts.map(account => account.id),
      currency,
    );
    const views: InvestmentAccountView[] = [];
    for (const account of accounts) {
      const rows: HoldingView[] = [];
      for (const holding of holdings.filter(item => item.accountId === account.id)) {
        rows.push(await this.holdingView(holding, currency));
      }
      const value = round2(rows.reduce((sum, row) => sum + row.value, 0));
      const paidIn = contributed.get(account.id) ?? 0;
      views.push({
        id: account.id,
        name: account.name,
        // The query above reads only these two kinds.
        kind: account.accountKind as BalanceAccountKind.INVESTMENT | BalanceAccountKind.RETIREMENT,
        currency,
        value,
        contributed: round2(paidIn),
        gain: round2(value - paidIn),
        holdings: rows,
      });
    }
    return views;
  }

  async createAccount(
    userId: string,
    workspaceId: string,
    dto: CreateInvestmentAccountBody,
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
      { accountKind: toEnum(BalanceAccountKind, dto.kind) ?? BalanceAccountKind.INVESTMENT },
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
    dto: UpsertHoldingBody,
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
      assetClass: toEnum(InvestmentAssetClass, dto.assetClass) ?? InvestmentAssetClass.OTHER,
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
    dto: UpsertHoldingBody,
  ): Promise<HoldingView> {
    const holding = await this.requireHolding(workspaceId, holdingId);
    if (dto.symbol !== undefined) {
      holding.symbol = dto.symbol ? this.normalizeSymbol(dto.symbol) : null;
    }
    if (dto.name != null) holding.name = dto.name;
    if (dto.assetClass != null) holding.assetClass = toEnum(InvestmentAssetClass, dto.assetClass);
    if (dto.quantity != null) holding.quantity = dto.quantity;
    if (dto.price != null) {
      holding.price = dto.price;
      holding.priceSource = InvestmentPriceSource.MANUAL;
      holding.pricedAt = new Date();
    }
    if (dto.priceCurrency != null) holding.priceCurrency = dto.priceCurrency.toUpperCase();
    await this.holdingRepository.save(holding);
    await this.writeSnapshot(userId, workspaceId, holding.accountId);
    return this.holdingView(holding, await this.workspaceCurrency(workspaceId));
  }

  async deleteHolding(userId: string, workspaceId: string, holdingId: string): Promise<void> {
    const holding = await this.requireHolding(workspaceId, holdingId);
    await this.holdingRepository.remove(holding);
    await this.writeSnapshot(userId, workspaceId, holding.accountId);
  }

  /**
   * Fetches a price for every holding with a symbol (stocks and funds from
   * Stooq) and rewrites the snapshots of the accounts that changed. Returns how
   * many holdings got a price. Coins are not here: they live in `crypto_wallets`.
   */
  async refreshPrices(userId: string, workspaceId: string, onlyIds?: string[]): Promise<number> {
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
  async valueByAssetClass(workspaceId: string): Promise<Map<InvestmentAssetClass, number>> {
    const currency = await this.workspaceCurrency(workspaceId);
    const holdings = await this.holdingRepository.find({ where: { workspaceId } });
    const totals = new Map<InvestmentAssetClass, number>();
    for (const holding of holdings) {
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
      pricedAt: holding.pricedAt?.toISOString() ?? null,
      value: round2(value),
    };
  }

  /**
   * The account's value today, written where the balance sheet and net worth
   * read it. Public because the metals service keeps its own account the same way.
   */
  async writeSnapshot(userId: string, workspaceId: string, accountId: string): Promise<void> {
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

  private async contributedByAccount(
    workspaceId: string,
    accountIds: string[],
    currency: string,
  ): Promise<Map<string, number>> {
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.investment_account_id', 'accountId')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(t.debit), 0)', 'total')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.investment_account_id IN (:...accountIds)', { accountIds })
      .andWhere('t.is_duplicate = false')
      .andWhere(countedSql('t'))
      .groupBy('t.investment_account_id')
      .addGroupBy('t.currency')
      .getRawMany<{ accountId: string; currency: string; total: string }>();
    const result = new Map<string, number>();
    for (const row of rows) {
      const amount = await this.convert(
        Number.parseFloat(row.total),
        row.currency,
        currency,
        workspaceId,
      );
      result.set(row.accountId, (result.get(row.accountId) ?? 0) + amount);
    }
    return result;
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
      select: {
        currency: true,
      },
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
