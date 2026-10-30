/**
 * The next round number worth noticing, and when the current pace reaches it.
 *
 * Crossing one is the thing people actually celebrate — "hit 100k", "crossed
 * a million" is most of what gets written about net worth — and a chart that
 * never mentions the next one makes you do the arithmetic yourself every time.
 *
 * The ladder is 1, 2, 5 × 10ⁿ, which lands on the numbers people name
 * (100k, 200k, 500k, 1M) in any currency without knowing anything about it.
 */
export interface Milestone {
  target: number;
  remaining: number;
  /** When the window's pace gets there, or null when it is not heading there. */
  reachedOn: string | null;
}

const STEPS = [1, 2, 5];

export function nextMilestone(
  current: number,
  change: number,
  days: number,
  today = new Date(),
): Milestone | null {
  if (!(current > 0)) {
    return null;
  }

  const target = nextRoundNumber(current);
  const perDay = days > 0 ? change / days : 0;
  const remaining = target - current;

  return {
    target,
    remaining,
    reachedOn: perDay > 0 ? addDays(today, Math.ceil(remaining / perDay)) : null,
  };
}

function nextRoundNumber(current: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(current));
  for (const step of STEPS) {
    const candidate = step * magnitude;
    if (candidate > current) {
      return candidate;
    }
  }
  return 10 * magnitude;
}

function addDays(from: Date, days: number): string | null {
  // Beyond a working lifetime the number says "not at this pace", not a date.
  if (!Number.isFinite(days) || days > 365 * 50) {
    return null;
  }
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
