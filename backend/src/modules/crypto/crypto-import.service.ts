import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  CryptoWallet,
  type CryptoWalletBalance,
  CryptoWalletKind,
} from '../../entities/crypto-wallet.entity';
import {
  Transaction,
  TransactionType,
  TransferPairKind,
  TransferPairSource,
} from '../../entities/transaction.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { CryptoBalanceService } from './crypto-balance.service';
import { type ExchangeEntry, type ExchangeName, parseExchangeCsv } from './crypto-exchange-csv';
import { CryptoHoldingsService } from './crypto-holdings.service';
import { CryptoPriceService } from './crypto-price.service';
import { addDecimals } from './crypto-transfer.mapper';

export interface ExchangeImportResult {
  exchange: ExchangeName;
  /** Rows written now. Re-importing the same file writes none. */
  imported: number;
  /** Rows the file held that we already had, or could not price. */
  skipped: number;
  walletId: string;
}

/**
 * Brings an exchange account into Lumio from the CSV the exchange exports.
 *
 * Most people's coins are not on a chain we can read. The account becomes a
 * wallet of kind `exchange` whose balances are the running total of the file,
 * and every row becomes a transaction — so the same cost basis, net worth and
 * reports work on it as on an address we sync.
 *
 * What a row counts as follows one rule: only money that entered or left the
 * user's hands is income or spending. A trade swaps one holding for another and
 * a move carries coins between places they already own, so both are booked as
 * one-leg transfers and stay out of every income and spending figure; interest
 * the exchange paid is income, and its fees are spending.
 */
@Injectable()
export class CryptoImportService {
  constructor(
    @InjectRepository(CryptoWallet)
    private readonly walletRepo: Repository<CryptoWallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly priceService: CryptoPriceService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly holdingsService: CryptoHoldingsService,
    private readonly balanceService: CryptoBalanceService,
  ) {}

  async importCsv(workspaceId: string, userId: string, csv: string): Promise<ExchangeImportResult> {
    const parsed = parseExchangeCsv(csv);
    if (!parsed) {
      throw new BadRequestException(
        'This file is not a Coinbase, Binance or Kraken history export',
      );
    }
    if (parsed.entries.length === 0) {
      throw new BadRequestException('The file holds no coin movements');
    }

    const currency = await this.holdingsService.getWorkspaceCurrency(workspaceId);
    const wallet = await this.getOrCreateWallet(workspaceId, userId, parsed.exchange);

    let imported = 0;
    let skipped = 0;
    for (const entry of parsed.entries) {
      const written = await this.persist(wallet, entry, parsed.exchange, currency);
      if (written) {
        imported += 1;
      } else {
        skipped += 1;
      }
    }

    // The file is the only record of what the account holds, so the balances are
    // its running total — not a sum of what we managed to book.
    await this.walletRepo.update(wallet.id, {
      balances: runningBalances(parsed.entries),
      lastSyncedAt: new Date(),
      lastSyncError: null,
    });
    await this.balanceService.writePortfolioSnapshot(workspaceId, userId);

    return { exchange: parsed.exchange, imported, skipped, walletId: wallet.id };
  }

