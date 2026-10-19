'use client';

import { useState } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';

function readStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentWorkspaceId');
}

/**
 * Идентификатор активного воркспейса для ключей React Query.
 *
 * Фолбэк на localStorage несущий: request-интерцептор apiClient берёт
 * X-Workspace-Id прямо из localStorage, а WorkspaceContext заполняет
 * currentWorkspace асинхронно. Без фолбэка первый рендер ключевал бы запросы
 * на null, хотя заголовок уже конкретный, — и после прихода стейта каждый
 * горячий запрос уходил бы на второй круг.
 */
export function useWorkspaceId(): string | null {
  const { currentWorkspace } = useWorkspace();
  const [storedId] = useState(readStoredWorkspaceId);
  return currentWorkspace?.id ?? storedId;
}
