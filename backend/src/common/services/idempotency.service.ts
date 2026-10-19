import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { IdempotencyKey } from '../../entities/idempotency-key.entity';

interface IdempotencyResponse {
  data: unknown;
  cached: boolean;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyKeyRepository: Repository<IdempotencyKey>,
  ) {}

  /**
   * Check if an idempotency key exists and return cached response
   * @param key The idempotency key
   * @param userId User ID
   * @param workspaceId Workspace ID
   * @returns Cached response or null if not found
   */
  async checkKey(
    key: string,
    userId: string,
    workspaceId: string,
  ): Promise<IdempotencyResponse | null> {
    const existing = await this.idempotencyKeyRepository.findOne({
      where: {
        key,
        userId,
        workspaceId,
      },
    });

    if (!existing) {
      return null;
    }

    // Check if expired
    if (existing.expiresAt < new Date()) {
      // Delete expired key
      await this.idempotencyKeyRepository.delete(existing.id);
      return null;
    }

    return {
      data: existing.responseData,
      cached: true,
    };
  }

  /**
   * Store an idempotency key with response data
   * @param key The idempotency key
   * @param userId User ID
   * @param workspaceId Workspace ID
   * @param response Response data to cache
   * @param ttlHours Time to live in hours (default: 24)
   */
  async storeKey(
    key: string,
    userId: string,
    workspaceId: string,
    response: unknown,
    ttlHours = 24,
  ): Promise<void> {
    const responseHash = this.hashResponse(response);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const idempotencyKey = this.idempotencyKeyRepository.create({
      key,
      userId,
      workspaceId,
      responseHash,
      responseData: (response ?? {}) as Record<string, unknown>,
      expiresAt,
    });

    await this.idempotencyKeyRepository.save(idempotencyKey);
  }

  /**
   * Clean up expired idempotency keys
   * Should be called periodically by a cron job
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.idempotencyKeyRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }

  /**
   * Hash response data for integrity checking
   */
  private hashResponse(response: unknown): string {
    const data = JSON.stringify(response);
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
