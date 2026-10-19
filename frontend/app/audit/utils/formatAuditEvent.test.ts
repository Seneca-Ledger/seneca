import type { AuditEvent } from '@/lib/api/audit';
import { describe, expect, it } from 'vitest';
import { formatAuditEvent } from './formatAuditEvent';

describe('formatAuditEvent', () => {
  it('prefers backend description over technical diff formatting', () => {
    const mockEvent: AuditEvent = {
      id: 'evt-1',
      workspaceId: 'workspace-1',
      createdAt: '2024-10-12T12:00:00.000Z',
      actorType: 'user',
      actorId: 'user-1',
      actorLabel: 'Lia Bates',
      entityType: 'transaction',
      entityId: 'txn-123',
      action: 'update',
      diff: {
        before: { category: 'Marketing' },
        after: { category: 'Sales' },
      },
      description: 'Изменена категория транзакции',
      meta: null,
      batchId: null,
      severity: 'info',
      isUndoable: false,
    };

    const result = formatAuditEvent(mockEvent);

    expect(result.description).toBe('Изменена категория транзакции');
    expect(result.actionLabel).toBe('Change');
    expect(result.objectLabel).toBe('Transaction');
  });

  it('lists multiple fields with from/to details', () => {
    const mockEvent: AuditEvent = {
      id: 'evt-2',
      workspaceId: 'workspace-1',
      createdAt: '2024-10-12T12:00:00.000Z',
      actorType: 'user',
      actorId: 'user-1',
      actorLabel: 'Lia Bates',
      entityType: 'transaction',
      entityId: 'txn-456',
      action: 'update',
      diff: {
        before: { category: 'Marketing', amount: 10, note: 'Old' },
        after: { category: 'Sales', amount: 12, note: 'New' },
      },
      description: null,
      meta: null,
      batchId: null,
      severity: 'info',
      isUndoable: false,
    };

    const result = formatAuditEvent(mockEvent);

    expect(result.description).toBe('Fields: amount, category, note');
  });

  it('uses action + object fallback when diff is missing', () => {
    const mockEvent: AuditEvent = {
      id: 'evt-3',
      workspaceId: 'workspace-1',
      createdAt: '2024-10-12T12:00:00.000Z',
      actorType: 'system',
      actorId: null,
      actorLabel: 'System',
      entityType: 'rule',
      entityId: '',
      action: 'create',
      diff: null,
      description: null,
      meta: null,
      batchId: null,
      severity: 'info',
      isUndoable: false,
    };

    const result = formatAuditEvent(mockEvent);

    expect(result.description).toBe('Create Rule');
  });

  it('uses action tone when severity is info', () => {
    const mockEvent: AuditEvent = {
      id: 'evt-4',
      workspaceId: 'workspace-1',
      createdAt: '2024-10-12T12:00:00.000Z',
      actorType: 'user',
      actorId: 'user-2',
      actorLabel: 'Ada Lovelace',
      entityType: 'transaction',
      entityId: 'txn-789',
      action: 'create',
      diff: null,
      description: null,
      meta: null,
      batchId: null,
      severity: 'info',
      isUndoable: false,
    };

    const result = formatAuditEvent(mockEvent);

    expect(result.actionTone).toBe('success');
  });

  it('uses severity tone when warn overrides action tone', () => {
    const mockEvent: AuditEvent = {
      id: 'evt-5',
      workspaceId: 'workspace-1',
      createdAt: '2024-10-12T12:00:00.000Z',
      actorType: 'user',
      actorId: 'user-2',
      actorLabel: 'Ada Lovelace',
      entityType: 'transaction',
      entityId: 'txn-789',
      action: 'create',
      diff: null,
      description: null,
      meta: null,
      batchId: null,
      severity: 'warn',
      isUndoable: false,
    };

    const result = formatAuditEvent(mockEvent);

    expect(result.actionTone).toBe('warn');
  });

  it('renders the locale-independent descriptor in preference to the stored English text', () => {
    const mockEvent = {
      id: 'evt-descriptor',
      action: 'update',
      entityType: 'workspace',
      entityId: 'ws-1',
      severity: 'info',
      // The backend stores an English rendering and the raw descriptor beside it.
      description: 'Changed: workspace background image',
      diff: null,
      meta: {
        auditDescription: {
          key: 'updateOneField',
          params: { entity: 'workspace', field: 'backgroundImage' },
        },
      },
    } as unknown as AuditEvent;

    const result = formatAuditEvent(mockEvent);

    // Rendered from the dictionary in the active locale, not the stored
    // sentence — asserted language-agnostically so it survives a default flip.
    expect(result.description).not.toBe(mockEvent.description);
    expect(result.description).toContain('background image');
  });

  it('falls back to the stored description when the descriptor key is unknown', () => {
    const mockEvent = {
      id: 'evt-unknown-key',
      action: 'export',
      entityType: 'workspace',
      entityId: 'ws-1',
      severity: 'info',
      description: 'Exported: workspace',
      diff: null,
      meta: {
        auditDescription: { key: 'somethingTheDictionaryDoesNotKnow', params: {} },
      },
    } as unknown as AuditEvent;

    expect(formatAuditEvent(mockEvent).description).toBe('Exported: workspace');
  });
});
