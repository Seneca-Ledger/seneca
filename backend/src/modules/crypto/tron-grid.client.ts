import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJsonWithRetry } from './retry.util';
import type { TronGridAccount, TronGridTrc20Transfer, TronGridTx } from './tron-transfer.mapper';

/**
 * TronGrid, the Tron Foundation's public API. It answers without a key, which
 * keeps Tron sync zero-setup like the Ethereum one, but the anonymous budget is
 * small and shared; `TRONGRID_API_KEY` (free at trongrid.io) raises it.
 */
const TRONGRID_BASE_URL = 'https://api.trongrid.io';
/**
 * ponytail: one page, the newest 200 rows per endpoint (TronGrid's page limit),
 * instead of following `meta.fingerprint`. Rows already held are free to re-read,
 * so this only caps a wallet with more than 200 transactions between two syncs.
 */
const PAGE_SIZE = 200;

@Injectable()
export class TronGridClient {
  private readonly logger = new Logger(TronGridClient.name);
  private readonly apiKey: string | undefined;

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('TRONGRID_API_KEY') || undefined;
  }

  /** Null for an address that exists on no block yet — a valid, empty wallet. */
  async getAccount(address: string): Promise<TronGridAccount | null> {
    const data = await this.get<TronGridAccount>(`/v1/accounts/${address}`);
    return data[0] ?? null;
  }

  getTransactions(address: string): Promise<TronGridTx[]> {
    return this.get<TronGridTx>(`/v1/accounts/${address}/transactions`, {
      only_confirmed: 'true',
      limit: String(PAGE_SIZE),
    });
  }

  getTrc20Transfers(address: string): Promise<TronGridTrc20Transfer[]> {
    return this.get<TronGridTrc20Transfer>(`/v1/accounts/${address}/transactions/trc20`, {
      only_confirmed: 'true',
      limit: String(PAGE_SIZE),
    });
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
    const query = new URLSearchParams(params).toString();
    const url = `${TRONGRID_BASE_URL}${path}${query ? `?${query}` : ''}`;
    const headers: Record<string, string> = this.apiKey ? { 'TRON-PRO-API-KEY': this.apiKey } : {};

    const body = await fetchJsonWithRetry<{ success?: boolean; data?: T[]; error?: string }>(
      url,
      { headers },
      'TronGrid',
      message => this.logger.warn(message),
    );
    // A read that did not succeed must not pass for an empty wallet.
    if (body.success === false || !Array.isArray(body.data)) {
      throw new Error(`TronGrid error: ${body.error ?? 'unexpected response'}`);
    }
    return body.data;
  }
}
