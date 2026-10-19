import {
  isoWeek,
  localDay,
  type RetainedVersion,
  selectVersionsToDelete,
} from '../../../../src/modules/versions/version-retention';

const NOW = new Date('2026-10-17T12:00:00Z');
const daysAgo = (days: number, hour = 3) =>
  new Date(Date.UTC(2026, 9, 17 - days, hour, 0, 0));
const version = (id: string, takenAt: Date, status: RetainedVersion['status'] = 'ready') => ({
  id,
  takenAt,
  status,
});

describe('version retention', () => {
  it('keeps one version a day for the last month: the newest of each day', () => {
    const versions = [
      version('today-night', daysAgo(0, 1)),
      version('today-manual', daysAgo(0, 9)),
      version('yesterday', daysAgo(1)),
      version('two-days', daysAgo(2)),
    ];
    expect(selectVersionsToDelete(versions, NOW, 'UTC')).toEqual(['today-night']);
  });

  it('keeps one a week from a month back, and one a month after half a year', () => {
    // 2026-08-31 (Mon) .. 2026-09-06 (Sun) is one ISO week, 41-47 days back.
    const sameWeek = [41, 42, 43, 44, 45, 46, 47].map(days => version(`w${days}`, daysAgo(days)));
    // 2025-12 is one month, well past 30 days + 26 weeks.
    const sameMonth = [300, 305, 310].map(days => version(`m${days}`, daysAgo(days)));
    const doomed = selectVersionsToDelete([...sameWeek, ...sameMonth], NOW, 'UTC');

    expect(doomed.sort()).toEqual(['w42', 'w43', 'w44', 'w45', 'w46', 'w47', 'm305', 'm310'].sort());
  });

  it('reads days in the owner time zone', () => {
    // 23:30 UTC on the 15th is already the 16th in Tel Aviv.
    const late = version('late', new Date('2026-10-15T23:30:00Z'));
    const morning = version('morning', new Date('2026-10-16T05:00:00Z'));
    expect(selectVersionsToDelete([late, morning], NOW, 'UTC')).toEqual([]);
    expect(selectVersionsToDelete([late, morning], NOW, 'Asia/Jerusalem')).toEqual(['late']);
  });

  it('never deletes the newest version, a running one or one just opened', () => {
    const versions = [
      version('only', daysAgo(400)),
      version('older-same-month', daysAgo(405)),
      version('running', daysAgo(0), 'running'),
    ];
    expect(selectVersionsToDelete(versions, NOW, 'UTC')).toEqual(['older-same-month']);
    expect(
      selectVersionsToDelete(versions, NOW, 'UTC', new Set(['older-same-month'])),
    ).toEqual([]);
  });

  it('lists a failed attempt for a week, then lets it go', () => {
    const versions = [
      version('ok', daysAgo(0)),
      version('failed-recent', daysAgo(2), 'failed'),
      version('failed-old', daysAgo(9), 'failed'),
    ];
    expect(selectVersionsToDelete(versions, NOW, 'UTC')).toEqual(['failed-old']);
  });

  it('numbers weeks the ISO way, across a year boundary', () => {
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(isoWeek('2026-12-28')).toBe('2026-W53');
    expect(localDay(new Date('2026-03-29T00:30:00Z'), 'Europe/Berlin')).toBe('2026-03-29');
  });
});
