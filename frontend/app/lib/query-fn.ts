import type { AxiosRequestConfig } from 'axios';
import apiClient from './api';

/**
 * API отвечает непоследовательно: часть эндпоинтов заворачивает полезную
 * нагрузку в { data }, часть отдаёт её напрямую. Проверяем наличие ключа явно —
 * `payload?.data ?? payload` развернул бы и легитимный ответ с полем `data`.
 */
export function unwrapEnvelope(payload: unknown): unknown {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

export interface ApiQueryOptions {
  url: string;
  params?: Record<string, unknown>;
  signal?: AbortSignal;
  config?: AxiosRequestConfig;
}

/**
 * GET + разворот конверта + проброс AbortSignal из React Query.
 * Ошибки наружу летят сырым AxiosError, чтобы getApiErrorMessage /
 * getApiErrorStatus продолжали работать без изменений.
 */
export async function apiQuery(options: ApiQueryOptions): Promise<unknown> {
  const { url, params, signal, config } = options;
  const response = await apiClient.get(url, { ...config, params, signal });
  return unwrapEnvelope(response.data);
}
