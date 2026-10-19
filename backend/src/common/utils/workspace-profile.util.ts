/**
 * Whether a workspace is someone's household money or a business's books.
 *
 * The profile only changes what the interface offers: the home profile hides
 * invoices, payables, the ledger, the tax declaration and custom tables from
 * the navigation. The pages stay reachable by URL and the data untouched, so
 * switching is free in both directions. Business is the default because it
 * is how every workspace behaved before the profile existed.
 */
export const workspaceProfiles = ['home', 'business'] as const;
export type WorkspaceProfile = (typeof workspaceProfiles)[number];

const PROFILE_KEY = 'profile';

export const readWorkspaceProfile = (
  workspace?: { settings?: Record<string, unknown> | null } | null,
): WorkspaceProfile => {
  const raw = workspace?.settings?.[PROFILE_KEY];
  return workspaceProfiles.includes(raw as WorkspaceProfile)
    ? (raw as WorkspaceProfile)
    : 'business';
};

/** Sets the profile on the settings blob without touching other keys. */
export const mergeWorkspaceProfile = (
  current: Record<string, unknown> | null | undefined,
  profile: WorkspaceProfile,
): Record<string, unknown> => ({ ...(current ?? {}), [PROFILE_KEY]: profile });
