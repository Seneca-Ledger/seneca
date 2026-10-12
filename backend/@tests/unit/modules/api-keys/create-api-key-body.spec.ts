import { CreateApiKeyBody } from '@/contracts';
import { Permission } from '@/common/enums/permissions.enum';
import { GRANTABLE_SCOPES } from '@/modules/api-keys/api-key-scopes';
import { rejectedFields } from '../../../helpers/schema-body';

describe('CreateApiKeyBody scopes', () => {
  // The contract spells the scopes out; the backend computes them. They must agree,
  // or a key could be granted what NEVER_FOR_KEYS withholds.
  it('accepts exactly the grantable scopes', () => {
    const accepted = Object.values(Permission).filter(
      scope => rejectedFields(CreateApiKeyBody, { name: 'probe', scopes: [scope] }).length === 0,
    );
    expect([...accepted].sort()).toEqual([...GRANTABLE_SCOPES].sort());
  });

  it('requires scopes on a new key', () => {
    expect(rejectedFields(CreateApiKeyBody, { name: 'No scopes' })).toEqual(['scopes']);
  });
});
