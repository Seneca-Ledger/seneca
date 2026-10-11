import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import type { ChatMessage } from './build-prompt';

export interface ChatSummary {
  id: string;
  title: string;
  modelId: string;
  updatedAt: string;
}

export interface ChatTranscript extends ChatSummary {
  messages: Array<{
    id: string;
    role: ChatMessage['role'] | 'tool';
    content: string;
    actionPayload?: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export async function listChats(): Promise<ChatSummary[]> {
  return apiQueryDecoded({ url: '/ai-analysis/chats', contract: 'AiChatList' });
}

export async function createChat(modelId: string, firstQuestion: string): Promise<ChatSummary> {
  const response = await apiClient.post<ChatSummary>('/ai-analysis/chats', {
    modelId,
    firstQuestion,
  } satisfies ContractInput<'CreateAiChatBody'>);
  return response.data;
}

export async function getChat(id: string): Promise<ChatTranscript> {
  return apiQueryDecoded({ url: `/ai-analysis/chats/${id}`, contract: 'AiChatTranscript' });
}

export async function appendMessage(
  chatId: string,
  role: ChatMessage['role'] | 'tool',
  content: string,
  actionPayload?: Record<string, unknown>,
): Promise<void> {
  await apiClient.post(`/ai-analysis/chats/${chatId}/messages`, {
    role,
    content,
    ...(actionPayload ? { actionPayload } : {}),
  } satisfies ContractInput<'AppendAiChatMessageBody'>);
}

export async function deleteChat(id: string): Promise<void> {
  await apiClient.delete(`/ai-analysis/chats/${id}`);
}
