// @vitest-environment jsdom
import type { AuditEvent } from '@/lib/api/audit';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { avatarTone } from '@/app/lib/initial-avatar';
import { AuditTimeline } from './AuditTimeline';

const event = (id: string, overrides: Partial<AuditEvent>): AuditEvent => ({
  id,
  workspaceId: 'workspace-1',
  createdAt: '2026-03-12T19:06:44.950Z',
  actorType: 'user',
  actorId: 'user-1',
  actorLabel: 'member-1@example.com',
  entityType: 'statement',
  entityId: 'entity-1',
  action: 'import',
  diff: null,
  description: null,
  meta: null,
  batchId: null,
  severity: 'info',
  isUndoable: false,
  ...overrides,
});

const avatars = async (events: AuditEvent[]) => {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <AuditTimeline
        events={events}
        onSelect={() => undefined}
        page={1}
        limit={50}
        total={events.length}
        onPageChange={() => undefined}
      />,
    );
  });
  const found = [...container.querySelectorAll<HTMLElement>('.audit-avatar')];
  act(() => root.unmount());
  return found;
};

describe('AuditTimeline avatars', () => {
  it('draws the member who acted as the account menu does', async () => {
    const [initial, photo] = await avatars([
      event('e1', { actor: { name: 'Member One', email: 'member-1@example.com', avatarUrl: null } }),
      event('e2', {
        actor: { name: 'Member Two', email: 'member-2@example.com', avatarUrl: 'https://example.com/a.png' },
      }),
    ]);

    // The first letter of the name, on the tint the e-mail picks: not "ME" from the label.
    expect(initial.textContent).toBe('M');
    expect(initial.style.background).toBe(avatarTone('member-1@example.com'));
    expect(photo.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('falls back to the label for an actor that is no member', async () => {
    const [system] = await avatars([
      event('e3', { actorType: 'system', actorId: null, actorLabel: 'Scheduler', actor: null }),
    ]);
    expect(system.textContent).toBe('S');
  });
});
