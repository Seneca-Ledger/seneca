import { describe, expect, it } from 'vitest';

import { canLeaveStep, resolveOnboardingFlow, visibleSteps } from './onboarding-flow';

describe('resolveOnboardingFlow', () => {
  it('skips language and region when an onboarded user creates another workspace', () => {
    expect(resolveOnboardingFlow('create-workspace', '2026-01-01T00:00:00.000Z')).toEqual({
      mode: 'create-workspace',
      shouldRedirectCompletedUser: false,
      stepKeys: ['workspace', 'tax', 'business', 'completion'],
    });
  });

  it('runs the full flow when onboarding is not completed yet, whatever the mode param says', () => {
    expect(resolveOnboardingFlow('create-workspace', null)).toEqual({
      mode: 'standard',
      shouldRedirectCompletedUser: true,
      stepKeys: ['language', 'workspace', 'tax', 'business', 'completion'],
    });
  });
});

describe('visibleSteps', () => {
  const keys = resolveOnboardingFlow(null, null).stepKeys;

  it('asks for business details only in a business workspace', () => {
    expect(visibleSteps(keys, 'business')).toContain('business');
    expect(visibleSteps(keys, 'home')).toEqual(['language', 'workspace', 'tax', 'completion']);
  });

  it('counts the business step until the profile is chosen, so the total never grows', () => {
    expect(visibleSteps(keys, null)).toContain('business');
  });
});

describe('canLeaveStep', () => {
  it('holds the workspace step until home or business is chosen', () => {
    expect(canLeaveStep('workspace', null)).toBe(false);
    expect(canLeaveStep('workspace', 'home')).toBe(true);
  });

  it('never holds the other steps, whose questions all have a way to pass', () => {
    expect(canLeaveStep('tax', null)).toBe(true);
    expect(canLeaveStep('language', null)).toBe(true);
  });
});
