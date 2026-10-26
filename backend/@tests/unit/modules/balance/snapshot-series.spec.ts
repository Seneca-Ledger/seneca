import {
  decimate,
  everyDay,
  groupSnapshots,
  latestOnOrBefore,
  presetWindowStart,
} from '@/modules/balance/snapshot-series';

describe('snapshot series', () => {
  it('opens a preset window the right number of days back, and the year on January 1st', () => {
    expect(presetWindowStart('30d', '2026-10-10')).toBe('2026-09-10');
    expect(presetWindowStart('ytd', '2026-10-10')).toBe('2026-01-01');
    expect(presetWindowStart('1y', '2026-10-10')).toBe('2025-10-10');
  });

  it('holds each value until the next one is entered', () => {
    const byAccount = groupSnapshots([
      { accountId: 'a', snapshotDate: '2026-01-05', amount: 1 },
      { accountId: 'b', snapshotDate: '2026-01-01', amount: 9 },
      { accountId: 'a', snapshotDate: '2026-01-10', amount: 2 },
    ]);

    expect(latestOnOrBefore(byAccount.get('a'), '2026-01-04')).toBeNull();
    expect(latestOnOrBefore(byAccount.get('a'), '2026-01-05')?.amount).toBe(1);
    expect(latestOnOrBefore(byAccount.get('a'), '2026-01-09')?.amount).toBe(1);
    expect(latestOnOrBefore(byAccount.get('a'), '2026-02-01')?.amount).toBe(2);
    expect(latestOnOrBefore(byAccount.get('c'), '2026-02-01')).toBeNull();
  });

  it('lists every day of a window, both ends included', () => {
    expect(everyDay('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('thins a long series but keeps its ends and its extremes, extra fields and all', () => {
    const points = everyDay('2026-01-01', '2026-12-31').map((date, index) => ({
      date,
      value: index === 100 ? -500 : index,
      netContributed: index * 2,
    }));

    const kept = decimate(points, 50);

    expect(kept.length).toBeLessThanOrEqual(50);
    expect(kept[0]).toBe(points[0]);
    expect(kept[kept.length - 1]).toBe(points[points.length - 1]);
    expect(kept).toContain(points[100]);
    expect(kept[1]).toHaveProperty('netContributed');
  });
});
