import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthHero } from './AuthHero';

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return { ...actual, useReducedMotion: () => reduced.value };
});

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    features: {
      statements: 'F1',
      receipts: 'F2',
      categories: 'F3',
      budgets: 'F4',
      forecast: 'F5',
      subscriptions: 'F6',
      currencies: 'F7',
      workspaces: 'F8',
      reports: 'F9',
    },
  }),
}));

const shown = (): string[] =>
  screen.getAllByRole('listitem').map(item => item.textContent ?? '');

describe('AuthHero', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reduced.value = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows three promises at a time and rotates to the next three', async () => {
    render(<AuthHero title="Lumio" tagline="Tagline" />);
    expect(shown()).toEqual(['F1', 'F2', 'F3']);

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(shown()).toEqual(['F4', 'F5', 'F6']);
  });

  it('stays on the first three when the system asks for reduced motion', async () => {
    reduced.value = true;
    render(<AuthHero title="Lumio" tagline="Tagline" />);
    await act(async () => {
      vi.advanceTimersByTime(12000);
    });
    expect(shown()).toEqual(['F1', 'F2', 'F3']);
  });
});
