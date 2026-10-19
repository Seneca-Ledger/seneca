import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';

export type OnboardingMode = 'standard' | 'create-workspace';

export type OnboardingStepKey = 'language' | 'workspace' | 'tax' | 'business' | 'completion';

const STANDARD_STEP_KEYS: OnboardingStepKey[] = [
  'language',
  'workspace',
  'tax',
  'business',
  'completion',
];

// Language and region belong to the user, who set them on the first run.
const CREATE_WORKSPACE_STEP_KEYS: OnboardingStepKey[] = [
  'workspace',
  'tax',
  'business',
  'completion',
];

export function resolveOnboardingFlow(
  modeParam: string | null | undefined,
  onboardingCompletedAt: string | null | undefined,
) {
  const isCreateWorkspaceMode = modeParam === 'create-workspace' && Boolean(onboardingCompletedAt);

  if (isCreateWorkspaceMode) {
    return {
      mode: 'create-workspace' as const,
      shouldRedirectCompletedUser: false,
      stepKeys: CREATE_WORKSPACE_STEP_KEYS,
    };
  }

  return {
    mode: 'standard' as const,
    shouldRedirectCompletedUser: true,
    stepKeys: STANDARD_STEP_KEYS,
  };
}

/**
 * Business details are not asked of a home workspace. Before the profile is
 * chosen the step counts: the total may then drop by one, never grow mid-way.
 */
export function visibleSteps(
  stepKeys: OnboardingStepKey[],
  profile: WorkspaceProfile | null,
): OnboardingStepKey[] {
  return profile === 'home' ? stepKeys.filter(key => key !== 'business') : stepKeys;
}

/** Home or business is the one question without a default: the workspace step waits for it. */
export function canLeaveStep(
  stepKey: OnboardingStepKey,
  profile: WorkspaceProfile | null,
): boolean {
  return stepKey !== 'workspace' || profile !== null;
}
