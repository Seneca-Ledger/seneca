// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));
const permissionMocks = vi.hoisted(() => ({
  hasPermission: vi.fn((_permission: string) => true),
}));

vi.mock('@/app/lib/api', () => ({ default: apiMocks }));
vi.mock('next/navigation', () => ({ useRouter: () => routerMocks }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/usePermissions', () => ({ usePermissions: () => permissionMocks }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));

import CommandPalette from './CommandPalette';
import { closeCommandPalette, openCommandPalette } from './command-palette-store';

const FOUND = [
  {
    kind: 'transaction',
    id: 't-1',
    title: 'Landlord',
    subtitle: 'Rent for March',
    href: '/statements/transactions?highlight=t-1',
  },
];

function envelope(results: unknown[]) {
  return Promise.resolve({ data: { data: { query: '', results } } });
}

function callsTo(url: string) {
  return apiMocks.get.mock.calls.filter(([calledUrl]) => calledUrl === url);
}

function render(): void {
  renderWithQuery(<CommandPalette onOpenHelp={() => {}} />);
}

async function open(): Promise<HTMLInputElement> {
  render();
  act(() => openCommandPalette());
  return (await screen.findByRole('combobox')) as HTMLInputElement;
}

beforeEach(() => {
  apiMocks.get.mockReset();
  apiMocks.get.mockImplementation((url: string) =>
    url === '/search' ? envelope(FOUND) : envelope([]),
  );
  routerMocks.push.mockReset();
  permissionMocks.hasPermission.mockReset();
  permissionMocks.hasPermission.mockReturnValue(true);
  closeCommandPalette();
});

describe('CommandPalette', () => {
  it('stays closed until the store opens it', () => {
    render();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shows the command groups with the input focused', async () => {
    const input = await open();
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('Navigation')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
    expect(screen.getByText('Help & Support')).toBeTruthy();
  });

  it('renders a chord hint as two keys around "then"', async () => {
    await open();
    const row = screen.getByText('Toggle theme').closest('[role="option"]');
    expect(row?.textContent).toContain('ALT');
  });

  it('filters static commands straight away, without waiting for the backend', async () => {
    const input = await open();
    fireEvent.change(input, { target: { value: 'theme' } });
    expect(screen.getByText('Toggle theme')).toBeTruthy();
    expect(screen.queryByText('Export')).toBeNull();
  });

  it('sends one debounced search for a long enough query', async () => {
    const input = await open();
    fireEvent.change(input, { target: { value: 'rent' } });
    await waitFor(() => expect(callsTo('/search').length).toBe(1));
    expect(apiMocks.get.mock.calls.find(([url]) => url === '/search')?.[1]).toMatchObject({
      params: { q: 'rent' },
    });
    expect(await screen.findByText('Landlord')).toBeTruthy();
  });

  it('never searches for a one-character query', async () => {
    const input = await open();
    fireEvent.change(input, { target: { value: 'r' } });
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(callsTo('/search')).toHaveLength(0);
  });

  it('runs the highlighted row on Enter', async () => {
    const input = await open();
    fireEvent.change(input, { target: { value: 'dashboard' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith('/dashboard'));
  });

  it('closes on Escape', async () => {
    const input = await open();
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
  });

  it('runs an advertised chord while the field is empty, without typing it', async () => {
    const input = await open();
    fireEvent.keyDown(input, { key: 'g', code: 'KeyG' });
    fireEvent.keyDown(input, { key: 'd', code: 'KeyD' });
    await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith('/dashboard'));
    expect(input.value).toBe('');
  });

  it('hands both characters back when the chord does not complete', async () => {
    const input = await open();
    fireEvent.keyDown(input, { key: 'g', code: 'KeyG' });
    fireEvent.keyDown(input, { key: 'o', code: 'KeyO' });
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('go'));
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it('leaves the shortcuts alone once a query is typed', async () => {
    const input = await open();
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.keyDown(input, { key: 'g', code: 'KeyG' });
    fireEvent.keyDown(input, { key: 'd', code: 'KeyD' });
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it('scrolls the highlighted row into view', async () => {
    // On the prototype: the list re-renders as queries land, so stubbing the
    // nodes that happen to exist right now is a race.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const input = await open();
    scrollIntoView.mockClear();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('hides a command the user has no permission for', async () => {
    permissionMocks.hasPermission.mockImplementation((perm: string) => perm !== 'statement.upload');
    await open();
    expect(screen.queryByText('Upload a document')).toBeNull();
  });
});
