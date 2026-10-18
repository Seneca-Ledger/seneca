import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import type { PeppolLookup, PeppolTransmission } from '@/app/lib/contracts';
import { checkContract } from '@/app/lib/query-fn-schema';

export type PeppolDocumentKind = 'invoice' | 'credit_note';

const basePath = (kind: PeppolDocumentKind, id: string) =>
  `${kind === 'invoice' ? '/invoices' : '/credit-notes'}/${id}/peppol`;

/** Peppol through the workspace's own access point account (Integrations → Peppol). */
export const peppolApi = {
  /** Sends an issued invoice or credit note; the format is the one the recipient registered. */
  async send(kind: PeppolDocumentKind, id: string): Promise<PeppolTransmission> {
    const url = basePath(kind, id);
    const response = await apiClient.post(url);
    return checkContract('PeppolTransmission', response.data, url);
  },

  /** Whether a Peppol id is on the network, and which of Lumio's formats it takes. */
  async lookup(peppolId: string): Promise<PeppolLookup> {
    const response = await apiClient.post('/peppol/lookup', { peppolId });
    return checkContract('PeppolLookup', response.data, '/peppol/lookup');
  },

  /** The XML exactly as it went over Peppol. */
  async downloadSent(transmissionId: string, fileName: string): Promise<void> {
    const response = await apiClient.get(`/peppol/transmissions/${transmissionId}/document`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(
      new Blob([blobOf(response)], { type: 'application/xml' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const peppolTransmissionsUrl = basePath;
