import { AttemptTimedOut, attemptWithRetry } from '@/common/effect/attempt-with-retry';

const policy = { timeoutMs: 50, timeoutMessage: 'took too long', retries: 2, baseDelayMs: 1, maxDelayMs: 5 };

describe('attemptWithRetry', () => {
  it('returns the first successful attempt', async () => {
    const attempt = vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce('ok');
    await expect(
      attemptWithRetry(attempt, { ...policy, retryable: error => (error as Error).message === 'busy' }),
    ).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('rethrows what the attempt threw when it is not worth retrying', async () => {
    const failure = new RangeError('bad request');
    const attempt = vi.fn().mockRejectedValue(failure);
    await expect(attemptWithRetry(attempt, policy)).rejects.toBe(failure);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('aborts each attempt at its timeout and gives up after the retries', async () => {
    const signals: AbortSignal[] = [];
    const attempt = vi.fn(
      (signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          signals.push(signal);
          signal.addEventListener('abort', () => reject(signal.reason));
        }),
    );

    await expect(attemptWithRetry(attempt, policy)).rejects.toEqual(new AttemptTimedOut('took too long'));
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(signals.every(signal => signal.aborted)).toBe(true);
  });
});
