import { apiBaseUrl } from '@/app/lib/api';

export { apiBaseUrl };

export function getFileEndpoint(source: 'statement' | 'receipt', fileId: string): string {
  if (source === 'receipt') {
    return `${apiBaseUrl}/receipts/${fileId}/file`;
  }

  return `${apiBaseUrl}/statements/${fileId}/file`;
}
