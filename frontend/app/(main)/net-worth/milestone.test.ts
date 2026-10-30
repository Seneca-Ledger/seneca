import { describe, expect, it } from 'vitest';
import { nextMilestone } from './milestone';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('nextMilestone', () => {
  it.each([
    [90_000, 100_000],
    [100_000, 200_000],
    [230_000, 500_000],
    [600_000, 1_000_000],
    [1_400_000, 2_000_000],
  ])('puts %i on the way to %i', (current: number, target: number) => {
    expect(nextMilestone(current, 1, 30)?.target).toBe(target);
  });

  it('dates the milestone by the pace of the window', () => {
    // 3 000 a day, 30 000 to go: ten days.
    const milestone = nextMilestone(970_000, 90_000, 30, day('2026-10-02'));

    expect(milestone?.remaining).toBe(30_000);
    expect(milestone?.reachedOn).toBe('2026-10-12');
  });

  it('gives no date when the number is going the other way', () => {
    expect(nextMilestone(970_000, -5_000, 30)?.reachedOn).toBeNull();
  });

  it('gives no date when the pace would take a lifetime', () => {
    expect(nextMilestone(970_000, 1, 365)?.reachedOn).toBeNull();
  });

  it('has nothing to say to someone who owns nothing yet', () => {
    expect(nextMilestone(0, 100, 30)).toBeNull();
    expect(nextMilestone(-500, 100, 30)).toBeNull();
  });
});
