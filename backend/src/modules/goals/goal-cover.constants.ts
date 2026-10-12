/**
 * Bundled covers. The client draws each one as a gradient tile with an icon,
 * so the set costs no bytes, no network call and no licence — which is what
 * makes it the right fallback when the photo search is rate-limited or the
 * deployment has no outbound network at all.
 *
 * These ids are a wire contract: a goal stores the string, and the client maps
 * it to a drawing. Renaming one orphans every goal that chose it.
 */
export const GOAL_COVER_PRESETS = [
  'travel',
  'home',
  'car',
  'education',
  'emergency',
  'wedding',
  'retirement',
  'camera',
  'tech',
  'health',
  'gift',
  'pet',
  'sport',
  'renovation',
  'business',
  'investment',
] as const;

export type GoalCoverPreset = (typeof GOAL_COVER_PRESETS)[number];

/**
 * Re-exported for the goal-cover code. The bundled presets above are what
 * keeps the picker useful when the day's Openverse allowance is gone.
 */
export { OPENVERSE_API } from '../../common/utils/openverse.util';

/**
 * Results per search page — a 3-column grid, six rows deep.
 *
 * Thumbnails, not searches, are the binding limit: every result on screen costs
 * one of the day's 1000 thumbnails, so a page of 18 puts the ceiling near 55
 * cold searches a day. Caching each thumbnail for a week (see the service)
 * makes everything after the first look at a result free.
 */
export const COVER_SEARCH_PAGE_SIZE = 18;

/** Openverse stops paginating well before this; the cap only bounds the input. */
export const COVER_SEARCH_MAX_PAGE = 20;

export const COVER_SEARCH_TIMEOUT_MS = 8000;
export const COVER_DOWNLOAD_TIMEOUT_MS = 10000;

/**
 * Openverse thumbnails are 600px JPEGs of about 25 KB. The ceiling is set well
 * above that so an unusually large one still stores, and far below anything
 * that would make the uploads directory a liability.
 */
export const COVER_MAX_BYTES = 2 * 1024 * 1024;

export { OPENVERSE_CONTENT_TYPES as COVER_CONTENT_TYPES } from '../../common/utils/openverse.util';

/** Where stored covers live, under the uploads directory. */
export const COVER_DIRECTORY = 'goal-covers';

export function isGoalCoverPreset(value: string): value is GoalCoverPreset {
  return (GOAL_COVER_PRESETS as readonly string[]).includes(value);
}
