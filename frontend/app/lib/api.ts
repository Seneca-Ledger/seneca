import axios, { type AxiosResponse } from 'axios';
import type {
  ReceiptLocationSource as ContractReceiptLocationSource,
  ReceiptPlace as ContractReceiptPlace,
  ReceiptRecord as ContractReceiptRecord,
  ReceiptSplitSuggestion as ContractReceiptSplitSuggestion,
  ReceiptTransactionMatch as ContractReceiptTransactionMatch,
  ReceiptApproval,
  ReceiptListPage,
  ReceiptRecordUpdate,
  ReceiptSplitResult,
  ReceiptTransactionMatches,
} from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { CSRF_HEADER, clearCsrfCookie, getCsrfHeaders, getCsrfToken } from './csrf';
import { isPublicPath } from './public-paths';
import { getQueryClient } from './query-client';

type GmailReceiptParsedDataUpdate = {
  amount?: number;
  currency?: string;
  vendor?: string;
  date?: string;
  tax?: number;
  paymentMethod?: string;
  category?: string | null;
  categoryId?: string | null;
  lineItems?: Array<{ description: string; amount: number }>;
  transactionType?: 'income' | 'expense' | 'transfer' | 'unknown';
  confidence?: number;
  validationIssues?: string[];
};

type ApproveReceiptPayload = {
  description?: string;
  categoryId?: string;
  category?: string;
  amount?: number;
  currency?: string;
  vendor?: string | null;
  date?: string | null;
  tax?: number;
  paymentMethod?: string;
  lineItems?: Array<{ description: string; amount: number }>;
};

type UpdateReceiptPayload = Partial<ReceiptRecord>;

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api/v1' : '/api/v1');

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for workspace context and CSRF.
// Authentication itself rides on httpOnly cookies (withCredentials above), so
// no token is read here — there is nothing in JS reach for an XSS to steal.
apiClient.interceptors.request.use(
  config => {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers[CSRF_HEADER] = csrfToken;
    }

    // Add workspace context header, unless the caller picked a workspace itself
    // (an upload pinned to where it started, a per-workspace analytics fetch).
    const workspaceId = localStorage.getItem('currentWorkspaceId');
    if (workspaceId && !config.headers.has('X-Workspace-Id')) {
      config.headers['X-Workspace-Id'] = workspaceId;
    }

    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

async function handleForbiddenError(error: unknown): Promise<never> {
  localStorage.removeItem('currentWorkspaceId');
  window.location.href = '/workspaces';
  return Promise.reject(error);
}

async function requestNewAccessToken(): Promise<void> {
  // Оба токена живут в httpOnly-куках: браузер отправляет refresh-куку сам, а
  // бэкенд перезаписывает обе куки в ответе. Читать и хранить тут нечего.
  await axios.post(
    `${apiBaseUrl}/auth/refresh`,
    {},
    { withCredentials: true, headers: { ...getCsrfHeaders() } },
  );
}

/**
 * Tabs share the refresh cookie, and the backend rotates it on every use: two
 * tabs refreshing at once would present the same token and the one that lost
 * the race would be logged out. A Web Lock makes tabs take turns, so the second
 * presents the cookie the first has just received. Where the API is missing,
 * the in-tab single flight below still holds.
 */
const REFRESH_LOCK_NAME = 'lumio-auth-refresh';

function refreshAcrossTabs(): Promise<void> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  // lib.dom types the lock's result as the callback's own promise; at runtime it is unwrapped.
  return locks
    ? locks.request(REFRESH_LOCK_NAME, () => requestNewAccessToken()).then(() => undefined)
    : requestNewAccessToken();
}

let refreshInFlight: Promise<void> | null = null;

/**
 * Все параллельные 401 ждут один рефреш: бэкенд ротирует refresh-токен, и второй
 * одновременный рефреш предъявил бы уже отозванный токен и разлогинил пользователя.
 *
 * Флаг сбрасывается внутри колбэков then, то есть после того, как бэкенд перезаписал куки:
 * сброс раньше оставил бы окно, в котором следующий вызов предъявил бы старую refresh-куку.
 * Обе ветки сбрасывают его — иначе один сетевой сбой навсегда отравил бы рефреш во вкладке.
 * Без `finally`: React Compiler пропускает код с finally, и кодовая база держится промис-цепочек.
 */
function getFreshAccessToken(): Promise<void> {
  refreshInFlight ??= refreshAcrossTabs().then(
    () => {
      refreshInFlight = null;
    },
    (error: unknown) => {
      refreshInFlight = null;
      throw error;
    },
  );
  return refreshInFlight;
}

async function refreshAccessToken(originalRequest: Record<string, unknown>): Promise<unknown> {
  await getFreshAccessToken();
  // The refreshed cookies are already on the jar; the retry just needs the
  // CSRF header re-read, since /auth/refresh rotates that value too.
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    (originalRequest.headers as Record<string, string>)[CSRF_HEADER] = csrfToken;
  }
  return apiClient(originalRequest);
}

