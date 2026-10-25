import type Redis from 'ioredis';
import { RedisThrottlerStorage } from '@/common/services/redis-throttler-storage.service';

const fakeRedis = (result: unknown) => {
  const redis = { eval: jest.fn().mockResolvedValue(result), disconnect: jest.fn() };
  return redis as unknown as Redis & { eval: jest.Mock; disconnect: jest.Mock };
};

describe('RedisThrottlerStorage', () => {
  it('keeps both keys of one throttler under one hash tag', async () => {
    const redis = fakeRedis([1, 60000, 0, 0]);

    await new RedisThrottlerStorage(redis).increment('ip-key', 60000, 5, 60000, 'default');

    const [, keyCount, hitKey, blockKey, ttl, limit, blockDuration] = redis.eval.mock.calls[0];
    expect(keyCount).toBe(2);
    expect(hitKey).toBe('{ip-key:default}:hits');
    expect(blockKey).toBe('{ip-key:default}:blocked');
    expect([ttl, limit, blockDuration]).toEqual([60000, 5, 60000]);
  });

  it('answers in seconds, rounding the milliseconds Redis gives up', async () => {
    const redis = fakeRedis([6, 1500, 1, 30001]);

    const record = await new RedisThrottlerStorage(redis).increment('k', 60000, 5, 60000, 't');

    expect(record).toEqual({
      totalHits: 6,
      timeToExpire: 2,
      isBlocked: true,
      timeToBlockExpire: 31,
    });
  });

  it('refuses a script result it does not understand', async () => {
    const storage = new RedisThrottlerStorage(fakeRedis(['1', 60000, 0, 0]));

    await expect(storage.increment('k', 60000, 5, 60000, 't')).rejects.toThrow(TypeError);
  });

  it('leaves a connection it was handed open on shutdown', () => {
    const redis = fakeRedis([1, 1, 0, 0]);

    new RedisThrottlerStorage(redis).onModuleDestroy();

    expect(redis.disconnect).not.toHaveBeenCalled();
  });
});
