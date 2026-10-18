import type { TutorialStepId } from './welcome-tutorial-routes';

/**
 * Frames of the step layout. With three fragments the first takes the large frame and
 * the other two share the column beside it; two fragments get a pair of equal frames.
 * scripts/capture-tutorial-screenshots.mjs cuts every fragment to its frame, so the
 * aspect ratios below and the ones in that script have to stay in step.
 */
export const FRAME_ASPECT = { hero: 1.55, side: 2.24, pair: 1.55 } as const;

export type TutorialFrame = keyof typeof FRAME_ASPECT;

export interface TutorialFragment {
  /** Key of the caption in the `welcomeTutorialSteps` dictionary. */
  id: string;
  frame: TutorialFrame;
}

/** Screenshot fragments per step, from the demo workspace. */
export const TUTORIAL_SCREENS: Record<TutorialStepId, TutorialFragment[]> = {
  dashboard: [
    {
      id: 'categories',
      frame: 'hero',
    },
    { id: 'month', frame: 'side' },
    { id: 'recent', frame: 'side' },
  ],
  statements: [
    { id: 'list', frame: 'pair' },
    { id: 'upload', frame: 'pair' },
  ],
  tables: [
    { id: 'list', frame: 'pair' },
    { id: 'grid', frame: 'pair' },
  ],
  workspaces: [
    { id: 'list', frame: 'hero' },
    {
      id: 'invitations',
      frame: 'side',
    },
    {
      id: 'categories',
      frame: 'side',
    },
  ],
  reports: [
    { id: 'templates', frame: 'hero' },
    { id: 'history', frame: 'side' },
    { id: 'schedules', frame: 'side' },
  ],
  taxDeclaration: [
    { id: 'draft', frame: 'hero' },
    {
      id: 'profile',
      frame: 'side',
    },
    {
      id: 'checks',
      frame: 'side',
    },
  ],
  netWorth: [
    { id: 'chart', frame: 'hero' },
    {
      id: 'allocation',
      frame: 'side',
    },
    { id: 'risk', frame: 'side' },
  ],
  budgets: [
    { id: 'cards', frame: 'pair' },
    { id: 'over', frame: 'pair' },
  ],
  advice: [
    { id: 'forecast', frame: 'pair' },
    { id: 'prices', frame: 'pair' },
  ],
  goals: [
    { id: 'list', frame: 'pair' },
    { id: 'progress', frame: 'pair' },
  ],
  roi: [
    { id: 'chart', frame: 'hero' },
    { id: 'inputs', frame: 'side' },
    { id: 'table', frame: 'side' },
  ],
  subscriptions: [
    {
      id: 'calendar',
      frame: 'hero',
    },
    { id: 'kpis', frame: 'side' },
    { id: 'list', frame: 'side' },
  ],
  crypto: [
    { id: 'portfolio', frame: 'pair' },
    { id: 'connect', frame: 'pair' },
  ],
};

/** Every locale falls back to these screenshots until its own are generated. */
export const FALLBACK_SCREENS_LOCALE = 'en';

/**
 * Where a fragment's screenshot is served from: public/tour/<locale>/, written there by
 * scripts/capture-tutorial-screenshots.mjs. Files are named after the page in kebab case
 * (`netWorth` → `net-worth-chart-light.webp`).
 */
export function tutorialScreenUrl(options: {
  locale: string;
  stepId: TutorialStepId;
  fragmentId: string;
  mode: 'light' | 'dark';
}): string {
  const page = options.stepId.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  return `/tour/${options.locale}/${page}-${options.fragmentId}-${options.mode}.webp`;
}
