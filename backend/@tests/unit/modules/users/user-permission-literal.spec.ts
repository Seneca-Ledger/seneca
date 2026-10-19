import * as Schema from 'effect/Schema';
import { Permission } from '@/common/enums/permissions.enum';
import { UserPermission } from '@/contracts';

describe('UserPermission', () => {
  // The contract spells the permissions out for the admin page and the
  // permission bodies; a new enum value missing here would be rejected as input.
  it('matches the Permission enum', () => {
    const is = Schema.is(UserPermission);
    expect(Object.values(Permission).filter(value => !is(value))).toEqual([]);
    expect(UserPermission.literals.length).toBe(Object.values(Permission).length);
  });
});
