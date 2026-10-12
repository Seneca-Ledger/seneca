import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import apiClient from '@/app/lib/api';
import { createCloudAgentEngine, fetchCloudProviderStatus } from './cloud-engine';

describe('cloud engine', () => {
  it('fetches provider status', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { configured: true, model: 'claude-opus-5', source: 'personal' },
    });

    await expect(fetchCloudProviderStatus()).resolves.toEqual({
      configured: true,
      model: 'claude-opus-5',
      source: 'personal',
    });
    expect(apiClient.get).toHaveBeenCalledWith('/ai-analysis/completions/status', expect.anything());
  });

  it('completes via the backend proxy', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: {
              content: '{"reply":"ок","action":null}',
              model: 'claude-opus-5',
              usage: { promptTokens: null, completionTokens: null },
            },
    });

    const engine = createCloudAgentEngine();
    const messages = [{ role: 'user' as const, content: 'Привет' }];

    await expect(engine.complete(messages)).resolves.toBe('{"reply":"ок","action":null}');
    expect(apiClient.post).toHaveBeenCalledWith('/ai-analysis/completions', { messages });
  });

  it('reports usage once per completion', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: {
              content: 'ok',
              model: 'claude-opus-5',
              usage: { promptTokens: 120, completionTokens: 30 },
            },
    });
    const onUsage = vi.fn();

    await createCloudAgentEngine(onUsage).complete([{ role: 'user', content: 'Привет' }]);

    expect(onUsage).toHaveBeenCalledWith({ promptTokens: 120, completionTokens: 30 });
  });

  it('stays quiet when the provider reports no usage', async () => {
        (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { content: 'ok', model: 'claude-opus-5', usage: { promptTokens: null, completionTokens: null } },
        });
    const onUsage = vi.fn();

    await createCloudAgentEngine(onUsage).complete([{ role: 'user', content: 'Привет' }]);

    expect(onUsage).not.toHaveBeenCalled();
  });
});
