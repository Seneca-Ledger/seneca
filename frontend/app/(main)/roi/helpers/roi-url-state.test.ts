import { describe, expect, it } from 'vitest';
import { parseReturnsRange, parseRoiTab, withRoiParams } from './roi-url-state';

describe('roi url state', () => {
  it('opens on performance over a year unless the address says otherwise', () => {
    expect(parseRoiTab(null)).toBe('performance');
    expect(parseRoiTab('calculator')).toBe('calculator');
    expect(parseRoiTab('nonsense')).toBe('performance');
    expect(parseReturnsRange(undefined)).toBe('1y');
    expect(parseReturnsRange('5y')).toBe('5y');
    expect(parseReturnsRange('90d')).toBe('1y');
  });

  it('writes only what differs from the defaults and keeps other parameters', () => {
    expect(withRoiParams('focus=x', { tab: 'calculator' })).toBe('focus=x&tab=calculator');
    expect(withRoiParams('tab=calculator&range=5y', { tab: 'performance' })).toBe('range=5y');
    expect(withRoiParams('range=5y', { range: '1y' })).toBe('');
    expect(withRoiParams('range=5y', { range: null })).toBe('');
  });
});
