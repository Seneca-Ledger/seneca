import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient, { VERSION_READ_ONLY_TOAST_ID } from './api';

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('react-hot-toast', () => ({ default: toastMock }));

interface MockRequestConfig {
  url?: string;
  headers: Record<string, string>;
  _retry?: boolean;
}

const originalAdapter = apiClient.defaults.adapter;

const setCsrfCookie = (value: string): void => {
  document.cookie = `csrf_token=${value}`;
};

const clearCookies = (): void => {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
};

/**
 * Отдаёт 401 на запрос со старым CSRF-токеном и 200 — со свежим. Токены живут в
 * httpOnly-куках, которые тест прочитать не может, поэтому ротация сессии здесь
 * наблюдается через парную csrf-куку — ровно как её видит и сам клиент.
 */
function installAdapter(): { requests: MockRequestConfig[] } {
  const requests: MockRequestConfig[] = [];
  apiClient.defaults.adapter = (config => {
    const typed = config as unknown as MockRequestConfig;
    requests.push(typed);
    if (typed.headers['X-CSRF-Token'] === 'fresh-csrf') {
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }
    return Promise.reject({ config, response: { status: 401 }, isAxiosError: true });
  }) as typeof apiClient.defaults.adapter;
  return { requests };
}

describe('api single-flight refresh', () => {
  beforeEach(() => {
    setCsrfCookie('stale-csrf');
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '', pathname: '/dashboard' } as Location,
    });
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    clearCookies();
    localStorage.clear();
    Reflect.deleteProperty(navigator, 'locks');
    vi.restoreAllMocks();
  });

  it('refreshes once for concurrent 401s and replays every request', async () => {
    const { requests } = installAdapter();
    const post = vi.spyOn(axios, 'post').mockImplementation(async () => {
      // Бэкенд перезаписывает куки в ответе на /auth/refresh.
      setCsrfCookie('fresh-csrf');
      return { data: { message: 'Token refreshed' } };
    });

    const results = await Promise.all([
      apiClient.get('/dashboard'),
      apiClient.get('/transactions'),
      apiClient.get('/crypto/wallets'),
    ]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toContain('/auth/refresh');
    expect(results.map(r => r.status)).toEqual([200, 200, 200]);

    // Повтор должен перечитать ротированный CSRF-токен, а не переиспользовать старый.
    // axios переиспользует тот же объект config, поэтому считаем не элементы, а
    // отмеченные ретраем запросы — у всех должен стоять свежий заголовок.
    const retried = requests.filter(request => request._retry);
    expect(retried.length).toBeGreaterThan(0);
    expect(retried.every(request => request.headers['X-CSRF-Token'] === 'fresh-csrf')).toBe(true);
  });

  it('никогда не кладёт токены в localStorage', async () => {
    installAdapter();
    vi.spyOn(axios, 'post').mockImplementation(async () => {
      setCsrfCookie('fresh-csrf');
      return { data: { message: 'Token refreshed' } };
    });

    await apiClient.get('/dashboard');

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  // Tabs share the refresh cookie; refreshing inside a Web Lock keeps two tabs
  // from presenting the same rotated token at once.
  it('refreshes inside a cross-tab Web Lock', async () => {
    installAdapter();
    const order: string[] = [];
    const request = vi.fn(async (_name: string, callback: () => Promise<unknown>) => {
      order.push('lock');
      const result = await callback();
      order.push('unlock');
      return result;
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    vi.spyOn(axios, 'post').mockImplementation(async () => {
      order.push('refresh');
      setCsrfCookie('fresh-csrf');
      return { data: { message: 'Token refreshed' } };
    });

    const response = await apiClient.get('/dashboard');

    expect(request).toHaveBeenCalledWith('seneca-auth-refresh', expect.any(Function));
    expect(order).toEqual(['lock', 'refresh', 'unlock']);
    expect(response.status).toBe(200);
  });

  it('clears the in-flight lock when the refresh fails, so a later 401 retries', async () => {
    installAdapter();
    const post = vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh rejected'));

    const settled = await Promise.allSettled([
      apiClient.get('/dashboard'),
      apiClient.get('/transactions'),
      apiClient.get('/crypto/wallets'),
    ]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(settled.every(r => r.status === 'rejected')).toBe(true);
    expect(localStorage.getItem('currentWorkspaceId')).toBeNull();
    expect(window.location.href).toBe('/login');

    // Лока обнулена на ветке ошибки: следующий 401 стартует новый рефреш.
    post.mockImplementation(async () => {
      setCsrfCookie('fresh-csrf');
      return { data: { message: 'Token refreshed' } };
    });

    const response = await apiClient.get('/insights');
    expect(post).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });
});

describe('api workspace header', () => {
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    localStorage.clear();
  });

  const captureWorkspaceHeader = (): { sent: Array<string | undefined> } => {
    const sent: Array<string | undefined> = [];
    apiClient.defaults.adapter = (config => {
      sent.push(String(config.headers.get('X-Workspace-Id') ?? '') || undefined);
      return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
    }) as typeof apiClient.defaults.adapter;
    return { sent };
  };

  it('sends the workspace that is open', async () => {
    localStorage.setItem('currentWorkspaceId', 'ws-open');
    const { sent } = captureWorkspaceHeader();

    await apiClient.get('/statements');

    expect(sent).toEqual(['ws-open']);
  });

  it('keeps a workspace the caller asked for explicitly', async () => {
    localStorage.setItem('currentWorkspaceId', 'ws-open');
    const { sent } = captureWorkspaceHeader();

    await apiClient.get('/statements', { headers: { 'X-Workspace-Id': 'ws-other' } });

    expect(sent).toEqual(['ws-other']);
  });
});

describe('api inside a past version', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '/dashboard', pathname: '/dashboard' } as Location,
    });
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    localStorage.clear();
    toastMock.mockReset();
  });

  it('explains a refused write with one quiet note and keeps the workspace', async () => {
    localStorage.setItem('currentWorkspaceId', 'ver-ws');
    apiClient.defaults.adapter = (config =>
      Promise.reject({
        config,
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            error: {
              code: 'VERSION_READ_ONLY',
              // Even a message naming the workspace must not read as lost access.
              message: 'This workspace is a past version and can only be viewed',
            },
          },
        },
      })) as typeof apiClient.defaults.adapter;

    const settled = await Promise.allSettled([
      apiClient.post('/budgets', {}),
      apiClient.patch('/goals/1', {}),
    ]);

    expect(settled.every(result => result.status === 'rejected')).toBe(true);
    expect(toastMock).toHaveBeenCalledTimes(2);
    // One id for every refusal: react-hot-toast replaces the note instead of stacking it.
    for (const [message, options] of toastMock.mock.calls) {
      expect(message).toBe('This is a past version — it can only be viewed');
      expect(options).toEqual({ id: VERSION_READ_ONLY_TOAST_ID });
    }
    expect(localStorage.getItem('currentWorkspaceId')).toBe('ver-ws');
    expect(window.location.href).toBe('/dashboard');
  });

  it('still resets the workspace when access to it is really gone', async () => {
    localStorage.setItem('currentWorkspaceId', 'gone');
    apiClient.defaults.adapter = (config =>
      Promise.reject({
        config,
        isAxiosError: true,
        response: { status: 403, data: { message: 'You are not a member of this workspace' } },
      })) as typeof apiClient.defaults.adapter;

    await expect(apiClient.get('/dashboard')).rejects.toBeDefined();

    expect(toastMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('currentWorkspaceId')).toBeNull();
    expect(window.location.href).toBe('/workspaces');
  });
});
