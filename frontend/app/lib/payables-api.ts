import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import type {
  PayableDirection,
  PayableListPage,
  PayablePayment,
  Payable as PayableRow,
  PayableSource,
  PayableStatus,
  PayablesSummary,
  PaymentCandidate,
} from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export type {
  PayableDirection,
  PayableListPage as ListPayablesResponse,
  PayablePayment,
  PayableSource,
  PayableStatus,
  PayablesSummary,
  PaymentCandidate,
} from '@/app/lib/contracts';

export type PayablesExportFormat = 'csv' | 'excel';
/**
 * A bill as the pages hold it. Reads send `amount` and `paidAmount` as decimal
 * strings; the payment endpoints answer with the saved row, where `paidAmount`
 * has just been recomputed as a number. Both pass through `Number()` here.
 */
export type Payable = Omit<PayableRow, 'amount' | 'paidAmount'> & {
  amount: number | string;
  paidAmount: number | string;
};

export type ListPayablesParams = ContractInput<'PayablesQuery'>;

export interface CreatePayableInput {
  direction?: PayableDirection;
  vendor: string;
  amount: number;
  currency?: string;
  dueDate?: string;
  status?: PayableStatus;
  linkedTransactionId?: string;
  source?: PayableSource;
  isRecurring?: boolean;
  comment?: string;
  statementId?: string;
  tagIds?: string[];
}

export interface UpdatePayableInput {
  vendor?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  status?: PayableStatus;
  linkedTransactionId?: string | null;
  source?: PayableSource;
  isRecurring?: boolean;
  comment?: string | null;
  statementId?: string | null;
  /** The whole new tag set; left out keeps the tags. */
  tagIds?: string[];
}

export interface MarkPayablePaidInput {
  /** An existing transaction that settled the bill. */
  linkedTransactionId?: string;
  /** Paid in cash: the server records the payment as a transaction of this wallet. */
  payFromWalletId?: string;
  /** Cash handed over in person, kept in no wallet. */
  inHand?: boolean;
  paidOn?: string;
  categoryId?: string;
}

export interface AddPayablePaymentInput {
  amount: number;
  feeAmount?: number;
  paidOn?: string;
  /** An existing transaction this payment came from. */
  linkedTransactionId?: string;
  /** Paid in cash: the server records the payment as a transaction of this wallet. */
  payFromWalletId?: string;
  /** Cash handed over in person, kept in no wallet. */
  inHand?: boolean;
  categoryId?: string;
  comment?: string;
}

/** Where the money of a payment marked without it went: a bank row, or a wallet. */
export interface BookPayablePaymentInput {
  linkedTransactionId?: string;
  payFromWalletId?: string;
  inHand?: boolean;
  categoryId?: string;
}

/** One transaction spread over several bills. */
export interface AllocateTransactionInput {
  transactionId: string;
  allocations: Array<{ payableId: string; amount: number; feeAmount?: number }>;
  paidOn?: string;
  comment?: string;
}

/** Which bills one transaction probably covers. */
export interface AllocationSuggestion {
  transactionId: string;
  available: number;
  currency: string;
  exact: boolean;
  unallocated: number;
  allocations: Array<{
    payableId: string;
    vendor: string;
    dueDate: string | null;
    outstanding: number;
    amount: number;
    partial: boolean;
  }>;
}

export interface ExportPayablesParams extends ListPayablesParams {
  format: PayablesExportFormat;
}

export interface ExportPayablesResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}

const FALLBACK_EXPORT_FILE_NAME = 'payables-export';

const unwrapData = <T>(response: { data: T }) => response.data;

const parseContentDispositionFilename = (headerValue?: string): string => {
  if (!headerValue) return FALLBACK_EXPORT_FILE_NAME;

  const utfMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || FALLBACK_EXPORT_FILE_NAME;
};

