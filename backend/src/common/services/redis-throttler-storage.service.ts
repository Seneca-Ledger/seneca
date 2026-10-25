import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * One round trip per request, with the semantics of @nestjs/throttler's own
 * in-memory store: while a key is blocked its hits are not counted; past the
 * limit it is blocked for `blockDuration`, after which counting starts again
 * from one. (@nest-lab/throttler-storage-redis, which this replaces, let the
 * block key expire on its own and then blocked again for the rest of the hit
 * window, so a block outlived its duration.)
 */
const INCREMENT_SCRIPT = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local timeToBlockExpire = redis.call('PTTL', blockKey)
if timeToBlockExpire > 0 then
  local hits = tonumber(redis.call('GET', hitKey) or '0')
  local timeToExpire = math.max(redis.call('PTTL', hitKey), 0)
  return { hits, timeToExpire, 1, timeToBlockExpire }
end

local totalHits = redis.call('INCR', hitKey)
local timeToExpire = redis.call('PTTL', hitKey)
if timeToExpire <= 0 then
  redis.call('PEXPIRE', hitKey, ttl)
  timeToExpire = ttl
end

if totalHits > limit then
  if blockDuration > 0 then
    redis.call('SET', blockKey, 1, 'PX', blockDuration)
    -- The next window, once the block is over, starts from zero.
    redis.call('DEL', hitKey)
    return { totalHits, timeToExpire, 1, blockDuration }
  end
  return { totalHits, timeToExpire, 1, 0 }
end

return { totalHits, timeToExpire, 0, 0 }
`;

/**
 * Throttler counters in Redis, shared by every instance of the API (the
 * default in-memory store counts per process).
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;
  // A connection opened from a URL is ours to close; one handed in is not.
  private readonly ownsConnection: boolean;

  constructor(redisOrUrl: Redis | string) {
    this.ownsConnection = typeof redisOrUrl === 'string';
    this.redis = typeof redisOrUrl === 'string' ? new Redis(redisOrUrl) : redisOrUrl;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // One hash tag for both keys, so they land on the same Redis Cluster slot.
    const prefix = `{${key}:${throttlerName}}`;
    const result = await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      `${prefix}:hits`,
      `${prefix}:blocked`,
      ttl,
      limit,
      blockDuration,
    );
    if (!Array.isArray(result) || result.length !== 4 || !result.every(Number.isFinite)) {
      throw new TypeError(`Unexpected throttler script result: ${JSON.stringify(result)}`);
    }
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = result as number[];
    return {
      totalHits,
      // The throttler works in seconds; Redis answers in milliseconds.
      timeToExpire: Math.ceil(timeToExpire / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpire / 1000),
    };
  }

  onModuleDestroy(): void {
    if (this.ownsConnection) {
      this.redis.disconnect(false);
    }
  }
}
