import { Injectable, Logger } from '@nestjs/common';
import type { MempoolAddress, MempoolTx } from './bitcoin-transfer.mapper';
import { fetchJsonWithRetry } from './retry.util';

/** mempool.space's public Esplora API: no key, no sign-up. */
const MEMPOOL_BASE_URL = 'https://mempool.space/api';
/**
 * ponytail: the confirmed history comes 25 transactions a page; four pages are
 * the newest 100. Rows already held are free to re-read, so this only caps an
 * address with more than 100 transactions between two syncs.
 */
const MAX_PAGES = 4;
const PAGE_SIZE = 25;

@Injectable()
export class BitcoinClient {
  private readonly logger = new Logger(BitcoinClient.name);

  getAddress(address: string): Promise<MempoolAddress> {
    return this.get<MempoolAddress>(`/address/${address}`);
  }

  async getTransactions(address: string): Promise<MempoolTx[]> {
    const transactions: MempoolTx[] = [];
    let lastSeen = '';
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const rows = await this.get<MempoolTx[]>(
        `/address/${address}/txs/chain${lastSeen ? `/${lastSeen}` : ''}`,
      );
      transactions.push(...rows);
      if (rows.length < PAGE_SIZE) {
        break;
      }
      lastSeen = rows[rows.length - 1].txid;
    }
    return transactions;
  }

  private get<T>(path: string): Promise<T> {
    return fetchJsonWithRetry<T>(`${MEMPOOL_BASE_URL}${path}`, {}, 'mempool.space', message =>
      this.logger.warn(message),
    );
  }
}