export const payablesApi = {
  async list(params: ListPayablesParams = {}): Promise<PayableListPage> {
    const response = await apiClient.get('/payables', { params });
    return checkContract('PayableListPage', unwrapData(response), '/payables');
  },

  async getOne(id: string): Promise<Payable> {
    const response = await apiClient.get(`/payables/${id}`);
    return checkContract('Payable', unwrapData(response), '/payables/:id');
  },

  async getSummary(direction?: PayableDirection): Promise<PayablesSummary> {
    const response = await apiClient.get('/payables/summary', {
      params: direction ? { direction } : undefined,
    });
    return checkContract('PayablesSummary', unwrapData(response), '/payables/summary');
  },

  async create(payload: CreatePayableInput): Promise<Payable> {
    const response = await apiClient.post(
      '/payables',
      payload satisfies ContractInput<'CreatePayableBody'>,
    );
    return checkContract('Payable', unwrapData(response), '/payables');
  },

  async update(id: string, payload: UpdatePayableInput): Promise<Payable> {
    const response = await apiClient.put(
      `/payables/${id}`,
      payload satisfies ContractInput<'UpdatePayableBody'>,
    );
    return checkContract('Payable', unwrapData(response), '/payables/:id');
  },

  async paymentCandidates(id: string): Promise<PaymentCandidate[]> {
    const response = await apiClient.get(`/payables/${id}/payment-candidates`);
    return checkContract(
      'PaymentCandidateList',
      unwrapData(response),
      '/payables/:id/payment-candidates',
    );
  },

  async payments(id: string): Promise<PayablePayment[]> {
    const response = await apiClient.get(`/payables/${id}/payments`);
    return checkContract('PayablePaymentList', unwrapData(response), '/payables/:id/payments');
  },

  async addPayment(id: string, payload: AddPayablePaymentInput): Promise<Payable> {
    const response = await apiClient.post(
      `/payables/${id}/payments`,
      payload satisfies ContractInput<'AddPayablePaymentBody'>,
    );
    return checkContract('Payable', unwrapData(response), '/payables/:id/payments');
  },

  async bookPayment(
    id: string,
    paymentId: string,
    payload: BookPayablePaymentInput,
  ): Promise<Payable> {
    const response = await apiClient.post(
      `/payables/${id}/payments/${paymentId}/book`,
      payload satisfies ContractInput<'BookPayablePaymentBody'>,
    );
    return checkContract('Payable', unwrapData(response), '/payables/:id/payments/:paymentId/book');
  },

  async removePayment(id: string, paymentId: string): Promise<Payable> {
    const response = await apiClient.delete(`/payables/${id}/payments/${paymentId}`);
    return checkContract('Payable', unwrapData(response), '/payables/:id/payments/:paymentId');
  },

  async allocate(payload: AllocateTransactionInput): Promise<Payable[]> {
    const response = await apiClient.post(
      '/payables/allocate',
      payload satisfies ContractInput<'AllocateTransactionBody'>,
    );
    return checkContract('PayableList', unwrapData(response), '/payables/allocate');
  },

  async allocationSuggestion(transactionId: string): Promise<AllocationSuggestion> {
    return apiQueryDecoded({
      url: `/payables/allocation-suggestion/${transactionId}`,
      contract: 'AllocationSuggestion',
    });
  },

  async markAsPaid(id: string, payload: MarkPayablePaidInput = {}): Promise<Payable> {
    const response = await apiClient.put(
      `/payables/${id}/mark-paid`,
      payload satisfies ContractInput<'MarkPayablePaidBody'>,
    );
    return checkContract('Payable', unwrapData(response), '/payables/:id/mark-paid');
  },

  async archive(id: string): Promise<Payable> {
    const response = await apiClient.put(`/payables/${id}/archive`);
    return checkContract('Payable', unwrapData(response), '/payables/:id/archive');
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/payables/${id}`);
  },

  async exportList(params: ExportPayablesParams): Promise<ExportPayablesResult> {
    const response = await apiClient.post(
      '/payables/export',
      params satisfies ContractInput<'FilterPayablesBody'>,
      {
        responseType: 'blob',
      },
    );

    const blob = blobOf(response);
    return {
      blob,
      fileName: parseContentDispositionFilename(
        response.headers['content-disposition'] as string | undefined,
      ),
      contentType:
        (response.headers['content-type'] as string | undefined) ||
        blob.type ||
        'application/octet-stream',
    };
  },
};
