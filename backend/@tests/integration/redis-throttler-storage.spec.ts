/**
 * Integration test — the throttler's counters against a real Redis (REDIS_URL).
 *
 * Every API instance shares these counters, so the Lua script is the whole
 * contract: count hits in a window, block past the limit, lift the block when it
 * runs out and start counting again.
 */
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { RedisThrottlerStorage } from '../../src/common/services/redis-throttler-storage.service';

const redisUrl = process.env.REDIS_URL;
const describeWithRedis = redisUrl ? describe : describe.skip;

describeWithRedis('RedisThrottlerStorage (real Redis)', () => {
  let redis: Redis;
  let storage: RedisThrottlerStorage;

  beforeAll(() => {
    redis = new Redis(redisUrl as string);
    storage = new RedisThrottlerStorage(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('counts hits in one window and blocks past the limit', async () => {
    const key = `throttler-test-${randomUUID()}`;

    const first = await storage.increment(key, 60_000, 2, 60_000, 'default');
    const second = await storage.increment(key, 60_000, 2, 60_000, 'default');
    const third = await storage.increment(key, 60_000, 2, 60_000, 'default');

    expect([first.totalHits, second.totalHits, third.totalHits]).toEqual([1, 2, 3]);
    expect(first.isBlocked).toBe(false);
    expect(second.isBlocked).toBe(false);
    expect(third.isBlocked).toBe(true);
    expect(third.timeToBlockExpire).toBe(60);
    expect(first.timeToExpire).toBe(60);
  });

  it('keeps throttlers apart under the same key', async () => {
    const key = `throttler-test-${randomUUID()}`;

    await storage.increment(key, 60_000, 1, 60_000, 'login');
    const other = await storage.increment(key, 60_000, 1, 60_000, 'default');

    expect(other.totalHits).toBe(1);
    expect(other.isBlocked).toBe(false);
  });

  it('lifts an expired block and starts counting again', async () => {
    const key = `throttler-test-${randomUUID()}`;

    await storage.increment(key, 60_000, 1, 200, 'default');
    const blocked = await storage.increment(key, 60_000, 1, 200, 'default');
    await new Promise(resolve => setTimeout(resolve, 300));
    const after = await storage.increment(key, 60_000, 1, 200, 'default');

    expect(blocked.isBlocked).toBe(true);
    expect(after.isBlocked).toBe(false);
    expect(after.totalHits).toBe(1);
  });

  it('does not count requests made while blocked', async () => {
    const key = `throttler-test-${randomUUID()}`;

    await storage.increment(key, 60_000, 1, 60_000, 'default');
    const blocked = await storage.increment(key, 60_000, 1, 60_000, 'default');
    const stillBlocked = await storage.increment(key, 60_000, 1, 60_000, 'default');

    expect(blocked.totalHits).toBe(2);
    expect(stillBlocked.isBlocked).toBe(true);
    expect(stillBlocked.totalHits).toBe(0);
  });

  it('refuses past the limit without a block when the block duration is zero', async () => {
    const key = `throttler-test-${randomUUID()}`;

    await storage.increment(key, 60_000, 1, 0, 'default');
    const over = await storage.increment(key, 60_000, 1, 0, 'default');
    const again = await storage.increment(key, 60_000, 1, 0, 'default');

    expect(over.isBlocked).toBe(true);
    expect(again.totalHits).toBe(3);
    expect(await redis.exists(`{${key}:default}:blocked`)).toBe(0);
  });
});
