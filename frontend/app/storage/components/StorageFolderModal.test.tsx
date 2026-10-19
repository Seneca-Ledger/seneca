import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StorageFolderModal } from './StorageFolderModal';

vi.mock('./StorageFoldersSidebar', () => ({
  StorageFoldersSidebar: () => <button type="button">Folder A</button>,
}));

vi.mock('./StorageTagsPanel', () => ({
  StorageTagsPanel: () => <button type="button">Tag A</button>,
}));

function renderModal(onClose = vi.fn()) {
  render(
    <>
      <button type="button">Page behind</button>
      <StorageFolderModal
        modalTitle="Folders"
        modalSubtitle="Organise your files"
        sidebarProps={{} as ComponentProps<typeof StorageFolderModal>['sidebarProps']}
        tagsPanelProps={{} as ComponentProps<typeof StorageFolderModal>['tagsPanelProps']}
        onClose={onClose}
      />
    </>,
  );
  return onClose;
}

describe('StorageFolderModal', () => {
  it('traps focus inside the dialog and closes on Escape', () => {
    const onClose = renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Folders' });
    expect(dialog.parentElement?.parentElement?.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not expose the dimmed backdrop as a Tab stop', () => {
    renderModal();

    // Besides real controls, only MUI's focus-trap sentinels may carry tabindex=0.
    const nonControlStops = Array.from(
      document.querySelectorAll<HTMLElement>('[tabindex="0"]'),
    ).filter(el => !el.matches('button, a[href], input') && !el.dataset.testid?.startsWith('sentinel'));
    expect(nonControlStops.map(el => el.outerHTML)).toEqual([]);
  });
});
