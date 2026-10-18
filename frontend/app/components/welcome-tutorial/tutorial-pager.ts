/** The guide turns one page per step; it stops at either end instead of wrapping. */
export function nextStep(index: number, stepCount: number): number {
  return Math.max(0, Math.min(index + 1, stepCount - 1));
}

export function previousStep(index: number): number {
  return Math.max(0, index - 1);
}

/** Arrow keys turn the pages; right-to-left layouts turn them the other way. */
export function pageTurnOf(key: string, rtl: boolean): 'next' | 'back' | null {
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') {
    return null;
  }
  return (key === 'ArrowRight') !== rtl ? 'next' : 'back';
}
