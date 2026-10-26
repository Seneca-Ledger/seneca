import type { LucideIcon } from '@/app/components/icons';
import {
  Briefcase,
  Camera,
  Car,
  Dumbbell,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Monitor,
  PawPrint,
  PiggyBank,
  Plane,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Wrench,
} from '@/app/lib/category-line-icons';

/**
 * The earthy chart tones a cover is painted in: sage, terracotta, sand, dusty
 * blue, clay (`--cat-tone-1…5`) and stone (`--cat-tone-other`).
 */
export type GoalCoverTone = 1 | 2 | 3 | 4 | 5 | 'stone';

export type GoalCoverPresetId =
  | 'travel'
  | 'home'
  | 'car'
  | 'education'
  | 'emergency'
  | 'wedding'
  | 'retirement'
  | 'camera'
  | 'tech'
  | 'health'
  | 'gift'
  | 'pet'
  | 'sport'
  | 'renovation'
  | 'business'
  | 'investment';

export interface GoalCoverPreset {
  /** The wire value stored on the goal. Renaming one orphans every goal that chose it. */
  id: GoalCoverPresetId;
  Icon: LucideIcon;
  tone: GoalCoverTone;
}

/**
 * The bundled covers: a flat tile in one of the app's six earthy tones with a
 * line icon from the category set, drawn here rather than downloaded. They cost
 * no bytes, no network call and no licence, which is what makes them the
 * picker's first screen and its fallback when the photo search has used up the
 * day's allowance.
 *
 * The ids mirror GOAL_COVER_PRESETS on the server, which validates them. The
 * tones are theme variables, so dark mode gets its lighter set; the icon colour
 * per tone lives in `.seneca-goal-cover` (_goals.scss).
 */
export const GOAL_COVER_PRESETS: readonly GoalCoverPreset[] = [
  { id: 'travel', Icon: Plane, tone: 4 },
  { id: 'home', Icon: Home, tone: 5 },
  { id: 'car', Icon: Car, tone: 'stone' },
  { id: 'education', Icon: GraduationCap, tone: 1 },
  { id: 'emergency', Icon: ShieldCheck, tone: 2 },
  { id: 'wedding', Icon: Heart, tone: 2 },
  { id: 'retirement', Icon: PiggyBank, tone: 1 },
  { id: 'camera', Icon: Camera, tone: 'stone' },
  { id: 'tech', Icon: Monitor, tone: 4 },
  { id: 'health', Icon: Stethoscope, tone: 1 },
  { id: 'gift', Icon: Gift, tone: 3 },
  { id: 'pet', Icon: PawPrint, tone: 5 },
  { id: 'sport', Icon: Dumbbell, tone: 3 },
  { id: 'renovation', Icon: Wrench, tone: 5 },
  { id: 'business', Icon: Briefcase, tone: 4 },
  { id: 'investment', Icon: TrendingUp, tone: 1 },
];

const BY_ID = new Map<string, GoalCoverPreset>(
  GOAL_COVER_PRESETS.map(preset => [preset.id, preset]),
);

/** Null for an id this build does not know — an older client against a newer server. */
export function findGoalCoverPreset(id: string): GoalCoverPreset | null {
  return BY_ID.get(id) ?? null;
}
