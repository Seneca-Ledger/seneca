import { Permission } from '@/common/enums/permissions.enum';
import {
  GRANTABLE_SCOPES,
  groupScopes,
  isGrantableScope,
  SCOPE_PRESETS,
} from '@/modules/api-keys/api-key-scopes';
import { resolveAuditActor } from '@/common/interceptors/audit-actor.interceptor';
import { ActorType } from '@/entities/audit-event.entity';

describe('API key scopes', () => {
  it('never lets a key manage keys, people or workspace settings', () => {
    expect(isGrantableScope(Permission.API_KEY_MANAGE)).toBe(false);
    expect(isGrantableScope(Permission.USER_MANAGE)).toBe(false);
    expect(isGrantableScope(Permission.WORKSPACE_SETTINGS_MANAGE)).toBe(false);
    expect(isGrantableScope(Permission.TRANSACTION_VIEW)).toBe(true);
  });

  it('keeps the read preset to views and exports', () => {
    expect(SCOPE_PRESETS.read).toContain(Permission.TRANSACTION_VIEW);
    expect(SCOPE_PRESETS.read).toContain(Permission.REPORT_EXPORT);
    expect(SCOPE_PRESETS.read).not.toContain(Permission.TRANSACTION_EDIT);
    expect(SCOPE_PRESETS.write).toEqual(GRANTABLE_SCOPES);
  });

  it('groups scopes by area for a checkbox list', () => {
    const groups = groupScopes([Permission.TRANSACTION_VIEW, Permission.TRANSACTION_EDIT, Permission.REPORT_VIEW]);
    expect(groups.transaction).toHaveLength(2);
    expect(groups.report).toEqual([Permission.REPORT_VIEW]);
  });
});

describe('resolveAuditActor', () => {
  it('names the API key and leaves sessions alone', () => {
    expect(resolveAuditActor({ apiKey: { id: 'k1', name: 'CI', prefix: 'abcd1234' } })).toEqual({
      actorType: ActorType.INTEGRATION,
      actorLabel: 'API key "CI" (abcd1234)',
      meta: { apiKeyId: 'k1', apiKeyPrefix: 'abcd1234' },
    });
    expect(resolveAuditActor({})).toBeNull();
    expect(resolveAuditActor({ apiKey: null })).toBeNull();
  });
});