  /**
   * One row. The money is what the file says the row cost or fetched when it says
   * so — that, and not a market average, is what the user actually paid. Only when
   * the export states no money (Kraken and Binance put the fiat side on a row of
   * its own, which would double-count) is the price of the day used instead.
   */
  private async persist(
    wallet: CryptoWallet,
    entry: ExchangeEntry,
    exchange: ExchangeName,
    currency: string,
  ): Promise<boolean> {
    const date = new Date(`${entry.date}T00:00:00.000Z`);
    const amount = Math.abs(entry.amount);
    const stated = await this.statedValue(entry, date, currency, wallet.workspaceId);
    const fiatAmount =
      stated ?? (await this.marketValue(entry, amount, date, currency, wallet.workspaceId));
    if (fiatAmount === null) {
      // Priced later rather than booked at zero; a re-import picks it up.
      return false;
    }
    const isIncome = entry.amount > 0;
    const id = reference(exchange, entry.reference);
    // A trade and a move are not income and not spending; a one-leg transfer is
    // exactly how the rest of Lumio already says that about a row.
    const neutral = entry.kind === 'trade' || entry.kind === 'move';

    const result = await this.transactionRepo
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values({
        workspaceId: wallet.workspaceId,
        cryptoWalletId: wallet.id,
        cryptoAsset: entry.asset,
        cryptoAmount: String(amount),
        cryptoTxHash: id,
        cryptoLeg: entry.kind === 'fee' ? 'fee' : entry.kind === 'move' ? 'move' : 'value',
        transactionDate: date,
        counterpartyName: exchange,
        counterpartyBank: exchange,
        paymentPurpose: entry.description || `${entry.kind} ${amount} ${entry.asset}`,
        amount: fiatAmount,
        debit: isIncome ? null : fiatAmount,
        credit: isIncome ? fiatAmount : null,
        currency,
        transactionType: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
        documentNumber: entry.reference.slice(0, 100),
        isVerified: true,
        ...(neutral
          ? {
              // A pair of one: the row is simply not spending, and `transferPairId`
              // is what every total in Lumio already reads to know that.
              transferPairId: randomUUID(),
              transferPairSource: TransferPairSource.AUTO,
              transferPairKind: TransferPairKind.TRANSFER,
            }
          : {}),
      })
      .orIgnore()
      .execute();

    return Array.isArray(result.raw) && result.raw.length > 0;
  }

  /** The money the file states for a row, in the workspace currency. */
  private async statedValue(
    entry: ExchangeEntry,
    date: Date,
    currency: string,
    workspaceId: string,
  ): Promise<number | null> {
    if (!entry.value) {
      return null;
    }
    if (entry.value.currency === currency) {
      return Math.round(entry.value.amount * 100) / 100;
    }
    const rate = await this.exchangeRatesService.getRateOrNull(
      entry.value.currency,
      currency,
      date,
      workspaceId,
    );
    return rate === null ? null : Math.round(entry.value.amount * rate * 100) / 100;
  }

  /** What the coin was worth that day, for a file that states no money. */
  private async marketValue(
    entry: ExchangeEntry,
    amount: number,
    date: Date,
    currency: string,
    workspaceId: string,
  ): Promise<number | null> {
    const usdPrice = await this.priceService.getUsdPrice(entry.asset, date).catch(() => null);
    if (usdPrice === null) {
      return null;
    }
    const usdRate = await this.exchangeRatesService.getRateOrNull(
      'USD',
      currency,
      date,
      workspaceId,
    );
    return usdRate === null ? null : Math.round(amount * usdPrice * usdRate * 100) / 100;
  }

  /** One wallet per exchange per workspace, created on the first import. */
  private async getOrCreateWallet(
    workspaceId: string,
    userId: string,
    exchange: ExchangeName,
  ): Promise<CryptoWallet> {
    const existing = await this.walletRepo.findOne({
      where: { workspaceId, kind: CryptoWalletKind.EXCHANGE, label: exchange },
    });
    if (existing) {
      return existing;
    }
    return this.walletRepo.save(
      this.walletRepo.create({
        workspaceId,
        address: null,
        kind: CryptoWalletKind.EXCHANGE,
        // Not a chain: nothing may try to sync this wallet from one.
        chainId: 0,
        label: exchange,
        balances: [],
        connectedByUserId: userId,
      }),
    );
  }
}

/** What the account holds after the whole file, asset by asset. */
function runningBalances(entries: ExchangeEntry[]): CryptoWalletBalance[] {
  const byAsset = new Map<string, string>();
  for (const entry of entries) {
    byAsset.set(entry.asset, addDecimals(byAsset.get(entry.asset) ?? '0', String(entry.amount)));
  }
  return [...byAsset.entries()]
    .filter(([, amount]) => Number(amount) > 0)
    .map(([asset, amount]) => ({ asset, amount }));
}

/**
 * The idempotency key. It goes in the same column an on-chain hash does, so a
 * second import of the same file loses the race with itself exactly as a repeated
 * chain sync does.
 */
function reference(exchange: ExchangeName, row: string): string {
  const digest = createHash('sha256').update(`${exchange}|${row}`).digest('hex').slice(0, 40);
  return `csv:${exchange.toLowerCase()}:${digest}`;
}
