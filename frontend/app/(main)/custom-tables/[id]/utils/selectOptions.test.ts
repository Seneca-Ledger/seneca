import { describe, expect, it } from 'vitest';
import { findOption, normalizeSelectOptions, optionValues } from './selectOptions';

describe('normalizeSelectOptions', () => {
  it('keeps plain string options as values without colour', () => {
    expect(normalizeSelectOptions({ options: ['Lead', 'Won'] })).toEqual([
      { value: 'Lead' },
      { value: 'Won' },
    ]);
  });

  it('accepts objects with colour and label, mixed with strings', () => {
    expect(
      normalizeSelectOptions({
        options: ['Lead', { value: 'Won', color: '#22c55e', label: 'Won 🎉' }],
      }),
    ).toEqual([{ value: 'Lead' }, { value: 'Won', color: '#22c55e', label: 'Won 🎉' }]);
  });

  it('drops empty values, duplicates and malformed colours', () => {
    expect(
      normalizeSelectOptions({
        options: ['', ' ', 'A', 'A', { value: 'B', color: 'green' }, { value: '' }, null as never],
      }),
    ).toEqual([{ value: 'A' }, { value: 'B' }]);
  });

  it('returns an empty list without options', () => {
    expect(normalizeSelectOptions(null)).toEqual([]);
    expect(normalizeSelectOptions({ options: 'nope' as never })).toEqual([]);
  });
});

describe('findOption / optionValues', () => {
  const options = normalizeSelectOptions({ options: [{ value: 'Won', color: '#22c55e' }] });

  it('finds by stored value', () => {
    expect(findOption(options, 'Won')?.color).toBe('#22c55e');
    expect(findOption(options, 'Lost')).toBeUndefined();
    expect(findOption(options, null)).toBeUndefined();
  });

  it('lists values only', () => {
    expect(optionValues({ options: ['A', { value: 'B', color: '#000000' }] })).toEqual(['A', 'B']);
  });
});
