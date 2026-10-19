import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJsonWithRetry, sleep } from './retry.util';
import type { SolanaTokenAccount, SolanaTx } from './solana-transfer.mapper';

/**
 * Solana's public mainnet RPC. It needs no key but is tightly rate-limited, so
 * `SOLANA_RPC_URL` can point at a private endpoint (Helius, QuickNode, …).
 */
const PUBLIC_RPC_URL = 'https://api.mainnet-beta.solana.com';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
/**
 * ponytail: the public RPC has no "history with details" call — each transaction
 * is one more request — so a sync reads the newest 25. Rows already held are free
 * to re-read; this only caps a wallet with more than 25 transactions between syncs.
 */
const MAX_SIGNATURES = 25;
/**
 * The public RPC starts answering 429 with a ten-second Retry-After after a burst
 * of `getTransaction` calls (seen: a 50-transaction read took 66 s). Spacing the
 * calls keeps under that budget, which is much faster than being told to wait.
 * A private `SOLANA_RPC_URL` does not need it.
 */
const PUBLIC_RPC_SPACING_MS = 250;

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

@Injectable()
export class SolanaRpcClient {
  private readonly logger = new Logger(SolanaRpcClient.name);
  private readonly url: string;
  private readonly spacingMs: number;

  constructor(configService: ConfigService) {
    const privateUrl = configService.get<string>('SOLANA_RPC_URL');
    this.url = privateUrl || PUBLIC_RPC_URL;
    this.spacingMs = privateUrl ? 0 : PUBLIC_RPC_SPACING_MS;
  }

  async getLamports(address: string): Promise<number> {
    const result = await this.call<{ value: number }>('getBalance', [address]);
    return result.value;
  }

  async getTokenAccounts(address: string): Promise<SolanaTokenAccount[]> {
    const result = await this.call<{ value: SolanaTokenAccount[] }>('getTokenAccountsByOwner', [
      address,
      { programId: TOKEN_PROGRAM_ID },
      { encoding: 'jsonParsed' },
    ]);
    return result.value;
  }

  /** The newest transactions, one request each. Sequential, to stay under the rate limit. */
  async getTransactions(address: string): Promise<SolanaTx[]> {
    const signatures = await this.call<{ signature: string }[]>('getSignaturesForAddress', [
      address,
      { limit: MAX_SIGNATURES },
    ]);

    const transactions: SolanaTx[] = [];
    for (const { signature } of signatures) {
      await sleep(this.spacingMs);
      const tx = await this.call<SolanaTx | null>('getTransaction', [
        signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
      ]);
      if (tx) {
        transactions.push(tx);
      }
    }
    return transactions;
  }

  private async call<T>(method: string, params: unknown[]): Promise<T> {
    const body = await fetchJsonWithRetry<RpcResponse<T>>(
      this.url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      },
      'Solana RPC',
      message => this.logger.warn(message),
    );
    // An RPC error must not pass for an empty wallet.
    if (body.error || body.result === undefined) {
      throw new Error(`Solana RPC ${method} error: ${body.error?.message ?? 'no result'}`);
    }
    return body.result;
  }
}
