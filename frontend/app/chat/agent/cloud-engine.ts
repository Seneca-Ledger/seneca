import type { PromptMessage } from '@/app/(main)/ai-analysis/chat/build-prompt';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import type { AgentEngine } from './useAgentChat';

/** Which settings answered for this chat: the member's own key, or the workspace's. */
export type CloudProviderSource = 'personal' | 'workspace' | 'env' | 'disabled';

export interface CloudProviderStatus {
  configured: boolean;
  model: string | null;
  source: CloudProviderSource;
}

/** Tokens the provider billed for one completion; absent when it reports none. */
export interface CloudUsage {
  promptTokens: number | null;
  completionTokens: number | null;
}

/** Whether chat mode has a BYO-key cloud model for this member. */
export async function fetchCloudProviderStatus(): Promise<CloudProviderStatus> {
  const response = await apiClient.get<CloudProviderStatus>('/ai-analysis/completions/status');
  return response.data;
}

/**
 * AgentEngine backed by the cloud provider resolved for this member — their own
 * key when they configured one, otherwise the workspace's. Requests leave the
 * instance, so the chat page names the model and the key behind them.
 *
 * `onUsage` fires once per completion, including the automatic tool rounds the
 * agent loop runs, so the counter it feeds reflects what the key is actually
 * charged for rather than one line per visible reply.
 */
export function createCloudAgentEngine(onUsage?: (usage: CloudUsage) => void): AgentEngine {
  return {
    async complete(messages: PromptMessage[]): Promise<string> {
      const response = await apiClient.post<{ content: string; usage?: CloudUsage }>(
        '/ai-analysis/completions',
        { messages } satisfies ContractInput<'CreateChatCompletionBody'>,
      );
      if (response.data.usage) {
        onUsage?.(response.data.usage);
      }
      return response.data.content;
    },
  };
}
