export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    workspaceId?: string | null;
    lastWorkspaceId?: string | null;
    locale?: string;
    timeZone?: string | null;
    themePreference?: string;
    mapStylePreference?: string | null;
    avatarUrl?: string | null;
    onboardingCompletedAt?: string | null;
  };
  access_token: string;
  refresh_token: string;
}

/**
 * Returned by login when the password was correct but the account needs a
 * second factor. Deliberately carries no tokens and no user data.
 */
export class TwoFactorChallengeDto {
  twoFactorRequired: true;
}

export type LoginResultDto = AuthResponseDto | TwoFactorChallengeDto;
