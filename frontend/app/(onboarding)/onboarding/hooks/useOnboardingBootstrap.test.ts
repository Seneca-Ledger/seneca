import { describe, expect, it } from 'vitest';
import { AVAILABLE_BACKGROUNDS } from '@/app/(main)/workspaces/constants';
import { answersFromWorkspace, randomBackground } from './useOnboardingBootstrap';

describe('randomBackground', () => {
  it('always lands on one of the bundled photos, first to last', () => {
    expect(randomBackground(() => 0)).toBe(AVAILABLE_BACKGROUNDS[0]);
    expect(randomBackground(() => 0.9999)).toBe(AVAILABLE_BACKGROUNDS.at(-1));
  });
});

describe('answersFromWorkspace', () => {
  it('keeps a background the workspace already has', () => {
    expect(answersFromWorkspace({ backgroundImage: 'custom.jpg' }).workspaceBackgroundImage).toBe(
      'custom.jpg',
    );
  });

  it('leaves an empty background to the random pick', () => {
    expect(answersFromWorkspace({ backgroundImage: null })).not.toHaveProperty(
      'workspaceBackgroundImage',
    );
  });
});
