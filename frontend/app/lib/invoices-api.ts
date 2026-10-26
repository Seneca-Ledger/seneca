import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import type {
  AgeingReport,
  Client,
  Invoice,
  InvoiceDelivery,
  InvoiceListPage,
  InvoiceRecurrenceInterval,
  InvoiceReminderResult,
  InvoiceSettings,
  LateFeeQuote,
  XRechnungCheck,
} from '@/app/lib/contracts';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { checkContract } from '@/app/lib/query-fn-schema';

export type {
  AgeingReport,
  AgeingRow,
  Client,
  Invoice,
  InvoiceDelivery,
  InvoiceLineItem,
  InvoiceListPage as ListInvoicesResponse,
  InvoiceRecurrenceInterval,
  InvoiceSettings,
  InvoiceStatus,
  LateFeeQuote,
} from '@/app/lib/contracts';

export interface CreateClientInput {
  name: string;
  email?: string;
  billingAddress?: string;
  taxId?: string;
  currency?: string;
  locale?: string;
  remindersEnabled?: boolean;
  paymentTermsDays?: number;
  street?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  buyerReference?: string;
  supplyType?: 'goods' | 'services' | null;
  /** Peppol participant id, `scheme:value`; an empty string clears it. */
  peppolId?: string;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateId?: string;
  categoryId?: string;
  unitCode?: string;
  adjustmentPercent?: number;
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
  buyerReference?: string;
  deliveryDate?: string;
}

export type UpdateInvoiceInput = Partial<CreateInvoiceInput>;

export type InvoiceSettingsInput = Partial<InvoiceSettings>;

export interface SendInvoiceEmailInput {
  to?: string;
  subject?: string;
  message?: string;
}

export type ListInvoicesParams = ContractInput<'InvoicesQuery'>;

const unwrapData = <T>(response: { data: T }) => response.data;

export const clientsApi = {
  async list(): Promise<Client[]> {
    const response = await apiClient.get('/clients');
    return checkContract('ClientList', unwrapData(response), '/clients');
  },
  async getOne(id: string): Promise<Client> {
    const response = await apiClient.get(`/clients/${id}`);
    return checkContract('Client', unwrapData(response), '/clients/:id');
  },
  async create(payload: CreateClientInput): Promise<Client> {
    const response = await apiClient.post(
      '/clients',
      payload satisfies ContractInput<'CreateClientBody'>,
    );
    return checkContract('Client', unwrapData(response), '/clients');
  },
  async update(id: string, payload: UpdateClientInput): Promise<Client> {
    const response = await apiClient.put(
      `/clients/${id}`,
      payload satisfies ContractInput<'UpdateClientBody'>,
    );
    return checkContract('Client', unwrapData(response), '/clients/:id');
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/clients/${id}`);
  },
};

export const invoicesApi = {
  async list(params: ListInvoicesParams = {}): Promise<InvoiceListPage> {
    const response = await apiClient.get('/invoices', { params });
    return checkContract('InvoiceListPage', unwrapData(response), '/invoices');
  },
  async getOne(id: string): Promise<Invoice> {
    const response = await apiClient.get(`/invoices/${id}`);
    return checkContract('Invoice', unwrapData(response), '/invoices/:id');
  },
  // A write answers with the bare row: no client, nothing paid or credited yet
  // filled in. The invoice is read back whole, so the page never shows half of it.
  async create(payload: CreateInvoiceInput): Promise<Invoice> {
    const response = await apiClient.post(
      '/invoices',
      payload satisfies ContractInput<'CreateInvoiceBody'>,
    );
    const { id } = await checkContract('InvoiceCreated', unwrapData(response), '/invoices');
    return invoicesApi.getOne(id);
  },
  async update(id: string, payload: UpdateInvoiceInput): Promise<Invoice> {
    await apiClient.put(`/invoices/${id}`, payload satisfies ContractInput<'UpdateInvoiceBody'>);
    return invoicesApi.getOne(id);
  },
  async send(id: string): Promise<Invoice> {
    await apiClient.put(`/invoices/${id}/send`);
    return invoicesApi.getOne(id);
  },
  async void(id: string): Promise<Invoice> {
    await apiClient.put(`/invoices/${id}/void`);
    return invoicesApi.getOne(id);
  },
  /** Emails the client a reminder about a sent or overdue invoice. */
  async remind(id: string): Promise<InvoiceReminderResult> {
    const response = await apiClient.post(`/invoices/${id}/remind`);
    return checkContract('InvoiceReminderResult', unwrapData(response), '/invoices/:id/remind');
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/invoices/${id}`);
  },
  async ageing(): Promise<AgeingReport> {
    const response = await apiClient.get('/invoices/ageing');
    return checkContract('AgeingReport', unwrapData(response), '/invoices/ageing');
  },
  async lateFeeQuote(clientId: string): Promise<LateFeeQuote> {
    const response = await apiClient.get(`/invoices/clients/${clientId}/late-fee`);
    return checkContract('LateFeeQuote', unwrapData(response), '/invoices/clients/:id/late-fee');
  },
  async getSettings(): Promise<InvoiceSettings> {
    const response = await apiClient.get('/invoices/settings');
    return checkContract('InvoiceSettings', unwrapData(response), '/invoices/settings');
  },
  async updateSettings(payload: InvoiceSettingsInput): Promise<InvoiceSettings> {
    const response = await apiClient.put(
      '/invoices/settings',
      payload satisfies ContractInput<'UpdateInvoiceSettingsBody'>,
    );
    return checkContract('InvoiceSettings', unwrapData(response), '/invoices/settings');
  },
  async sendEmail(id: string, payload: SendInvoiceEmailInput = {}): Promise<InvoiceDelivery> {
    const response = await apiClient.post(
      `/invoices/${id}/deliveries`,
      payload satisfies ContractInput<'SendInvoiceEmailBody'>,
    );
    return checkContract('InvoiceDelivery', unwrapData(response), '/invoices/:id/deliveries');
  },
  async deliveries(id: string): Promise<InvoiceDelivery[]> {
    const response = await apiClient.get(`/invoices/${id}/deliveries`);
    return checkContract('InvoiceDeliveryList', unwrapData(response), '/invoices/:id/deliveries');
  },
  /** Opens the draft as the client would see it; nothing is stored, no number taken. */
  async openPreview(id: string): Promise<void> {
    const response = await apiClient.get(`/invoices/${id}/preview`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(
      new Blob([blobOf(response)], { type: 'application/pdf' }),
    );
    window.open(url, '_blank', 'noopener');
    // Revoked late: the new tab needs the url to still resolve when it loads.
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  },
  /** What the invoice, its client or the business profile still lack for an XRechnung. */
  async checkXRechnung(id: string): Promise<XRechnungCheck> {
    const response = await apiClient.get(`/invoices/${id}/xrechnung/check`);
    return checkContract('XRechnungCheck', response.data, '/invoices/:id/xrechnung/check');
  },

  async downloadXRechnung(id: string, fileName: string): Promise<void> {
    const response = await apiClient.get(`/invoices/${id}/xrechnung`, {
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

  async downloadPdf(id: string, fileName: string): Promise<void> {
    const response = await apiClient.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([blobOf(response)]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
