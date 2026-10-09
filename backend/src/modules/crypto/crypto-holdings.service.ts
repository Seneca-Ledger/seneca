import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { CryptoWallet, CryptoWalletKind } from '../../entities/crypto-wallet.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import {
  type AssetBasis,
  computeBasisWithDisposals,
  type Disposal,
  disposalsByOwner,
  type LotEvent,
} from './crypto-lots';
import { CryptoPriceService } from './crypto-price.service';
import { addDecimals } from './crypto-transfer.mapper';

export interface CryptoHolding {
  asset: string;
  /** Amount held, as a decimal string. */
  amount: string;
  /** Current price of one unit, in the workspace currency. */
  price: number;
  /** Current value in the workspace currency. */
  value: number;
  /** What one coin cost on average (FIFO), or null when nothing is known. */
  avgCost: number | null;
  /** What the coins held cost, at that average. */
  cost: number | null;
  /** Value minus cost: profit not taken yet. */
  unrealized: number | null;
  unrealizedPercent: number | null;
  /** Profit already taken on this asset, over the whole history we hold. */
  realized: number;
  /** A disposal had no purchase behind it, so the basis is only part of the story. */
  basisIncomplete: boolean;
}

export interface CryptoHoldingsResult {
  currency: string;
  holdings: CryptoHolding[];
  /**
   * Assets the wallets hold that no price source knows. They are left out of the
   * total rather than counted at zero — but counted here, so the page can say so
   * instead of quietly showing a smaller portfolio than the user has.
   */
  unpriced: { asset: string; amount: string }[];
}

/**
 * What the workspace's wallets are worth right now.
 *
 * Shared by the crypto page and by the balance sheet, so the portfolio is one
 * number computed one way: balances as the last sync read them off the chain (or
 * as the user entered them for a manual holding), at today's price.
 */
