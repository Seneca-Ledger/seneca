const mockIsAiEnabled = jest.fn().mockReturnValue(true);
const mockIsAiCircuitOpen = jest.fn().mockReturnValue(false);
const mockRecordAiSuccess = jest.fn();
const mockRecordAiFailure = jest.fn();
const mockWithAiConcurrency = jest.fn().mockImplementation(fn => fn());

jest.mock('@/modules/parsing/helpers/ai-runtime.util', () => ({
  isAiEnabled: (...args: unknown[]) => mockIsAiEnabled(...args),
  isAiCircuitOpen: (...args: unknown[]) => mockIsAiCircuitOpen(...args),
  recordAiSuccess: (...args: unknown[]) => mockRecordAiSuccess(...args),
  recordAiFailure: (...args: unknown[]) => mockRecordAiFailure(...args),
  withAiConcurrency: (...args: unknown[]) => mockWithAiConcurrency(...args),
}));

import { BaseAiHelper } from '@/common/helpers/base-ai.helper';

class TestAiHelper extends BaseAiHelper {
  async call(payload: string) {
    return this.generateJsonContent([{ role: 'user', parts: [{ text: payload }] }], {
      timeoutMs: 123,
      retries: 1,
      baseDelayMs: 10,
      maxDelayMs: 20,
    });
  }
}

describe('BaseAiHelper', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_BASE_URL = 'http://localhost:11434';
    process.env.AI_MODEL = 'llama3.1';
    global.fetch = jest.fn();
    mockIsAiEnabled.mockReturnValue(true);
    mockIsAiCircuitOpen.mockReturnValue(false);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.AI_BASE_URL = undefined;
    process.env.AI_MODEL = undefined;
  });

  it('reports availability when model exists and AI is enabled', () => {
    const helper = new TestAiHelper('test-key');

    expect(helper.isAvailable()).toBe(true);
  });

  it('returns null when circuit breaker is open', async () => {
    mockIsAiCircuitOpen.mockReturnValue(true);
    const helper = new TestAiHelper('test-key');

    await expect(helper.call('hello')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('records success and returns text content for successful request', async () => {
    jest.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
    } as Response);

    const helper = new TestAiHelper('test-key');

    await expect(helper.call('hello')).resolves.toBe('{"ok":true}');
    expect(mockRecordAiSuccess).toHaveBeenCalled();
  });

  it('aborts a request that runs past the timeout and frees its slot', async () => {
    let signal: AbortSignal | undefined;
    jest.mocked(global.fetch).mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener('abort', () => reject(signal?.reason));
        }),
    );

    const helper = new TestAiHelper('test-key');

    await expect(helper.call('hello')).resolves.toBeNull();
    expect(signal?.aborted).toBe(true);
    // One retry after the timeout, then the failure is recorded once.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(mockRecordAiFailure).toHaveBeenCalledTimes(1);
  });

  it('retries a busy endpoint (429/5xx) but not a rejected request', async () => {
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"ok":1}' } }] }),
      } as Response);
    await expect(new TestAiHelper('test-key').call('hello')).resolves.toBe('{"ok":1}');

    jest.mocked(global.fetch).mockReset().mockResolvedValue({ ok: false, status: 400 } as Response);
    await expect(new TestAiHelper('test-key').call('hello')).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('records failure when response text is empty', async () => {
    jest.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    } as Response);

    const helper = new TestAiHelper('test-key');

    await expect(helper.call('hello')).resolves.toBeNull();
    expect(mockRecordAiFailure).toHaveBeenCalled();
  });
});
