import { describe, expect, it } from 'vitest';
import { resolvePageTitle } from './page-title';
import { APP_NAME } from '@/app/lib/brand';

describe('resolvePageTitle', () => {
  it('resolves known route titles', () => {
    expect(resolvePageTitle('/dashboard')).toBe(`${APP_NAME} — Dashboard`);
    expect(resolvePageTitle('/reports')).toBe(`${APP_NAME} — Reports`);
    expect(resolvePageTitle('/workspaces/members')).toBe(`${APP_NAME} — Workspace members`);
  });

  it('falls back to product title for unknown routes', () => {
    expect(resolvePageTitle('/unknown-page')).toBe(`${APP_NAME} — Bank statement processing`);
  });
});
