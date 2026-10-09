import apiClient from '@/app/lib/api';
import type { Client } from '@/app/lib/invoices-api';

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
  async create(payload: CreateCreditNoteInput): Promise<CreditNote> {
    const response = await apiClient.post<CreditNote>('/credit-notes', payload);
    return unwrapData(response);
  },

  async forInvoice(invoiceId: string): Promise<CreditNote[]> {
    const response = await apiClient.get<CreditNote[]>(`/invoices/${invoiceId}/credit-notes`);
    return unwrapData(response);
  },

  /** Voids it: the money goes back on the invoices and the entry is reversed. */
  async void(id: string): Promise<CreditNote> {
    const response = await apiClient.delete<CreditNote>(`/credit-notes/${id}`);
    return unwrapData(response);
  },

  async downloadPdf(id: string, fileName: string): Promise<void> {
    const response = await apiClient.get<Blob>(`/credit-notes/${id}/pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
