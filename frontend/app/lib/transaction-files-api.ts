import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export interface TransactionTag {
  id: string;
  name: string;
  color: string | null;
}

export interface TransactionAttachment {
  id: string;
  transactionId: string;
  fileName: string;
  mimeType: string;
  fileSize: number | string;
  createdAt: string;
}

const unwrap = <T>(response: { data: unknown }): T => {
  const payload = response.data as { data?: T } | T;
  return (payload as { data?: T })?.data ?? (payload as T);
};

export const transactionFilesApi = {
  /** The workspace-wide tag vocabulary, shared with statements and files. */
  async listWorkspaceTags(): Promise<TransactionTag[]> {
    return apiQueryDecoded({ url: '/storage/tags', contract: 'StorageTagList' });
  },

  async getTags(transactionId: string): Promise<TransactionTag[]> {
    return apiQueryDecoded({
      url: `/transactions/${transactionId}/tags`,
      contract: 'StorageTagList',
    });
  },

  /** Sends the complete desired tag set — the server replaces, it does not merge. */
  async setTags(transactionId: string, tagIds: string[]): Promise<TransactionTag[]> {
    const response = await apiClient.put(`/transactions/${transactionId}/tags`, {
      tagIds,
    } satisfies ContractInput<'SetTransactionTagsBody'>);
    return checkContract('StorageTagList', response.data, '/transactions/:id/tags');
  },

  async listAttachments(transactionId: string): Promise<TransactionAttachment[]> {
    return apiQueryDecoded({
      url: `/transactions/${transactionId}/attachments`,
      contract: 'TransactionAttachmentList',
    });
  },

  async uploadAttachment(transactionId: string, file: File): Promise<TransactionAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/transactions/${transactionId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap<TransactionAttachment>(response);
  },

  async downloadAttachment(attachmentId: string): Promise<Blob> {
    const response = await apiClient.get(`/transactions/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    await apiClient.delete(`/transactions/attachments/${attachmentId}`);
  },
};
