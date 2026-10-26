'use client';

import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { WorkspaceMemberOption } from './hooks/useWorkspaceMembers';

/** `null` is "everyone"; `shared` is the rows nobody claimed, which is its own answer. */
export const OWNER_SHARED = 'shared';

/**
 * What a picker value means as an owner to write.
 *
 * The "shared" entry is the absence of an owner, not an owner, so it has to
 * become `null` before it reaches the API — sending the literal string would
 * fail validation, and dropping the field would leave the row where it was.
 */
export function ownerValueToMemberId(value: string): string | null {
  return value === OWNER_SHARED || value === '' ? null : value;
}

interface OwnerFilterDropdownProps {
  members: WorkspaceMemberOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export function OwnerFilterDropdown({
  members,
  value,
  onChange,
}: OwnerFilterDropdownProps): React.JSX.Element | null {
  const t = useIntlayer('transactionOwner');

  // A workspace of one has nobody to split with.
  if (members.length === 0) {
    return null;
  }

  return (
    <Select
      value={value ?? ''}
      onChange={next => onChange(next || null)}
      aria-label={t.filterLabel.value}
      options={[
        { value: '', label: t.everyone.value },
        { value: OWNER_SHARED, label: t.shared.value },
        ...members.map(member => ({
          value: member.memberId,
          label: member.isSelf ? t.me.value : member.label,
        })),
      ]}
      sx={{ minWidth: 150, backgroundColor: 'var(--card-bg)' }}
    />
  );
}
