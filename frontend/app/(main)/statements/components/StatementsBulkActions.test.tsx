// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Command } from '@/app/components/command-palette/command-registry';
import { StatementsBulkActions } from './StatementsBulkActions';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'selectedCount' ? { value: '{count} selected' } : String(key),
      },
    ),
}));

function action(id: string, label: string, binding?: string): Command {
  return { id, label, icon: null, binding, group: 'page', run: vi.fn() };
}

function setup(): { actions: Command[]; trigger: HTMLElement } {
  const actions = [
    action('documents.createTable', 'Create table', 'KeyT KeyN'),
    action('documents.export', 'Export', 'Shift+KeyE'),
    action('documents.deleteSelected', 'Delete', 'Shift+Delete'),
  ];
  function Harness(): React.JSX.Element {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <p>Outside</p>
        <StatementsBulkActions
          selectedCount={2}
          selectedActionsOpen={open}
          selectionActions={actions}
          hasSelectedDuplicates={false}
          mergeDuplicatesLabel="Merge"
          dismissDuplicateLabel="Dismiss"
          markDuplicateLabel="Mark"
          onActionsOpenChange={setOpen}
          onMerge={vi.fn()}
          onDismiss={vi.fn()}
          onMarkDuplicate={vi.fn()}
          onExport={vi.fn()}
          onDelete={vi.fn()}
        />
      </div>
    );
  }
  render(<Harness />);
  return { actions, trigger: screen.getByRole('button', { name: /2 selected/ }) };
}

describe('StatementsBulkActions desktop menu', () => {
  it('lists every action it is given, with its shortcut', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);

    const rows = screen.getAllByRole('menuitem');
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('Create table'),
      expect.stringContaining('Export'),
      expect.stringContaining('Delete'),
    ]);
    expect(rows[0]?.querySelector('kbd')).toBeTruthy();
  });

  it('closes on a click outside', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.pointerDown(screen.getByText('Outside'));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs from the keyboard: ↓ opens, arrows move, Enter runs, Escape closes', () => {
    const { actions, trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const rows = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(rows[0]);

    fireEvent.keyDown(rows[0] as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.keyDown(rows[2] as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0] as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(rows[2]);

    // A focused button turns Enter into a click.
    fireEvent.click(rows[1] as HTMLElement);
    expect(actions[1]?.run).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const escape = fireEvent.keyDown(screen.getAllByRole('menuitem')[0] as HTMLElement, {
      key: 'Escape',
    });
    // Prevented, so the page's Escape leaves the selection alone.
    expect(escape).toBe(false);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