const AUTH_RETRY_EXCLUDED_PATHS = new Set(['/auth/login', '/auth/register', '/auth/refresh']);

function isAuthRetryExcludedRequest(originalRequest: Record<string, unknown>): boolean {
  const url = typeof originalRequest.url === 'string' ? originalRequest.url : '';

  try {
    return AUTH_RETRY_EXCLUDED_PATHS.has(
      new URL(url, apiBaseUrl).pathname.replace(/\/api\/v1/, ''),
    );
  } catch {
    return AUTH_RETRY_EXCLUDED_PATHS.has(url.split('?')[0] ?? url);
  }
}

function isForbiddenWorkspaceError(error: Record<string, unknown>): boolean {
  const response = error.response as { status?: number; data?: { message?: string } } | undefined;
  return (
    response?.status === 403 &&
    typeof response?.data?.message === 'string' &&
    response.data.message.includes('workspace')
  );
}

function isUnauthorizedRetryable(
  error: Record<string, unknown>,
  originalRequest: Record<string, unknown>,
): boolean {
  const response = error.response as { status?: number } | undefined;
  return (
    response?.status === 401 &&
    !originalRequest._retry &&
    !isAuthRetryExcludedRequest(originalRequest)
  );
}

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  response => response,
  async (error: unknown) => {
    const err = error as Record<string, unknown>;
    const originalRequest = err.config as Record<string, unknown>;

    if (isForbiddenWorkspaceError(err)) {
      return handleForbiddenError(error);
    }

    if (isUnauthorizedRetryable(err, originalRequest)) {
      originalRequest._retry = true;
      try {
        return await refreshAccessToken(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('currentWorkspaceId');
        // Обязательно: пока эта кука на месте, AuthProvider считает, что сессия
        // есть, снова зовёт /auth/me, снова получает 401 — и страница логина
        // перезагружается по кругу.
        clearCsrfCookie();
        // Редирект не мгновенный: запросы в полёте успели бы отрезолвиться
        // в кэш уже разлогиненного пользователя.
        getQueryClient().clear();
        // Signed-out visitors on register, password reset or an invite get a
        // 401 from any stray query; sending them to /login would break the page.
        if (!isPublicPath(window.location.pathname)) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// Gmail Receipts API
export const gmailReceiptsApi = {
  getReceipt: (id: string): Promise<AxiosResponse> =>
    apiClient.get(`/integrations/gmail/receipts/${id}`),

  updateReceiptParsedData: (
    id: string,
    data: GmailReceiptParsedDataUpdate,
  ): Promise<AxiosResponse> =>
    apiClient.patch(`/integrations/gmail/receipts/${id}/parsed-data`, data),

  markDuplicate: (id: string, originalId: string): Promise<AxiosResponse> =>
    apiClient.post(`/integrations/gmail/receipts/${id}/mark-duplicate`, {
      originalReceiptId: originalId,
    }),

  unmarkDuplicate: (id: string): Promise<AxiosResponse> =>
    apiClient.post(`/integrations/gmail/receipts/${id}/unmark-duplicate`),

  bulkApproveReceipts: (receiptIds: string[], categoryId?: string): Promise<AxiosResponse> =>
    apiClient.post('/integrations/gmail/receipts/bulk-approve', { receiptIds, categoryId }),

  exportReceiptsToXlsx: (receiptIds: string[]): Promise<AxiosResponse> =>
    apiClient.post('/integrations/gmail/receipts/export-xlsx', { receiptIds }),

  exportReceiptToDraft: (receiptId: string): Promise<AxiosResponse> =>
    apiClient.post(`/integrations/gmail/receipts/${receiptId}/export-draft`),

  getReceiptPreview: (id: string): Promise<AxiosResponse> =>
    apiClient.get(`/integrations/gmail/receipts/${id}/preview`),

  listReceipts: (params?: {
    status?: string;
    limit?: number;
    offset?: number;
    includeInvalid?: boolean;
    includeLinkedScans?: boolean;
    hasAmount?: boolean;
    categoryId?: string;
  }): Promise<AxiosResponse> => apiClient.get('/integrations/gmail/receipts', { params }),

  approveReceipt: (id: string, data: ApproveReceiptPayload): Promise<AxiosResponse> =>
    apiClient.post(`/integrations/gmail/receipts/${id}/approve`, data),

  updateReceipt: (id: string, data: UpdateReceiptPayload): Promise<AxiosResponse> =>
    apiClient.patch(`/integrations/gmail/receipts/${id}`, data),

  getStatus: (): Promise<AxiosResponse> => apiClient.get('/integrations/gmail/status'),
};

export type ReceiptLocationSource = ContractReceiptLocationSource;

/** An OpenStreetMap place the user picked for a receipt. */
export type ReceiptPlace = ContractReceiptPlace;

export interface PlaceCandidate {
  name: string;
  category: string;
  type: string;
  address: string | null;
  locality: string | null;
  lat: number;
  lng: number;
  osmType: 'node' | 'way' | 'relation';
  osmId: string;
  distanceM: number;
  matchesVendor: boolean;
}

export type PlaceSuggestions =
  | { needed: false }
  | {
      needed: true;
      receiptId: string;
      vendor: string | null;
      amount: number | null;
      currency: string | null;
      date: string | null;
      candidates: PlaceCandidate[];
    };

export type ReceiptTransactionMatch = ContractReceiptTransactionMatch;

export type ReceiptMatchCandidate = ReceiptTransactionMatches['data'][number];

export type ReceiptSplitSuggestion = ContractReceiptSplitSuggestion;

/** A receipt as `GET /receipts/:id` sends it. */
export type ReceiptRecord = ContractReceiptRecord;

export interface ReceiptListFilters {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
}

export type ReceiptListResponse = ReceiptListPage;

export const receiptsApi = {
  listReceipts: async (params?: ReceiptListFilters): Promise<ReceiptListResponse> => {
    const response = await apiClient.get('/receipts', { params });
    // The page has a `data` key: checked raw, not through apiQueryDecoded's unwrap.
    return checkContract('ReceiptListPage', response.data, '/receipts');
  },

  getReceipt: async (id: string): Promise<ReceiptRecord> => {
    return apiQueryDecoded({ url: `/receipts/${id}`, contract: 'ReceiptRecord' });
  },

  updateReceipt: async (
    id: string,
    data: ContractInput<'UpdateReceiptBody'>,
  ): Promise<ReceiptRecord> => {
    const response = await apiClient.patch(`/receipts/${id}`, data);
    return response.data as ReceiptRecord;
  },

  updateReceiptLocation: async (
    id: string,
    point: { latitude: number; longitude: number; place?: ReceiptPlace },
  ): Promise<ReceiptRecordUpdate> => {
    const response = await apiClient.patch(
      `/receipts/${id}/location`,
      point satisfies ContractInput<'UpdateReceiptLocationBody'>,
    );
    return checkContract('ReceiptRecordUpdate', response.data, '/receipts/:id/location');
  },

  /** Shops near a fix taken after a scan that had none; the body keeps the position out of URLs. */
  getPlaceSuggestions: async (fix: {
    statementId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
  }): Promise<PlaceSuggestions> => {
    const response = await apiClient.post(
      '/receipts/place-suggestions',
      fix satisfies ContractInput<'PlaceSuggestionsBody'>,
    );
    return (response.data?.data ?? response.data) as PlaceSuggestions;
  },

  resetReceiptLocation: async (id: string): Promise<ReceiptRecordUpdate> => {
    const response = await apiClient.delete(`/receipts/${id}/location`);
    return checkContract('ReceiptRecordUpdate', response.data, '/receipts/:id/location');
  },

  approveReceipt: async (
    id: string,
    options: { transactionId?: string | null } = {},
  ): Promise<ReceiptApproval> => {
    const response = await apiClient.post(
      `/receipts/${id}/approve`,
      options satisfies ContractInput<'ApproveReceiptBody'>,
    );
    return checkContract('ReceiptApproval', response.data, '/receipts/:id/approve');
  },

  transactionMatches: async (
    id: string,
  ): Promise<{ suggestion: ReceiptTransactionMatch | null; data: ReceiptMatchCandidate[] }> => {
    const response = await apiClient.get(`/receipts/${id}/transaction-matches`);
    return checkContract(
      'ReceiptTransactionMatches',
      response.data,
      '/receipts/:id/transaction-matches',
    );
  },

  splitSuggestion: async (id: string): Promise<ReceiptSplitSuggestion> => {
    return apiQueryDecoded({
      url: `/receipts/${id}/split-suggestion`,
      contract: 'ReceiptSplitSuggestion',
    });
  },

  /** `items`: the preview as the user corrected it; the receipt's lines with their categories. */
  splitByLineItems: async (
    id: string,
    items?: ReceiptSplitSuggestion['items'],
  ): Promise<ReceiptSplitResult> => {
    const body = (items ? { items } : {}) satisfies ContractInput<'ApplyReceiptSplitBody'>;
    const response = await apiClient.post(`/receipts/${id}/split`, body);
    return checkContract('ReceiptSplitResult', response.data, '/receipts/:id/split');
  },

  uploadReceipts: async (formData: FormData): Promise<{ receipts: ReceiptRecord[] }> => {
    const response = await apiClient.post('/receipts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { receipts: ReceiptRecord[] };
  },

  scanReceipt: async (file: File, language?: string): Promise<ReceiptRecord> => {
    const formData = new FormData();
    formData.append('file', file);

    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    const response = await apiClient.post('/receipts/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as ReceiptRecord;
  },
};

export const statementsApi = {
  exportZip: () => apiClient.get('/statements/export-zip', { responseType: 'blob' }),
};

export const api = apiClient;
export default apiClient;
