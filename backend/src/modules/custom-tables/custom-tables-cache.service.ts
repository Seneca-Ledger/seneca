import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { createHash } from 'crypto';

type RowsCacheParams = {
  cursor?: number;
  offset?: number;
  limit?: number;
  filters?: unknown;
  sort?: unknown;
  aggs?: unknown;
  groupBy?: string;
};

@Injectable()
export class CustomTablesCacheService {
  private readonly ttlMs = 300000; // 5 minutes

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  private hash(value: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(value ?? ''))
      .digest('hex');
  }

  private async getVersion(key: string): Promise<string> {
    const cached = await this.cacheManager.get<string>(key);
    if (cached) {
      return cached;
    }
    const next = Date.now().toString();
    await this.cacheManager.set(key, next, 0);
    return next;
  }

  private async bump(key: string): Promise<void> {
    await this.cacheManager.set(key, Date.now().toString(), 0);
  }

  private listVersionKey(userId: string) {
    return `customTables:list:version:${userId}`;
  }

  private tableVersionKey(userId: string, tableId: string) {
    return `customTables:table:version:${userId}:${tableId}`;
  }

  private rowsVersionKey(userId: string, tableId: string) {
    return `customTables:rows:version:${userId}:${tableId}`;
  }

  async listKey(userId: string) {
    const version = await this.getVersion(this.listVersionKey(userId));
    return `customTables:list:${userId}:${version}`;
  }

  async tableKey(userId: string, tableId: string) {
    const version = await this.getVersion(this.tableVersionKey(userId, tableId));
    return `customTables:table:${userId}:${tableId}:${version}`;
  }

  async rowsKey(userId: string, tableId: string, params: RowsCacheParams) {
    const version = await this.getVersion(this.rowsVersionKey(userId, tableId));
    const hash = this.hash(params);
    return `customTables:rows:${userId}:${tableId}:${version}:${hash}`;
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = await this.cacheManager.get<T>(key);
    if (cached !== undefined && cached !== null) {
      return cached;
    }
    const value = await factory();
    await this.cacheManager.set(key, value, this.ttlMs);
    return value;
  }

  async bumpList(userId: string): Promise<void> {
    await this.bump(this.listVersionKey(userId));
  }

  async bumpTable(userId: string, tableId: string): Promise<void> {
    await this.bump(this.tableVersionKey(userId, tableId));
  }

  async bumpRows(userId: string, tableId: string): Promise<void> {
    await this.bump(this.rowsVersionKey(userId, tableId));
  }
}
