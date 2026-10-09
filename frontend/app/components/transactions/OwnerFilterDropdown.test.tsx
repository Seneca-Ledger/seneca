import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { OWNER_SHARED, OwnerFilterDropdown, ownerValueToMemberId } from './OwnerFilterDropdown';
import type { WorkspaceMemberOption } from './hooks/useWorkspaceMembers';

const MEMBERS: WorkspaceMemberOption[] = [
  { memberId: 'member-self', label: 'Me Myself', isSelf: true },
  { memberId: 'member-partner', label: 'Partner', isSelf: false },
];

describe('ownerValueToMemberId', () => {
  it('turns the "shared" entry into no owner at all', () => {
    // Sending the literal string would fail @IsUUID on the API; sending nothing
    // would leave the row where it was. Only null hands it back to the household.
    expect(ownerValueToMemberId(OWNER_SHARED)).toBeNull();
  });

  it('treats an empty pick as no owner too', () => {
    expect(ownerValueToMemberId('')).toBeNull();
  });

  it('passes a membership id straight through', () => {
    expect(ownerValueToMemberId('member-partner')).toBe('member-partner');
  });
});

describe('OwnerFilterDropdown', () => {
  const render = (members: WorkspaceMemberOption[]) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<OwnerFilterDropdown members={members} value={null} onChange={vi.fn()} />);
    });
    return container;
  };

  it('renders nothing for a workspace of one', () => {
    // Nobody to split with, so the control would only be noise.
    expect(render([]).textContent).toBe('');
  });

  it('offers everyone, shared and each person once there is a household', () => {
    const text = render(MEMBERS).textContent ?? '';
    expect(text).toContain('Everyone');
  });
});
