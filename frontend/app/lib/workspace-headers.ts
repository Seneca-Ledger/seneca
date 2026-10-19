import { getCsrfHeaders } from './csrf';

/**
 * Auth itself rides on httpOnly cookies, so nothing here carries a token —
 * every fetch using these headers must also pass `credentials: 'include'`.
 * What remains is the workspace context and the CSRF header.
 */
export const getWorkspaceHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};

  const workspaceId = localStorage.getItem('currentWorkspaceId');
  const headers: Record<string, string> = { ...getCsrfHeaders() };

  if (workspaceId) {
    headers['X-Workspace-Id'] = workspaceId;
  }

  return headers;
};
