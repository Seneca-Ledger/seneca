import type { PromptMessage } from '@/app/(main)/ai-analysis/chat/build-prompt';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
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
  return apiQueryDecoded({
    url: '/ai-analysis/completions/status',
    contract: 'ChatCompletionStatus',
  });
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
      const response = await apiClient.post('/ai-analysis/completions', {
        messages,
      } satisfies ContractInput<'CreateChatCompletionBody'>);
      const result = await checkContract(
        'ChatCompletionResult',
        response.data,
        '/ai-analysis/completions',
      );
      // The provider may report no usage at all: both counts are null then.
      if (result.usage.promptTokens !== null || result.usage.completionTokens !== null) {
        onUsage?.(result.usage);
      }
      return result.content;
    },
  };
}
