import { describe, expect, it } from 'vitest';
import { avatarInitial, avatarTone } from './initial-avatar';

const member = 'member-1@example.com';
const other = 'member-2@example.com';

describe('avatarInitial', () => {
  it('is the first letter of the name, upper-cased', () => {
    expect(avatarInitial('  member One')).toBe('M');
    expect(avatarInitial('ёлка')).toBe('Ё');
  });

  it('is a question mark when there is no name', () => {
    expect(avatarInitial('')).toBe('?');
    expect(avatarInitial(null)).toBe('?');
  });
});

describe('avatarTone', () => {
  it('keeps one tint for one person', () => {
    expect(avatarTone(member)).toBe(avatarTone(member));
  });

  it('is a sage tint drawn from the theme tokens', () => {
    expect(avatarTone(member)).toMatch(/^color-mix\(.*var\(--card-bg\)\)$/);
  });

  it('gives different people different tints', () => {
    const tints = new Set(
      Array.from({ length: 30 }, (_, index) => avatarTone(`member-${index}@example.com`)),
    );
    expect(tints.size).toBeGreaterThan(3);
    expect(avatarTone(member)).not.toBe(avatarTone(other));
  });
});
