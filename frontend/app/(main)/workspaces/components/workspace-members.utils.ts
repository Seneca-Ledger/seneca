export type WorkspaceMemberListItem = {
  id: string;
  email?: string;
  name?: string;
  role: string;
  joinedAt?: string;
};

export type MemberRoleFilter = 'all' | 'owner' | 'admin' | 'member' | 'viewer' | 'accountant';
export type MemberSortBy = 'name' | 'role' | 'joinedAt';

type FilterAndSortOptions = {
  searchEmail: string;
  roleFilter: MemberRoleFilter;
  sortBy: MemberSortBy;
};

const ROLE_SORT_ORDER: Record<string, number> = {
  owner: 0,
  admin: 1,
  member: 2,
  viewer: 3,
  accountant: 4,
};

const getDisplayName = (member: WorkspaceMemberListItem) =>
  (member.name || member.email || '').trim().toLowerCase();

const getRoleRank = (role: string) => ROLE_SORT_ORDER[role] ?? 99;

const getJoinedAtTimestamp = (value?: string) => {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const filterAndSortMembers = <T extends WorkspaceMemberListItem>(
  members: T[],
  options: FilterAndSortOptions,
): T[] => {
  const searchEmail = options.searchEmail.trim().toLowerCase();

  return members
    .filter(member => {
      if (options.roleFilter !== 'all' && member.role !== options.roleFilter) {
        return false;
      }

      if (!searchEmail) {
        return true;
      }

      return (member.email || '').toLowerCase().includes(searchEmail);
    })
    .sort((left, right) => {
      if (options.sortBy === 'role') {
        const byRole = getRoleRank(left.role) - getRoleRank(right.role);
        if (byRole !== 0) {
          return byRole;
        }
      }

      if (options.sortBy === 'joinedAt') {
        const byJoinDate =
          getJoinedAtTimestamp(right.joinedAt) - getJoinedAtTimestamp(left.joinedAt);
        if (byJoinDate !== 0) {
          return byJoinDate;
        }
      }

      return getDisplayName(left).localeCompare(getDisplayName(right));
    });
};
