import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import type { XRechnungCheck } from '@/app/lib/contracts';
import type { Client } from '@/app/lib/invoices-api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export type CreditNoteStatus = 'issued' | 'void';

export interface CreditNoteLineItem {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxRateId: string | null;
}

/** How much of a note lands on one invoice. */
export interface CreditNoteApplication {
  id: string;
  invoiceId: string;
  amount: number | string;
}

export interface CreditNote {
  id: string;
  clientId: string;
  client?: Client;
  creditNoteNumber: string | null;
  status: CreditNoteStatus;
  issueDate: string;
  currency: string;
  subtotal: number | string;
  taxTotal: number | string;
  total: number | string;
  reason: string | null;
  journalEntryId: string | null;
  lineItems?: CreditNoteLineItem[];
  applications?: CreditNoteApplication[];
  createdAt: string;
}

export interface CreateCreditNoteInput {
  issueDate?: string;
  reason?: string;
  /** The invoices this note credits; the amount defaults to all that is left. */
  applications: Array<{ invoiceId: string; amount?: number }>;
}

const unwrapData = <T>(response: { data: T }) => response.data;

export const creditNotesApi = {
  async create(payload: CreateCreditNoteInput): Promise<void> {
    await apiClient.post('/credit-notes', payload satisfies ContractInput<'CreateCreditNoteBody'>);
  },

  async forInvoice(invoiceId: string): Promise<CreditNote[]> {
    const response = await apiClient.get(`/invoices/${invoiceId}/credit-notes`);
    return checkContract('CreditNoteList', unwrapData(response), '/invoices/:id/credit-notes');
  },

  /** Voids it: the money goes back on the invoices and the entry is reversed. */
  async void(id: string): Promise<void> {
    await apiClient.delete(`/credit-notes/${id}`);
  },

  async downloadPdf(id: string, fileName: string): Promise<void> {
    const response = await apiClient.get(`/credit-notes/${id}/pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([blobOf(response)]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /** What the credit note, its client or the business profile still lack for an XRechnung. */
  async checkXRechnung(id: string): Promise<XRechnungCheck> {
    const response = await apiClient.get(`/credit-notes/${id}/xrechnung/check`);
    return checkContract('XRechnungCheck', response.data, '/credit-notes/:id/xrechnung/check');
  },

  /** The credit note as an XRechnung of type 381, naming the invoices it corrects. */
  async downloadXRechnung(id: string, fileName: string): Promise<void> {
    const response = await apiClient.get(`/credit-notes/${id}/xrechnung`, {
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
