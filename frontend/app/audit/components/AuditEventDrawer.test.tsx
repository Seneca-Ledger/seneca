// @vitest-environment jsdom
import type { AuditEvent } from '@/lib/api/audit';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AuditEventDrawer } from './AuditEventDrawer';

vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const sampleEvent: AuditEvent = {
  id: 'event-1',
  workspaceId: 'workspace-1',
  createdAt: '2026-03-12T19:06:44.950Z',
  actorType: 'user',
  actorId: 'user-1',
  actorLabel: 'admin@example.com',
  entityType: 'category',
  entityId: 'entity-1',
  action: 'create',
  diff: {
    before: null,
    after: { id: 'entity-1', createdAt: '2026-03-12T19:06:44.950Z', name: 'Office' },
  },
  description: 'Создана категория "Office"',
  meta: null,
  batchId: null,
  severity: 'info',
  isUndoable: false,
};

describe('AuditEventDrawer', () => {
  it('wraps drawer content in a scrollable container', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<AuditEventDrawer event={sampleEvent} open={true} onClose={() => undefined} />);
    });

    const scrollContainer = container.querySelector('[data-testid="audit-event-drawer-scroll"]');
    expect(scrollContainer).toBeTruthy();
    expect(getComputedStyle(scrollContainer as Element).overflowY).toBe('auto');
  });

  it('shows human-readable description and hides technical diff rows by default', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<AuditEventDrawer event={sampleEvent} open={true} onClose={() => undefined} />);
    });

    expect(container.textContent).toContain('Создана категория "Office"');
    expect(container.textContent).not.toContain('createdAt');
    expect(container.textContent).not.toContain('id');
  });
});
