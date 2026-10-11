// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';

const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
  usePathname: () => '/statements/submit',
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('@/app/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: { query: '', results: [] } } })) },
}));

import { openCommandPalette } from './command-palette/command-palette-store';
import { KeyboardShortcutsProvider } from './keyboard-shortcuts-provider';
import { DrawerShell } from './ui/drawer-shell';

function renderWithDrawer(onClose: () => void): void {
  renderWithQuery(
    <KeyboardShortcutsProvider>
      <DrawerShell isOpen onClose={onClose} title="Create expense">
        <button type="button">Choose files</button>
      </DrawerShell>
    </KeyboardShortcutsProvider>,
  );
}

beforeEach(() => {
  routerMocks.push.mockReset();
});

describe('KeyboardShortcutsProvider with a drawer open', () => {
  it('closes the drawer and navigates on a chord', async () => {
    const onClose = vi.fn();
    renderWithDrawer(onClose);
    await screen.findByText('Choose files');
    const target = document.activeElement ?? document.body;
    fireEvent.keyDown(target, { key: 'g', code: 'KeyG' });
    fireEvent.keyDown(target, { key: 'd', code: 'KeyD' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).toHaveBeenCalledWith('/dashboard');
  });

  it('closes the drawer when the palette jumps somewhere', async () => {
    const onClose = vi.fn();
    renderWithDrawer(onClose);
    await screen.findByText('Choose files');
    act(() => openCommandPalette());
    const input = await screen.findByRole('combobox');
    fireEvent.keyDown(input, { key: 'g', code: 'KeyG' });
    fireEvent.keyDown(input, { key: 'd', code: 'KeyD' });
    await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith('/dashboard'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
