import { describe, expect, it } from 'vitest';
import { bindingToTokens } from './shortcut-display';

describe('bindingToTokens', () => {
  it('renders a sequence as two keys around a separator', () => {
    expect(bindingToTokens('KeyG KeyA', false)).toEqual([
      { kind: 'key', text: 'G' },
      { kind: 'sep' },
      { kind: 'key', text: 'A' },
    ]);
  });

  it('renders a combination as adjacent keys', () => {
    expect(bindingToTokens('Alt+Shift+KeyT', false)).toEqual([
      { kind: 'key', text: 'ALT' },
      { kind: 'key', text: '\u21e7' },
      { kind: 'key', text: 'T' },
    ]);
  });

  it('prints the character a physical key carries', () => {
    expect(bindingToTokens('BracketLeft', false)).toEqual([{ kind: 'key', text: '[' }]);
    expect(bindingToTokens('Shift+Slash', false)).toEqual([
      { kind: 'key', text: '\u21e7' },
      { kind: 'key', text: '/' },
    ]);
  });

  it('resolves $mod per platform', () => {
    expect(bindingToTokens('$mod+KeyK', false)).toEqual([
      { kind: 'key', text: 'Ctrl' },
      { kind: 'key', text: 'K' },
    ]);
    expect(bindingToTokens('$mod+KeyK', true)).toEqual([
      { kind: 'key', text: '\u2318' },
      { kind: 'key', text: 'K' },
    ]);
  });
});
