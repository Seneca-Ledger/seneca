// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GOAL_COVER_PRESETS } from '../lib/goal-cover-presets';
import { GoalCoverPicker, type GoalCoverPickerLabels } from './GoalCoverPicker';

vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ isOpen, title, children }: { isOpen: boolean; title: React.ReactNode; children: React.ReactNode }) =>
    isOpen ? (
      <div>
        {title}
        {children}
      </div>
    ) : null,
}));

vi.mock('../hooks/useCoverSearch', () => ({
  useCoverSearch: () => ({
    results: [],
    isPending: false,
    error: null,
    hasSearched: false,
    runSearch: vi.fn(),
  }),
}));

// Every preset name reads as its id with a capital, so tiles are found by name.
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => ({
          value: String(key).charAt(0).toUpperCase() + String(key).slice(1),
        }),
      },
    ),
}));

const labels: GoalCoverPickerLabels = {
  title: 'Goal cover',
  presets: 'Built-in',
  photos: 'Photo search',
  searchPlaceholder: 'Search',
  search: 'Search',
  noResults: 'Nothing found',
  searchHint: 'Type a word',
  licenceNote: 'Photos from',
  remove: 'Remove cover',
  close: 'Back',
};

function renderPicker(selection: React.ComponentProps<typeof GoalCoverPicker>['selection']) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <GoalCoverPicker
      open
      selection={selection}
      labels={labels}
      onSelect={onSelect}
      onClose={onClose}
    />,
  );
  return { onSelect, onClose };
}

describe('GoalCoverPicker', () => {
  it('names every tile and draws it in an earthy tone, never a gradient', () => {
    renderPicker(null);

    for (const preset of GOAL_COVER_PRESETS) {
      const tile = screen.getByRole('button', {
        name: preset.id.charAt(0).toUpperCase() + preset.id.slice(1),
      });
      expect(tile).toHaveAttribute('title');
      expect(tile.querySelector('.seneca-goal-cover')?.getAttribute('data-tone')).toBe(
        String(preset.tone),
      );
    }
  });

  it('marks the picked cover and applies a new pick at once', () => {
    const { onSelect, onClose } = renderPicker({ kind: 'preset', preset: 'home' });

    const home = screen.getByRole('button', { name: 'Home' });
    expect(home).toHaveAttribute('aria-pressed', 'true');
    expect(home.querySelector('.seneca-goal-cover-tile__tick')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Travel' }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'preset', preset: 'travel' });
    expect(onClose).toHaveBeenCalled();
  });

  it('offers to remove a cover only when there is one, and has no Close button', () => {
    renderPicker(null);
    expect(screen.queryByRole('button', { name: 'Remove cover' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('removes the cover and closes', () => {
    const { onSelect, onClose } = renderPicker({ kind: 'preset', preset: 'home' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove cover' }));

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });
});
