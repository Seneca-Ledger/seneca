import {
  Briefcase,
  Camera,
  Car,
  Dumbbell,
  Gift,
  GraduationCap,
  Heart,
  Home,
  type LucideIcon,
  Monitor,
  PawPrint,
  PiggyBank,
  Plane,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Wrench,
} from '@/app/components/icons';

export interface GoalCoverPreset {
  /** The wire value stored on the goal. Renaming one orphans every goal that chose it. */
  id: string;
  Icon: LucideIcon;
  /** Two stops of a diagonal gradient, drawn behind the icon. */
  from: string;
  to: string;
}

/**
 * The bundled covers: a gradient tile with an icon, drawn here rather than
 * downloaded. They cost no bytes, no network call and no licence, which is
 * what makes them the picker's first screen and its fallback when the photo
 * search has used up the day's allowance.
 *
 * The ids mirror GOAL_COVER_PRESETS on the server, which validates them.
 *
 * Fixed hex rather than theme tokens on purpose: a cover is a picture, and it
 * should look the same in light and dark the way a photo does. The white icon
 * is legible on every gradient here.
 */
export const GOAL_COVER_PRESETS: readonly GoalCoverPreset[] = [
  { id: 'travel', Icon: Plane, from: '#0ea5e9', to: '#2563eb' },
  { id: 'home', Icon: Home, from: '#f59e0b', to: '#d97706' },
  { id: 'car', Icon: Car, from: '#64748b', to: '#334155' },
  { id: 'education', Icon: GraduationCap, from: '#8b5cf6', to: '#6d28d9' },
  { id: 'emergency', Icon: ShieldCheck, from: '#ef4444', to: '#b91c1c' },
  { id: 'wedding', Icon: Heart, from: '#f472b6', to: '#db2777' },
  { id: 'retirement', Icon: PiggyBank, from: '#14b8a6', to: '#0f766e' },
  { id: 'camera', Icon: Camera, from: '#475569', to: '#1e293b' },
  { id: 'tech', Icon: Monitor, from: '#6366f1', to: '#4338ca' },
  { id: 'health', Icon: Stethoscope, from: '#22c55e', to: '#15803d' },
  { id: 'gift', Icon: Gift, from: '#fb7185', to: '#e11d48' },
  { id: 'pet', Icon: PawPrint, from: '#a3703a', to: '#78350f' },
  { id: 'sport', Icon: Dumbbell, from: '#f97316', to: '#c2410c' },
  { id: 'renovation', Icon: Wrench, from: '#eab308', to: '#a16207' },
  { id: 'business', Icon: Briefcase, from: '#0891b2', to: '#155e75' },
  { id: 'investment', Icon: TrendingUp, from: '#10b981', to: '#047857' },
];

const BY_ID = new Map(GOAL_COVER_PRESETS.map(preset => [preset.id, preset]));

/** Null for an id this build does not know — an older client against a newer server. */
export function findGoalCoverPreset(id: string): GoalCoverPreset | null {
  return BY_ID.get(id) ?? null;
}
