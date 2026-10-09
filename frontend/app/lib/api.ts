import axios, { type AxiosResponse } from 'axios';
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

export type ReceiptLocationSource =
  | 'merchant_address'
  | 'exif'
  | 'device'
  | 'manual'
  | 'fiscal_qr'
  | 'place';

/** An OpenStreetMap place the user picked for a receipt. */
export interface ReceiptPlace {
  name: string;
  category: string | null;
  osmType: string;
  osmId: string;
}

export interface PlaceCandidate {
  name: string;
  category: string;
  type: string;
  address: string | null;
  locality: string | null;
  lat: number;
  lng: number;
  osmType: string;
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

export interface ReceiptTransactionMatch {
  transactionIds: string[];
  kind: 'single' | 'multi';
  score: number;
  computedAt: string;
}

export interface ReceiptMatchCandidate {
  id: string;
  transactionDate: string;
  counterpartyName: string;
  amount: number;
  currency: string;
  score: number;
  daysApart: number;
}

export interface ReceiptSplitSuggestion {
  transactionId: string;
  total: number;
  currency: string;
  parts: Array<{
    categoryId: string | null;
    categoryName: string | null;
    amount: number;
    items: string[];
  }>;
  splittable: boolean;
}

export interface ReceiptRecord {
  id: string;
  statementId?: string | null;
  transactionId?: string | null;
  subject: string;
  sender: string;
  source: string;
  status: string;
  receivedAt: string;
  language?: string | null;
  metadata?: {
    attachments?: Array<{
      id?: string;
      filename?: string;
      mimeType?: string;
      size?: number;
    }>;
    transactionMatch?: ReceiptTransactionMatch | null;
    place?: ReceiptPlace;
  };
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    merchantAddress?: string;
    date?: string;
    tax?: number;
    paymentMethod?: string;
    category?: string;
    categoryId?: string;
    lineItems?: Array<{ description: string; amount: number }>;
    transactionType?: 'income' | 'expense' | 'transfer' | 'unknown';
    confidence?: number;
    validationIssues?: string[];
  };
  locationLat?: number | null;
  locationLng?: number | null;
  locationSource?: ReceiptLocationSource | null;
  locationAccuracyM?: number | null;
  locationUpdatedAt?: string | null;
}

export interface ReceiptListFilters {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
}

export interface ReceiptListResponse {
  data: ReceiptRecord[];
  total: number;
  page: number;
  limit: number;
}

export const receiptsApi = {
  listReceipts: async (params?: ReceiptListFilters): Promise<ReceiptListResponse> => {
    const response = await apiClient.get('/receipts', { params });
    return response.data as ReceiptListResponse;
  },

  getReceipt: async (id: string): Promise<ReceiptRecord> => {
    const response = await apiClient.get(`/receipts/${id}`);
    return response.data as ReceiptRecord;
  },

  updateReceipt: async (id: string, data: Partial<ReceiptRecord>): Promise<ReceiptRecord> => {
    const response = await apiClient.patch(`/receipts/${id}`, data);
    return response.data as ReceiptRecord;
  },

  updateReceiptLocation: async (
    id: string,
    point: { latitude: number; longitude: number; place?: ReceiptPlace },
  ): Promise<ReceiptRecord> => {
    const response = await apiClient.patch(`/receipts/${id}/location`, point);
    return (response.data?.data ?? response.data) as ReceiptRecord;
  },

  /** Shops near a fix taken after a scan that had none; the body keeps the position out of URLs. */
  getPlaceSuggestions: async (fix: {
    statementId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
  }): Promise<PlaceSuggestions> => {
    const response = await apiClient.post('/receipts/place-suggestions', fix);
    return (response.data?.data ?? response.data) as PlaceSuggestions;
  },

  resetReceiptLocation: async (id: string): Promise<ReceiptRecord> => {
    const response = await apiClient.delete(`/receipts/${id}/location`);
    return (response.data?.data ?? response.data) as ReceiptRecord;
  },

  approveReceipt: async (
    id: string,
    options: { transactionId?: string | null } = {},
  ): Promise<{ receipt: ReceiptRecord; transaction: { id: string }; attached: boolean }> => {
    const response = await apiClient.post(`/receipts/${id}/approve`, options);
    return response.data as {
      receipt: ReceiptRecord;
      transaction: { id: string };
      attached: boolean;
    };
  },

  transactionMatches: async (
    id: string,
  ): Promise<{ suggestion: ReceiptTransactionMatch | null; data: ReceiptMatchCandidate[] }> => {
    const response = await apiClient.get(`/receipts/${id}/transaction-matches`);
    return response.data as {
      suggestion: ReceiptTransactionMatch | null;
      data: ReceiptMatchCandidate[];
    };
  },

  splitSuggestion: async (id: string): Promise<ReceiptSplitSuggestion> => {
    const response = await apiClient.get(`/receipts/${id}/split-suggestion`);
    return response.data as ReceiptSplitSuggestion;
  },

  splitByLineItems: async (id: string): Promise<{ suggestion: ReceiptSplitSuggestion }> => {
    const response = await apiClient.post(`/receipts/${id}/split`);
    return response.data as { suggestion: ReceiptSplitSuggestion };
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
