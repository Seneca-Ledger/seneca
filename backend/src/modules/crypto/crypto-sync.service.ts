import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
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
import { Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { TransferPairingService } from '../transactions/services/transfer-pairing.service';
import { BitcoinClient } from './bitcoin.client';
import {
  type MempoolAddress,
  type MempoolTx,
  mapBitcoinBalance,
  mapBitcoinTransfers,
} from './bitcoin-transfer.mapper';
import { deriveAddresses, isExtendedKey } from './bitcoin-xpub';
import {
  CHAIN_NAMES,
  CHAINS,
  type ChainFamily,
  NATIVE_ASSET_BY_CHAIN,
  SOLANA_TOKENS,
  TICKER_BY_CONTRACT,
  TRON_TOKENS,
} from './crypto.constants';
import { CryptoBalanceService } from './crypto-balance.service';
import { CryptoPriceService } from './crypto-price.service';
import {
  type ChainTransfer,
  type EtherscanTokenBalance,
  type EtherscanTokenTx,
  type EtherscanTx,
  finalizeTransfers,
  mapChainTransfers,
  mapWalletBalances,
} from './crypto-transfer.mapper';
import { isTransient, MAX_ATTEMPTS, retryWaitMs, sleep } from './retry.util';
import { SolanaRpcClient } from './solana-rpc.client';
import { mapSolanaBalances, mapSolanaTransfers } from './solana-transfer.mapper';
import { TronGridClient } from './tron-grid.client';
import { mapTronBalances, mapTronTransfers } from './tron-transfer.mapper';

/**
 * Blockscout's hosted explorers (one host per EVM chain, see `CHAINS`) mirror Etherscan's account API
 * (same actions, same field names) but needs no API key, so wallet sync works with
 * zero setup.
 *
 * Its anonymous budget is small: the host answers with `x-ratelimit-limit: 10` over
 * a window of roughly forty minutes, and one wallet sync spends four of those. That
 * is comfortable for the six-hourly cron plus the occasional manual refresh, and
 * tight for anything more, so the manual endpoint is throttled too.
 *
 * ponytail: single free provider, no fallback. Point this at Etherscan (with a key)
 * or add a second provider if Blockscout's limit or uptime ever becomes a problem.
 */
/**
 * ponytail: newest-N window instead of a stored block cursor. Re-reading rows we
 * already have is free (the unique index absorbs them), so this is only a ceiling
 * for a wallet that makes more than 1000 transfers between two syncs. Add a
 * `last_synced_block` column if that ever happens.
 */
const MAX_ROWS_PER_SYNC = 1000;
/** Addresses in a row with no history that end the search; the wallet convention. */
const BITCOIN_GAP_LIMIT = 20;
/** A ceiling on the walk, so a key with a strange history cannot scan forever. */
const BITCOIN_MAX_ADDRESSES = 200;
const ONE_DAY_SECONDS = 86_400;

export interface WalletSyncResult {
  imported: number;
  skipped: number;
}

@Injectable()
export class CryptoSyncService {
  private readonly logger = new Logger(CryptoSyncService.name);

  constructor(
    @InjectRepository(CryptoWallet)
    private readonly walletRepo: Repository<CryptoWallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    private readonly priceService: CryptoPriceService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly tronGrid: TronGridClient,
    private readonly bitcoin: BitcoinClient,
    private readonly solana: SolanaRpcClient,
    private readonly transferPairing: TransferPairingService,
    private readonly balanceService: CryptoBalanceService,
  ) {}

  /** One reader per chain family; each returns the chain's balances and transfers. */
  private readonly readers: Record<ChainFamily, (wallet: CryptoWallet) => Promise<ChainRead>> = {
    evm: wallet => this.readEvm(wallet),
    tron: wallet => this.readTron(wallet),
    bitcoin: wallet => this.readBitcoin(wallet),
    solana: wallet => this.readSolana(wallet),
  };

  @Cron('0 */6 * * *')
  async syncAllWallets(): Promise<void> {
    // A manual holding has no chain to read; only addresses are synced.
    const wallets = await this.walletRepo.find({
      where: { isActive: true, kind: CryptoWalletKind.ONCHAIN },
    });
    this.logger.log(`Syncing ${wallets.length} crypto wallet(s)`);

    for (const wallet of wallets) {
      // One bad wallet must not stop the rest of the workspace's sync.
      await this.syncWallet(wallet).catch(error => {
        this.logger.warn(`Sync failed for wallet ${wallet.id}: ${String(error)}`);
      });
    }
  }

  async syncWallet(wallet: CryptoWallet): Promise<WalletSyncResult> {
    try {
      const result = await this.runSync(wallet);
      await this.walletRepo.update(wallet.id, {
        lastSyncedAt: new Date(),
        lastSyncError: null,
      });
      // The sheet carries today's portfolio value, which is also the point the
      // history chart draws; it never fails the sync.
      await this.balanceService.writePortfolioSnapshot(
        wallet.workspaceId,
        wallet.connectedByUserId,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.walletRepo.update(wallet.id, { lastSyncError: message });
      throw error;
    }
  }

  private async runSync(wallet: CryptoWallet): Promise<WalletSyncResult> {
    // Balances are fetched alongside the transfers rather than after them: if the
    // explorer is unreachable the whole sync fails and the stored balances stay as
    // they were, instead of being half-updated from a partial read.
    const [chain, currency] = await Promise.all([
      this.readChain(wallet),
      this.getWorkspaceCurrency(wallet.workspaceId),
    ]);

    // Balances are stored the moment they are read, before the ledger work that can
    // fail on a rate-limited price lookup. The portfolio value is balances times
    // current prices, so a historical-price outage has no business freezing it.
    await this.walletRepo.update(wallet.id, { balances: chain.balances });

    const transfers = finalizeTransfers(chain.transfers);
    await this.primePrices(transfers);

    let imported = 0;
    let skipped = 0;

    for (const transfer of transfers) {
      const inserted = await this.persistTransfer(wallet, transfer, currency);
      if (inserted) {
        imported += 1;
      } else {
        skipped += 1;
      }
    }

    // A swap's two legs are linked so neither counts as income or spending, and the
    // fiat side of a purchase ("card paid 1000 EUR" against "wallet received ETH")
    // is matched by the same pairing the bank import uses.
    await this.pairTradeLegs(wallet, [
      ...new Set(transfers.filter(transfer => transfer.isTrade).map(transfer => transfer.hash)),
    ]);
    if (imported > 0) {
      await this.transferPairing
        .detectAndApply(wallet.workspaceId)
        .catch(error => this.logger.warn(`Transfer pairing after crypto sync failed: ${error}`));
    }

    return { imported, skipped };
  }

  private readChain(wallet: CryptoWallet): Promise<ChainRead> {
    const family = CHAINS[wallet.chainId]?.family;
    if (!family) {
      throw new Error(`Chain ${wallet.chainId} is not supported`);
    }
    return this.readers[family](wallet);
  }

  /**
   * One address, or every address an extended key has used. mempool.space answers
   * per address, so a wallet exported as an xpub costs one call per address found
   * plus the gap we scan past the last one — which is the price of a balance that
   * is actually right.
   */
  private async readBitcoin(wallet: CryptoWallet): Promise<ChainRead> {
    const addresses = isExtendedKey(wallet.address)
      ? await this.discoverBitcoinAddresses(wallet.address)
      : [wallet.address];

    const accounts: MempoolAddress[] = [];
    const transactions: MempoolTx[] = [];
    const seen = new Set<string>();
    for (const address of addresses) {
      accounts.push(await this.bitcoin.getAddress(address));
      for (const tx of await this.bitcoin.getTransactions(address)) {
        // One transaction can touch several of the wallet's addresses; the wallet
        // must count it once.
        if (!seen.has(tx.txid)) {
          seen.add(tx.txid);
          transactions.push(tx);
        }
      }
    }

    const ownAddresses = await this.getWorkspaceAddresses(wallet.workspaceId, wallet.chainId);
    return {
      balances: mapBitcoinBalance(accounts),
      transfers: mapBitcoinTransfers({ addresses, ownAddresses, transactions }),
    };
  }

  /**
   * Walks the key's receiving and change branches until `BITCOIN_GAP_LIMIT`
   * addresses in a row have never been used — the convention every wallet follows,
   * so stopping earlier would hide coins and going further would never end.
   */
  private async discoverBitcoinAddresses(extendedKey: string): Promise<string[]> {
    const found: string[] = [];
    for (const chain of [0, 1] as const) {
      let from = 0;
      let unused = 0;
      while (unused < BITCOIN_GAP_LIMIT && from < BITCOIN_MAX_ADDRESSES) {
        const batch = deriveAddresses(extendedKey, { chain, from, count: BITCOIN_GAP_LIMIT });
        for (const address of batch) {
          const account = await this.bitcoin.getAddress(address);
          if ((account?.chain_stats?.tx_count ?? 0) > 0) {
            found.push(address);
            unused = 0;
          } else {
            unused += 1;
            if (unused >= BITCOIN_GAP_LIMIT) {
              break;
            }
          }
        }
        from += BITCOIN_GAP_LIMIT;
      }
    }
    // An unused key still needs one address: its balance is zero, not unknown.
    return found.length > 0 ? found : deriveAddresses(extendedKey, { chain: 0, from: 0, count: 1 });
  }

  private async readSolana(wallet: CryptoWallet): Promise<ChainRead> {
    // Sequential: the public RPC's budget is per second, and the history alone is
    // one request per transaction.
    const lamports = await this.solana.getLamports(wallet.address);
    const tokenAccounts = await this.solana.getTokenAccounts(wallet.address);
    const transactions = await this.solana.getTransactions(wallet.address);
    const ownAddresses = await this.getWorkspaceAddresses(wallet.workspaceId, wallet.chainId);
    return {
      balances: mapSolanaBalances({ lamports, tokenAccounts, tokens: SOLANA_TOKENS }),
      transfers: mapSolanaTransfers({
        address: wallet.address,
        ownAddresses,
        tokens: SOLANA_TOKENS,
        transactions,
      }),
    };
  }

  private async readTron(wallet: CryptoWallet): Promise<ChainRead> {
    const [account, transactions, tokenTransfers, ownAddresses] = await Promise.all([
      this.tronGrid.getAccount(wallet.address),
      this.tronGrid.getTransactions(wallet.address),
      this.tronGrid.getTrc20Transfers(wallet.address),
      this.getWorkspaceAddresses(wallet.workspaceId, wallet.chainId),
    ]);

    return {
      balances: mapTronBalances({ account, tokens: TRON_TOKENS }),
      transfers: mapTronTransfers({
        address: wallet.address,
        ownAddresses,
        tokens: TRON_TOKENS,
        transactions,
        tokenTransfers,
      }),
    };
  }

  private async readEvm(wallet: CryptoWallet): Promise<ChainRead> {
    const nativeAsset = NATIVE_ASSET_BY_CHAIN[wallet.chainId] ?? 'ETH';
    // Which contracts count as real money on this chain. A chain we have no table
    // for prices no tokens at all, which is safer than trusting another chain's.
    const tickerByContract = TICKER_BY_CONTRACT[wallet.chainId] ?? {};
    const [transactions, tokenTransfers, nativeBalance, tokenBalances, ownAddresses] =
      await Promise.all([
        this.fetchEtherscan<EtherscanTx>(wallet, 'txlist'),
        this.fetchEtherscan<EtherscanTokenTx>(wallet, 'tokentx'),
        this.fetchNativeBalance(wallet),
        this.fetchTokenBalances(wallet),
        this.getWorkspaceAddresses(wallet.workspaceId, wallet.chainId),
      ]);

    return {
      balances: mapWalletBalances({
        nativeAsset,
        nativeBalance,
        tickerByContract,
        tokens: tokenBalances,
      }),
      transfers: mapChainTransfers({
        address: wallet.address,
        nativeAsset,
        ownAddresses,
        tickerByContract,
        transactions,
        tokenTransfers,
      }),
    };
  }

  /**
   * Caches every price the transfers will need, one request per asset. Pricing each
   * transfer's date on its own burned a request per date, and the provider's free
   * tier stops answering after five a minute — which used to leave the rest of the
   * transfers unpriced and silently dropped.
   */
  private async primePrices(transfers: ChainTransfer[]): Promise<void> {
    const earliest = transfers[0];
    if (!earliest) {
      return;
    }

    // `mapChainTransfers` returns oldest first; a day of padding makes sure the
    // first transfer's own date falls inside the window.
    const from = new Date((earliest.timestamp - ONE_DAY_SECONDS) * 1000);
    await this.priceService.primeHistoricalPrices(
      transfers.map(transfer => transfer.asset),
      from,
      new Date(),
    );
  }

  /** The address's current native-coin balance, in wei. */
  private async fetchNativeBalance(wallet: CryptoWallet): Promise<string> {
    const data = await this.explorerGet(wallet.chainId, {
      module: 'account',
      action: 'balance',
      address: wallet.address,
    });

    // A balance we could not read must not be mistaken for a balance of zero.
    if (data.status !== '1' || typeof data.result !== 'string') {
      throw new Error(`Block explorer balance error: ${String(data.result ?? data.message)}`);
    }
    return data.result;
  }

  /** The address's current token balances. An address holding none returns no rows. */
  private async fetchTokenBalances(wallet: CryptoWallet): Promise<EtherscanTokenBalance[]> {
    const data = await this.explorerGet(wallet.chainId, {
      module: 'account',
      action: 'tokenlist',
      address: wallet.address,
    });

    // "No tokens found" comes back as a string result and is an empty wallet, not
    // a failure — the same shape `txlist` uses for an address with no history.
    return Array.isArray(data.result) ? (data.result as EtherscanTokenBalance[]) : [];
  }

  /**
   * Returns true when a new row was written. A transfer we already hold, or one
   * whose asset or USD value cannot be priced, is skipped rather than booked at
   * zero or at a made-up 1:1 rate; the next sync tries it again.
   *
   * Synced rows are written confirmed. The chain is the source of truth for them:
   * unlike a bank import there is nothing to correct — only a category to pick —
   * and an unconfirmed row counts nowhere, which used to keep every crypto figure
   * at zero until the user clicked through hundreds of Review cards.
   */
  private async persistTransfer(
    wallet: CryptoWallet,
    transfer: ChainTransfer,
    currency: string,
  ): Promise<boolean> {
    const date = new Date(transfer.timestamp * 1000);
    const usdPrice = await this.priceService.getUsdPrice(transfer.asset, date);
    if (usdPrice === null) {
      return false;
    }

    const usdRate = await this.exchangeRatesService.getRateOrNull(
      'USD',
      currency,
      date,
      wallet.workspaceId,
    );
    if (usdRate === null) {
      return false;
    }

    // A fee we cannot price is dropped from the row rather than taking the whole
    // transfer down with it: the transfer itself is the fact worth keeping.
    const fee = await this.priceFee(transfer, date, wallet.workspaceId);
    const usdValue = Number(transfer.amount) * usdPrice + (fee?.usdValue ?? 0);
    const fiatAmount = Math.round(usdValue * usdRate * 100) / 100;
    const feeFiat = fee ? Math.round(fee.usdValue * usdRate * 100) / 100 : null;
    const isIncome = transfer.direction === 'in';
    const leg = transfer.leg ?? 'value';

    const result = await this.transactionRepo
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values({
        workspaceId: wallet.workspaceId,
        cryptoWalletId: wallet.id,
        cryptoAsset: transfer.asset,
        cryptoAmount: transfer.amount,
        cryptoTxHash: transfer.hash,
        cryptoLeg: leg,
        cryptoFeeAmount: fee?.amount ?? null,
        cryptoFeeAsset: fee?.asset ?? null,
        cryptoFeeFiat: feeFiat,
        transactionDate: date,
        counterpartyName: shortenAddress(transfer.counterparty) || 'Unknown address',
        counterpartyAccount: transfer.counterparty || null,
        counterpartyBank: CHAIN_NAMES[wallet.chainId] ?? 'Blockchain',
        paymentPurpose: describeTransfer(transfer),
        amount: fiatAmount,
        debit: isIncome ? null : fiatAmount,
        credit: isIncome ? fiatAmount : null,
        currency,
        transactionType: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
        documentNumber: transfer.hash,
        isVerified: true,
      })
      .orIgnore()
      .execute();

    // `ON CONFLICT DO NOTHING` returns no row when the unique index rejected the
    // insert, which is exactly how a repeated sync stays idempotent.
    return Array.isArray(result.raw) && result.raw.length > 0;
  }

  /** The fee folded onto a transfer, priced; null when there is none or no price. */
  private async priceFee(
    transfer: ChainTransfer,
    date: Date,
    workspaceId: string,
  ): Promise<{ asset: string; amount: string; usdValue: number } | null> {
    if (!transfer.fee) {
      return null;
    }
    const usdPrice = await this.priceService
      .getUsdPrice(transfer.fee.asset, date)
      .catch(() => null);
    if (usdPrice === null) {
      this.logger.warn(
        `No price for fee asset ${transfer.fee.asset} in workspace ${workspaceId}; booking the transfer without it`,
      );
      return null;
    }
    return {
      asset: transfer.fee.asset,
      amount: transfer.fee.amount,
      usdValue: Number(transfer.fee.amount) * usdPrice,
    };
  }

  /**
   * Links the two legs of a swap, so the asset that left and the asset that
   * arrived cancel out of income and spending the same way a transfer between two
   * of the user's accounts does. Only a clean one-in-one-out swap is linked: a
   * multi-leg transaction is left alone rather than guessed at.
   */
  private async pairTradeLegs(wallet: CryptoWallet, hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      return;
    }
    const legs = await this.transactionRepo.find({
      where: {
        workspaceId: wallet.workspaceId,
        cryptoWalletId: wallet.id,
        cryptoTxHash: In(hashes),
        cryptoLeg: 'value',
        transferPairId: IsNull(),
      },
      select: ['id', 'cryptoTxHash', 'transactionType'],
    });

    const byHash = new Map<string, Transaction[]>();
    for (const leg of legs) {
      const hash = leg.cryptoTxHash as string;
      byHash.set(hash, [...(byHash.get(hash) ?? []), leg]);
    }

    for (const group of byHash.values()) {
      const incoming = group.filter(leg => leg.transactionType === TransactionType.INCOME);
      const outgoing = group.filter(leg => leg.transactionType === TransactionType.EXPENSE);
      if (incoming.length !== 1 || outgoing.length !== 1) {
        continue;
      }
      await this.transactionRepo.update(
        { id: In([incoming[0].id, outgoing[0].id]), transferPairId: IsNull() },
        {
          transferPairId: randomUUID(),
          transferPairSource: TransferPairSource.AUTO,
          transferPairKind: TransferPairKind.TRANSFER,
        },
      );
    }
  }

  /** Every address the workspace watches on this chain — the internal-transfer filter. */
  private async getWorkspaceAddresses(workspaceId: string, chainId: number): Promise<string[]> {
    const wallets = await this.walletRepo.find({
      where: { workspaceId, chainId },
      select: ['address'],
    });
    return wallets.map(wallet => wallet.address);
  }

  private async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
      select: ['id', 'currency'],
    });
    return currencyCodeOrDefault(workspace?.currency);
  }

  private async fetchEtherscan<T>(
    wallet: CryptoWallet,
    action: 'txlist' | 'tokentx',
  ): Promise<T[]> {
    const params = new URLSearchParams({
      module: 'account',
      action,
      address: wallet.address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: String(MAX_ROWS_PER_SYNC),
      sort: 'desc',
    });

    const data = await this.explorerGet(wallet.chainId, params);

    if (typeof data.result === 'string') {
      // "No transactions found" comes back as status 0 with a string result and is
      // an empty wallet, not a failure. Anything else is a real error.
      if (data.message?.includes('No transactions found')) {
        return [];
      }
      throw new Error(`Block explorer ${action} error: ${data.result}`);
    }

    return data.result as T[];
  }

  /**
   * One sync asks the explorer four questions, and its anonymous budget is shared
   * with everyone else using the public host, so a refusal is retried rather than
   * failing the whole wallet on a moment's bad luck.
   */
  private async explorerGet(
    chainId: number,
    params: URLSearchParams | Record<string, string>,
  ): Promise<ExplorerResponse> {
    const baseUrl = CHAINS[chainId]?.explorerUrl;
    if (!baseUrl) {
      throw new Error(`No block explorer for chain ${chainId}`);
    }
    const query = new URLSearchParams(params).toString();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const response = await fetch(`${baseUrl}?${query}`).catch(() => null);

      if (response?.ok) {
        return (await response.json()) as ExplorerResponse;
      }

      const wait = isTransient(response) ? retryWaitMs(response, attempt) : null;
      if (wait === null || attempt === MAX_ATTEMPTS - 1) {
        throw new Error(
          response
            ? `Block explorer returned HTTP ${response.status}`
            : 'Block explorer is unreachable',
        );
      }

      this.logger.warn(`Block explorer returned ${response?.status}, retrying in ${wait}ms`);
      await sleep(wait);
    }

    throw new Error('Block explorer is unreachable');
  }
}

/** What one chain's provider reports: current holdings and the transfers to book. */
interface ChainRead {
  balances: CryptoWalletBalance[];
  transfers: ChainTransfer[];
}

interface ExplorerResponse {
  status: string;
  message: string;
  result: unknown[] | string;
}

/**
 * What the row says it is. A fee leg is named a fee, a swap leg is named a trade,
 * so the ledger does not read "received 1200 USDC" for money that was never income.
 */
function describeTransfer(transfer: ChainTransfer): string {
  if (transfer.leg === 'fee') {
    return `Network fee ${transfer.amount} ${transfer.asset}`;
  }
  if (transfer.isTrade) {
    return transfer.direction === 'in'
      ? `Received ${transfer.amount} ${transfer.asset} in a swap`
      : `Swapped ${transfer.amount} ${transfer.asset}`;
  }
  const verb = transfer.direction === 'in' ? 'Received' : 'Sent';
  const fee = transfer.fee ? ` (fee ${transfer.fee.amount} ${transfer.fee.asset})` : '';
  return `${verb} ${transfer.amount} ${transfer.asset}${fee}`;
}

function shortenAddress(address: string): string {
  if (!address) {
    return '';
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
