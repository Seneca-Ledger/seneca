import { describe, expect, it } from 'vitest';
import { nextStep, pageTurnOf, previousStep } from './tutorial-pager';

describe('tutorial pager', () => {
  it('walks through every step and stays on the last one', () => {
    const seen: number[] = [];
    let index = 0;
    for (let i = 0; i < 3; i += 1) {
      index = nextStep(index, 3);
      seen.push(index);
    }
    expect(seen).toEqual([1, 2, 2]);
  });

  it('goes back one step and stays on the first one', () => {
    expect(previousStep(2)).toBe(1);
    expect(previousStep(0)).toBe(0);
  });

  it('stays on the first step when there is only one', () => {
    expect(nextStep(0, 1)).toBe(0);
  });
});

describe('pageTurnOf', () => {
  it('turns pages with the arrow keys', () => {
    expect(pageTurnOf('ArrowRight', false)).toBe('next');
    expect(pageTurnOf('ArrowLeft', false)).toBe('back');
  });

  it('reverses them right to left', () => {
    expect(pageTurnOf('ArrowRight', true)).toBe('back');
    expect(pageTurnOf('ArrowLeft', true)).toBe('next');
  });

  it('ignores other keys', () => {
    expect(pageTurnOf('Enter', false)).toBeNull();
  });
});
