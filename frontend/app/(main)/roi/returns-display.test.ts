import { describe, expect, it } from 'vitest';
import type { ReturnsSource } from './hooks/useReturns';
import { flagSubject, formatSignedPercent, rangeLabel } from './returns-display';

describe('returns display', () => {
  it('signs a percentage and says nothing when there is no figure', () => {
    expect(formatSignedPercent(4.2, 'en')).toBe('+4.2%');
    expect(formatSignedPercent(-1, 'en')).toBe('-1%');
    expect(formatSignedPercent(0, 'en')).toBe('0%');
    expect(formatSignedPercent(null, 'en')).toBe('—');
  });

  it('labels the presets the way the net worth page does', () => {
    expect(rangeLabel('30d', 'All')).toBe('1M');
    expect(rangeLabel('ytd', 'All')).toBe('YTD');
    expect(rangeLabel('5y', 'All')).toBe('5Y');
    expect(rangeLabel('all', 'Alle')).toBe('Alle');
  });

  it('names what a flag is about: the detail if given, else its line', () => {
    const sources = [{ id: 'broker', name: 'Broker', kind: 'account' } as ReturnsSource];
    const name = (source: ReturnsSource) => source.name;

    expect(flagSubject({ code: 'stale_price', sourceId: 'broker', detail: 'ACME' }, sources, name)).toBe(
      'ACME',
    );
    expect(flagSubject({ code: 'opening_value_unknown', sourceId: 'broker' }, sources, name)).toBe(
      'Broker',
    );
    expect(flagSubject({ code: 'xirr_no_solution' }, sources, name)).toBe('');
  });
});
