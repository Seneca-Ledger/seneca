import { beforeEach, describe, expect, it } from 'vitest';
import { getWorkspaceHeaders } from '../workspace-headers';

const clearCookies = (): void => {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
};

describe('getWorkspaceHeaders', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCookies();
  });

  it('returns the CSRF and workspace headers when both are present', () => {
    document.cookie = 'csrf_token=csrf-123';
    localStorage.setItem('currentWorkspaceId', 'workspace-abc');

    expect(getWorkspaceHeaders()).toEqual({
      'X-CSRF-Token': 'csrf-123',
      'X-Workspace-Id': 'workspace-abc',
    });
  });

  it('returns only the CSRF header when workspace is missing', () => {
    document.cookie = 'csrf_token=csrf-123';

    expect(getWorkspaceHeaders()).toEqual({ 'X-CSRF-Token': 'csrf-123' });
  });

  it('returns the workspace header when there is no session', () => {
    localStorage.setItem('currentWorkspaceId', 'workspace-abc');

    expect(getWorkspaceHeaders()).toEqual({ 'X-Workspace-Id': 'workspace-abc' });
  });

  it('never carries an Authorization header — auth rides on httpOnly cookies', () => {
    document.cookie = 'csrf_token=csrf-123';
    localStorage.setItem('access_token', 'legacy-token');

    expect(getWorkspaceHeaders()).not.toHaveProperty('Authorization');
  });
});
