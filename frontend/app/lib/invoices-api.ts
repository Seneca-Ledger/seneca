import apiClient from '@/app/lib/api';

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';
export type InvoiceRecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  email: string | null;
  billingAddress: string | null;
  taxId: string | null;
  currency: string;
  /** Language the documents sent to this client are written in. */
  locale: string | null;
  /** False leaves this client out of reminder emails. */
  remindersEnabled: boolean;
  /** "Net 30" for this client; null follows the workspace term. */
  paymentTermsDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientInput {
  name: string;
  email?: string;
  billingAddress?: string;
  taxId?: string;
  currency?: string;
  locale?: string;
  remindersEnabled?: boolean;
  paymentTermsDays?: number;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxRateId: string | null;
  categoryId: string | null;
  sortOrder: number;
}

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateId?: string;
  categoryId?: string;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  clientId: string;
  client?: Client;
  invoiceNumber: string | null;
  /** True when the line prices already contain their tax. */
  pricesIncludeTax: boolean;
  /** When the client first opened the share link; null while unopened. */
  viewedAt: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number | string;
  taxTotal: number | string;
  total: number | string;
  /** Paid so far and still owed — derived from the payments against the bill. */
  amountPaid?: number;
  /** Taken back by credit notes: not owed, and never paid. */
  amountCredited?: number;
  amountDue?: number;
  notes: string | null;
  payableId: string | null;
  journalEntryId: string | null;
  isRecurring: boolean;
  recurrenceInterval: InvoiceRecurrenceInterval | null;
  nextIssueDate: string | null;
  recurrenceEndDate: string | null;
  lineItems?: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  pricesIncludeTax?: boolean;
  lineItems: InvoiceLineItemInput[];
  recurrenceInterval?: InvoiceRecurrenceInterval;
  recurrenceEndDate?: string;
}

export type UpdateInvoiceInput = Partial<CreateInvoiceInput>;

/** One attempt to put the invoice in front of its client. */
export interface InvoiceDelivery {
  id: string;
  invoiceId: string;
  channel: 'email';
  recipient: string;
  status: 'sent' | 'skipped' | 'failed';
  subject: string | null;
  error: string | null;
  createdAt: string;
}

export interface InvoiceSettings {
  prefix: string;
  remindersEnabled: boolean;
  /** Days from the due date: negative before it, positive after. */
  reminderOffsets: number[];
  paymentTermsDays: number;
  lateFeePercent: number;
}

export type InvoiceSettingsInput = Partial<InvoiceSettings>;

/** What a late fee would come to for a client, per currency. */
export interface LateFeeQuote {
  percent: number;
  amounts: Array<{ currency: string; overdue: number; fee: number }>;
}

export interface AgeingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
  count: number;
}

export interface AgeingRow extends AgeingBuckets {
  clientId: string;
  clientName: string;
  currency: string;
  oldestDays: number;
}

export interface AgeingReport {
  rows: AgeingRow[];
  totals: Array<AgeingBuckets & { currency: string }>;
}

export interface SendInvoiceEmailInput {
  to?: string;
  subject?: string;
  message?: string;
}

export interface ListInvoicesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  clientId?: string;
}

export interface ListInvoicesResponse {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const unwrapData = <T>(response: { data: T }) => response.data;

export const clientsApi = {
  async list(): Promise<Client[]> {
    const response = await apiClient.get<Client[]>('/clients');
    return unwrapData(response);
  },
  async getOne(id: string): Promise<Client> {
    const response = await apiClient.get<Client>(`/clients/${id}`);
    return unwrapData(response);
  },
  async create(payload: CreateClientInput): Promise<Client> {
    const response = await apiClient.post<Client>('/clients', payload);
    return unwrapData(response);
  },
  async update(id: string, payload: UpdateClientInput): Promise<Client> {
    const response = await apiClient.put<Client>(`/clients/${id}`, payload);
    return unwrapData(response);
  },
  async delete(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/clients/${id}`);
    return unwrapData(response);
  },
};

export const invoicesApi = {
  async list(params: ListInvoicesParams = {}): Promise<ListInvoicesResponse> {
    const response = await apiClient.get<ListInvoicesResponse>('/invoices', { params });
    return unwrapData(response);
  },
  async getOne(id: string): Promise<Invoice> {
    const response = await apiClient.get<Invoice>(`/invoices/${id}`);
    return unwrapData(response);
  },
  async create(payload: CreateInvoiceInput): Promise<Invoice> {
    const response = await apiClient.post<Invoice>('/invoices', payload);
    return unwrapData(response);
  },
  async update(id: string, payload: UpdateInvoiceInput): Promise<Invoice> {
    const response = await apiClient.put<Invoice>(`/invoices/${id}`, payload);
    return unwrapData(response);
  },
  async send(id: string): Promise<Invoice> {
    const response = await apiClient.put<Invoice>(`/invoices/${id}/send`);
    return unwrapData(response);
  },
  async void(id: string): Promise<Invoice> {
    const response = await apiClient.put<Invoice>(`/invoices/${id}/void`);
    return unwrapData(response);
  },
  /** Emails the client a reminder about a sent or overdue invoice. */
  async remind(id: string): Promise<{ sent: boolean; to: string; reminderCount: number }> {
    const response = await apiClient.post<{ sent: boolean; to: string; reminderCount: number }>(
      `/invoices/${id}/remind`,
    );
    return unwrapData(response);
  },
  async delete(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/invoices/${id}`);
    return unwrapData(response);
  },
  async ageing(): Promise<AgeingReport> {
    const response = await apiClient.get<AgeingReport>('/invoices/ageing');
    return unwrapData(response);
  },
  async lateFeeQuote(clientId: string): Promise<LateFeeQuote> {
    const response = await apiClient.get<LateFeeQuote>(`/invoices/clients/${clientId}/late-fee`);
    return unwrapData(response);
  },
  async getSettings(): Promise<InvoiceSettings> {
    const response = await apiClient.get<InvoiceSettings>('/invoices/settings');
    return unwrapData(response);
  },
  async updateSettings(payload: InvoiceSettingsInput): Promise<InvoiceSettings> {
    const response = await apiClient.put<InvoiceSettings>('/invoices/settings', payload);
    return unwrapData(response);
  },
  async sendEmail(id: string, payload: SendInvoiceEmailInput = {}): Promise<InvoiceDelivery> {
    const response = await apiClient.post<InvoiceDelivery>(`/invoices/${id}/deliveries`, payload);
    return unwrapData(response);
  },
  async deliveries(id: string): Promise<InvoiceDelivery[]> {
    const response = await apiClient.get<InvoiceDelivery[]>(`/invoices/${id}/deliveries`);
    return unwrapData(response);
  },
  /** Opens the draft as the client would see it; nothing is stored, no number taken. */
  async openPreview(id: string): Promise<void> {
    const response = await apiClient.get<Blob>(`/invoices/${id}/preview`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    // Revoked late: the new tab needs the url to still resolve when it loads.
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  },
  async downloadPdf(id: string, fileName: string): Promise<void> {
    const response = await apiClient.get<Blob>(`/invoices/${id}/pdf`, { responseType: 'blob' });
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
