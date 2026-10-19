import { fetchJsonWithRetry, isTransient, retryWaitMs } from '@/modules/crypto/retry.util';

function response(status: number, headers: Record<string, string> = {}): Response {
  return { status, headers: new Headers(headers) } as unknown as Response;
}

describe('isTransient', () => {
  it('treats a rate limit as worth asking again', () => {
    expect(isTransient(response(429))).toBe(true);
  });

  it('treats a server error as worth asking again', () => {
    expect(isTransient(response(503))).toBe(true);
  });

  it('treats no response at all as worth asking again', () => {
    expect(isTransient(null)).toBe(true);
  });

  it('treats an ordinary 4xx as an answer, not a hiccup', () => {
    expect(isTransient(response(404))).toBe(false);
    expect(isTransient(response(400))).toBe(false);
  });
});

describe('retryWaitMs', () => {
  it('honours a short Retry-After exactly', () => {
    expect(retryWaitMs(response(429, { 'retry-after': '3' }), 0)).toBe(3_000);
  });

  it('refuses to wait out a long Retry-After', () => {
    // CoinGecko's free tier answers 429 with a full minute; holding an HTTP
    // request open that long is worse than failing and letting the next sync run.
    expect(retryWaitMs(response(429, { 'retry-after': '60' }), 0)).toBeNull();
  });

  it('backs off progressively when no delay is named', () => {
    expect(retryWaitMs(response(503), 0)).toBe(1_000);
    expect(retryWaitMs(response(503), 1)).toBe(4_000);
  });

  it('stops once the backoff schedule runs out', () => {
    expect(retryWaitMs(response(503), 2)).toBeNull();
  });

  it('ignores a Retry-After it cannot read', () => {
    expect(retryWaitMs(response(429, { 'retry-after': 'Wed, 01 Jan 2026 00:00:00 GMT' }), 0)).toBe(
      1_000,
    );
  });
});

describe('fetchJsonWithRetry', () => {
  const originalFetch = global.fetch;
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('aborts an attempt that hangs past 20 s and asks again', async () => {
    const signals: AbortSignal[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init.signal as AbortSignal;
            signals.push(signal);
            signal.addEventListener('abort', () => reject(signal.reason));
          }),
      )
      .mockResolvedValueOnce(json({ ok: true })) as unknown as typeof fetch;
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

    const pending = fetchJsonWithRetry('https://rpc.example', {}, 'Test RPC', () => {});
    await jest.advanceTimersByTimeAsync(20_000 + 1_000);

    await expect(pending).resolves.toEqual({ ok: true });
    expect(signals[0].aborted).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('names the provider in what it throws', async () => {
    global.fetch = jest.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchJsonWithRetry('https://x', {}, 'TronGrid', () => {})).rejects.toThrow(
      'TronGrid returned HTTP 404',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    global.fetch = jest.fn(async () => new Response('<html>')) as unknown as typeof fetch;
    await expect(fetchJsonWithRetry('https://x', {}, 'TronGrid', () => {})).rejects.toThrow(
      'TronGrid sent an unreadable answer',
    );
  });
});
