import type { AuditEvent } from '@/entities/audit-event.entity';
import { EntityType } from '@/entities/audit-event.entity';
import { HOUSEHOLD_ENTITY_TYPES, toActivityEntry } from '@/modules/audit/workspace-activity';

const event = (overrides: Partial<AuditEvent> = {}): AuditEvent =>
  ({
    id: 'event-1',
    actorType: 'user',
    actorLabel: 'Fallback Label',
    action: 'update',
    entityType: EntityType.TRANSACTION,
    entityId: 'tx-1',
    description: 'Changed: counterpartyName',
    createdAt: new Date('2026-10-05T10:00:00Z'),
    actor: { id: 'u-1', name: 'Partner', email: 'partner@example.com' },
    diff: { before: { counterpartyName: 'Jewellery shop' }, after: { counterpartyName: '—' } },
    meta: {
      auditDescription: { key: 'updateOneField', params: { entity: 'transaction' } },
      email: 'partner@example.com',
    },
    ...overrides,
  }) as unknown as AuditEvent;

describe('HOUSEHOLD_ENTITY_TYPES', () => {
  it('leaves security and administration to the owner', () => {
    // These belong to the full audit. A member seeing who signed in or whose
    // API key changed is a different feature from "did you recategorise this?".
    for (const entityType of [
      EntityType.USER,
      EntityType.API_KEY,
      EntityType.WEBHOOK,
      EntityType.BACKUP,
      EntityType.WORKSPACE_MEMBER,
      EntityType.WORKSPACE,
      EntityType.INTEGRATION,
    ]) {
      expect(HOUSEHOLD_ENTITY_TYPES).not.toContain(entityType);
    }
  });

  it('covers the money and the plan', () => {
    for (const entityType of [
      EntityType.TRANSACTION,
      EntityType.CATEGORY,
      EntityType.BUDGET,
      EntityType.GOAL,
    ]) {
      expect(HOUSEHOLD_ENTITY_TYPES).toContain(entityType);
    }
  });
});

describe('toActivityEntry', () => {
  it('drops the diff, which is where a private row would leak', () => {
    // The diff carries the merchant and the amount; a private transaction is
    // private from the rest of the household, so the feed never carries one.
    const entry = toActivityEntry(event()) as Record<string, unknown>;
    expect(entry.diff).toBeUndefined();
    expect(JSON.stringify(entry)).not.toContain('Jewellery shop');
  });

  it('drops meta, which carries emails and names of its own', () => {
    const entry = toActivityEntry(event()) as Record<string, unknown>;
    expect(entry.meta).toBeUndefined();
  });

  it('keeps who did what, when', () => {
    const entry = toActivityEntry(event());
    expect(entry).toMatchObject({
      actorName: 'Partner',
      action: 'update',
      entityType: 'transaction',
      entityId: 'tx-1',
      descriptionKey: 'updateOneField',
    });
  });

  it('falls back from a missing name to the email, then to the stored label', () => {
    expect(toActivityEntry(event({ actor: { email: 'only@example.com' } as never })).actorName).toBe(
      'only@example.com',
    );
    expect(toActivityEntry(event({ actor: null as never })).actorName).toBe('Fallback Label');
    expect(
      toActivityEntry(event({ actor: null as never, actorLabel: '' as never })).actorName,
    ).toBe('—');
  });

  it('survives an event with no descriptor', () => {
    const entry = toActivityEntry(event({ meta: null as never }));
    expect(entry.descriptionKey).toBeNull();
    expect(entry.descriptionParams).toBeNull();
  });
});