@Injectable()
export class CryptoHoldingsService {
  constructor(
    @InjectRepository(CryptoWallet)
    private readonly walletRepo: Repository<CryptoWallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    private readonly priceService: CryptoPriceService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
      select: ['id', 'currency'],
    });
    return currencyCodeOrDefault(workspace?.currency);
  }

  /**
   * Holdings are the balances the last sync read off the chain, summed across the
   * workspace's wallets. They are deliberately NOT derived from the booked
   * transfers: a transfer that fails to import (an unpriceable asset, a rate-limited
   * price lookup) would otherwise move the portfolio silently, and a balance that
   * changed without a transfer — staking accrued in place, a rebasing token — would
   * never show up at all.
   */
  async getHoldings(workspaceId: string, currency: string): Promise<CryptoHoldingsResult> {
    const wallets = await this.walletRepo.find({
      where: { workspaceId },
      select: ['id', 'balances', 'kind', 'createdAt'],
    });

    const amountByAsset = new Map<string, string>();
    for (const wallet of wallets) {
      for (const balance of wallet.balances ?? []) {
        amountByAsset.set(
          balance.asset,
          addDecimals(amountByAsset.get(balance.asset) ?? '0', balance.amount),
        );
      }
    }

    if (amountByAsset.size === 0) {
      return { currency, holdings: [], unpriced: [] };
    }

    const [usdPrices, usdToCurrency, basis] = await Promise.all([
      this.priceService.getCurrentUsdPrices([...amountByAsset.keys()]),
      this.exchangeRatesService.getRate('USD', currency, undefined, workspaceId),
      this.costBasis(workspaceId, wallets),
    ]);

    const held = [...amountByAsset.entries()].filter(([, amount]) => Number(amount) > 0);

    return {
      currency,
      holdings: held
        .filter(([asset]) => usdPrices[asset] !== undefined)
        .map(([asset, amount]) => {
          const value = round2(Number(amount) * usdPrices[asset] * usdToCurrency);
          return {
            asset,
            amount,
            price: round2(usdPrices[asset] * usdToCurrency),
            value,
            ...this.gain(basis.get(asset), Number(amount), value),
          };
        })
        .sort((a, b) => b.value - a.value),
      unpriced: held
        .filter(([asset]) => usdPrices[asset] === undefined)
        .map(([asset, amount]) => ({ asset, amount })),
    };
  }

  /**
   * The cost side of a holding. It is measured against the amount the chain
   * reports, not the amount the lots add up to: the chain is the truth about how
   * much is held, the lots are only the truth about what it cost.
   */
  private gain(
    basis: AssetBasis | undefined,
    amount: number,
    value: number,
  ): Pick<
    CryptoHolding,
    'avgCost' | 'cost' | 'unrealized' | 'unrealizedPercent' | 'realized' | 'basisIncomplete'
  > {
    const avgCost = basis?.avgCost ?? null;
    if (avgCost === null) {
      return {
        avgCost: null,
        cost: null,
        unrealized: null,
        unrealizedPercent: null,
        realized: basis?.realized ?? 0,
        basisIncomplete: basis?.incomplete ?? true,
      };
    }
    const cost = round2(avgCost * amount);
    const unrealized = round2(value - cost);
    return {
      avgCost: round2(avgCost),
      cost,
      unrealized,
      unrealizedPercent: cost > 0 ? round2((unrealized / cost) * 100) : null,
      realized: basis?.realized ?? 0,
      basisIncomplete: basis?.incomplete ?? false,
    };
  }

  /**
   * Every acquisition and disposal the workspace has on record, turned into lots.
   * A swap counts on both sides — it is a sale and a purchase, whatever it does to
   * income — so paired rows are deliberately included here, unlike in the income
   * and spending figures. A fee is a disposal of the coin it was paid in, and the
   * money it cost comes back out of the transfer's own value.
   */
  private async costBasis(
    workspaceId: string,
    wallets: Pick<CryptoWallet, 'balances' | 'kind' | 'createdAt'>[],
  ): Promise<Map<string, AssetBasis>> {
    return computeBasisWithDisposals(await this.lotEvents(workspaceId, wallets)).byAsset;
  }

  /** The acquisitions and disposals both the cost basis and the gains report read. */
  private async lotEvents(
    workspaceId: string,
    wallets: Pick<CryptoWallet, 'balances' | 'kind' | 'createdAt'>[],
    ownerByWallet?: Map<string, string | null>,
  ): Promise<LotEvent[]> {
    const rows = await onlyCounted(
      this.transactionRepo
        .createQueryBuilder('t')
        .where('t.workspaceId = :workspaceId', { workspaceId })
        .andWhere('t.cryptoWalletId IS NOT NULL')
        .andWhere('t.cryptoAsset IS NOT NULL'),
      't',
    )
      .andWhere('t.cryptoAmount IS NOT NULL')
      // A move carries coins between places the user already owns. It changes
      // where they are and nothing about what they cost, so it is not a lot event.
      .andWhere("(t.cryptoLeg IS NULL OR t.cryptoLeg != 'move')")
      .orderBy('t.transactionDate', 'ASC')
      .getMany();

    const events: LotEvent[] = [];
    for (const row of rows) {
      const date = isoDate(row.transactionDate);
      const feeFiat = Number(row.cryptoFeeFiat ?? 0);
      const amount = Number(row.cryptoAmount);
      if (amount > 0) {
        events.push({
          asset: row.cryptoAsset as string,
          date,
          direction: row.transactionType === TransactionType.INCOME ? 'in' : 'out',
          amount,
          owner: ownerByWallet?.get(row.cryptoWalletId as string) ?? null,
          value: Math.max(Number(row.amount ?? 0) - feeFiat, 0),
        });
      }
      const feeAmount = Number(row.cryptoFeeAmount ?? 0);
      if (feeAmount > 0 && row.cryptoFeeAsset) {
        events.push({
          asset: row.cryptoFeeAsset,
          date,
          direction: 'out',
          amount: feeAmount,
          value: feeFiat,
        });
      }
    }

    // A hand-kept holding carries its own purchase price, and nothing else records it.
    for (const wallet of wallets) {
      if (wallet.kind !== CryptoWalletKind.MANUAL) {
        continue;
      }
      for (const balance of wallet.balances ?? []) {
        if (balance.costPerUnit === undefined) {
          continue;
        }
        events.push({
          asset: balance.asset,
          date: isoDate(wallet.createdAt),
          direction: 'in',
          amount: Number(balance.amount),
          value: Number(balance.amount) * balance.costPerUnit,
        });
      }
    }

    return events;
  }

  /**
   * Every sale in a period, against the purchases it consumed — what a capital
   * gains return is made of. The holding period is stated rather than judged:
   * whether a year makes a gain tax-free, or a sale short-term, is a question for
   * the user's own tax authority, and Lumio does not answer it for them.
   */
  async realizedGains(
    workspaceId: string,
    range: { from?: string; to?: string } = {},
  ): Promise<{
    currency: string;
    disposals: Disposal[];
    proceeds: number;
    cost: number;
    gain: number;
    /** Sales with coins no purchase backs; their gain is not a finished number. */
    incompleteCount: number;
  }> {
    const currency = await this.getWorkspaceCurrency(workspaceId);
    const wallets = await this.walletRepo.find({
      where: { workspaceId },
      select: ['id', 'balances', 'kind', 'createdAt'],
    });
    const { disposals } = computeBasisWithDisposals(await this.lotEvents(workspaceId, wallets));

    const inRange = disposals.filter(
      disposal =>
        (!range.from || disposal.date >= range.from) && (!range.to || disposal.date <= range.to),
    );
    const total = (pick: (disposal: Disposal) => number): number =>
      round2(inRange.reduce((sum, disposal) => sum + pick(disposal), 0));

    return {
      currency,
      disposals: inRange,
      proceeds: total(disposal => disposal.proceeds),
      cost: total(disposal => disposal.cost),
      gain: total(disposal => disposal.gain),
      incompleteCount: inRange.filter(disposal => disposal.costIncomplete).length,
    };
  }

  /**
   * The same sales, split by whose wallet they happened in — what a personal
   * tax return is built from. A sale whose coins no purchase backs is still
   * listed: it is the row that needs a human before anything is filed.
   */
  async realizedGainsByOwner(
    workspaceId: string,
    range: { from?: string; to?: string } = {},
  ): Promise<{
    currency: string;
    byOwner: Array<{ ownerUserId: string | null; disposals: Disposal[] }>;
  }> {
    const currency = await this.getWorkspaceCurrency(workspaceId);
    const wallets = await this.walletRepo.find({
      where: { workspaceId },
      select: ['id', 'balances', 'kind', 'createdAt', 'connectedByUserId'],
    });
    const ownerByWallet = new Map<string, string | null>(
      wallets.map(wallet => [wallet.id, wallet.connectedByUserId ?? null]),
    );
    const events = await this.lotEvents(workspaceId, wallets, ownerByWallet);
    const byOwner = [...disposalsByOwner(events).entries()].map(([ownerUserId, disposals]) => ({
      ownerUserId,
      disposals: disposals.filter(
        disposal =>
          (!range.from || disposal.date >= range.from) && (!range.to || disposal.date <= range.to),
      ),
    }));
    return { currency, byOwner: byOwner.filter(entry => entry.disposals.length > 0) };
  }

  /** The portfolio's current value in the workspace currency. */
  async portfolioValue(workspaceId: string): Promise<{ currency: string; value: number }> {
    const currency = await this.getWorkspaceCurrency(workspaceId);
    const { holdings } = await this.getHoldings(workspaceId, currency);
    return {
      currency,
      value: round2(holdings.reduce((total, holding) => total + holding.value, 0)),
    };
  }
}

function isoDate(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
