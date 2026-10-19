import { QueryClient } from '@tanstack/react-query';
import { getApiErrorStatus } from './api-error';

/**
 * 4xx никогда не транзиентны: 403 по воркспейсу и 404 не починятся повтором,
 * а 401 уже обрабатывает интерцептор в api.ts. Дефолтные три ретрая RQ
 * превратили бы один сбой бэкенда в ~24 запроса на шести горячих хуках,
 * и столько же параллельных 401 в рефреш.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = getApiErrorStatus(error);
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // Обязательно false: список выписок поллится раз в 4с, дашборд тяжёлый
        // по графикам — рефетч по фокусу давал бы двойной запрос на каждый alt-tab.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: shouldRetry,
        // structuralSharing по умолчанию true — он заменяет рукописный
        // mergeStatementLists, не переопределять.
      },
      mutations: { retry: false },
    },
  });
}

let client: QueryClient | null = null;

/**
 * Модульный синглтон, а не useState(() => new QueryClient()).
 * Канонический next-рецепт с useState существует ради изоляции SSR-запросов
 * друг от друга — здесь SSR-фетчей нет вообще, зато инстанс нужен не-React
 * модулям (интерцептор api.ts, сокет-хендлеры), иначе понадобился бы реестр.
 * Утечка между пользователями закрывается clear() на логауте.
 */
export function getQueryClient(): QueryClient {
  client ??= createQueryClient();
  return client;
}

/** Только для тестов: сбросить синглтон между файлами. */
export function resetQueryClient(): void {
  client = null;
}
