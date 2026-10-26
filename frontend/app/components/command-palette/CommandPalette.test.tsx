// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));
const pathnameMock = vi.hoisted(() => ({ value: '/dashboard' }));
const permissionMocks = vi.hoisted(() => ({
  hasPermission: vi.fn((_permission: string) => true),
}));

vi.mock('@/app/lib/api', () => ({ default: apiMocks }));
vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
  usePathname: () => pathnameMock.value,
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/usePermissions', () => ({ usePermissions: () => permissionMocks }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: null, setUser: vi.fn() }) }));

import CommandPalette from './CommandPalette';
import { closeCommandPalette, openCommandPalette } from './command-palette-store';
import { openPalettePicker, usePageCommands } from './page-commands-store';

/** Stands in for a page that lends the palette its commands while mounted. */
function PageWithCommands({ run }: { run: () => void }): null {
  usePageCommands({
    title: '2 selected',
    commands: [
      { id: 'documents.addToTable', group: 'page', label: 'Add selected to a table', icon: null, binding: 'KeyT KeyA', run },
    ],
  });
  return null;
}

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
  pathnameMock.value = '/dashboard';
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

  it('keeps the cursor where the arrow keys put it', async () => {
    const input = await open();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await new Promise(resolve => setTimeout(resolve, 50));
    const options = screen.getAllByRole('option');
    expect(options[2].getAttribute('aria-selected')).toBe('true');
  });

  it('keeps focus in the field when a row or heading is pressed', async () => {
    await open();
    const row = screen.getAllByRole('option')[1];
    expect(fireEvent.mouseDown(row)).toBe(false);
    expect(fireEvent.mouseDown(screen.getByText('Navigation'))).toBe(false);
  });

  it('does not scroll the list under a hovering pointer', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    await open();
    const row = screen.getAllByRole('option')[3];
    const matches = vi.spyOn(row, 'matches').mockImplementation(sel => sel === ':hover');
    scrollIntoView.mockClear();
    fireEvent.mouseMove(row);
    await waitFor(() => expect(row.getAttribute('aria-selected')).toBe('true'));
    expect(scrollIntoView).not.toHaveBeenCalled();
    matches.mockRestore();
  });

  it('hides a command the user has no permission for', async () => {
    permissionMocks.hasPermission.mockImplementation((perm: string) => perm !== 'statement.upload');
    await open();
    expect(screen.queryByText('Upload a document')).toBeNull();
  });

  it('runs a $mod shortcut from the field: Ctrl+comma opens settings', async () => {
    const input = await open();
    fireEvent.keyDown(input, { key: ',', code: 'Comma', ctrlKey: true });
    await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith('/settings/profile'));
  });

  it('shows Open filters on the Documents list and nowhere else', async () => {
    await open();
    expect(screen.queryByText('Open filters')).toBeNull();
    act(() => closeCommandPalette());
    pathnameMock.value = '/statements/submit';
    act(() => openCommandPalette());
    expect(await screen.findByText('Open filters')).toBeTruthy();
  });

  it('shows the page\'s own commands first, under the page\'s heading', async () => {
    const run = vi.fn();
    renderWithQuery(<PageWithCommands run={run} />);
    const input = await open();
    const options = screen.getAllByRole('option');
    expect(options[0]?.textContent).toContain('Add selected to a table');
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.keyDown(input, { key: 't', code: 'KeyT' });
    fireEvent.keyDown(input, { key: 'a', code: 'KeyA' });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it('opens a picker, filters it and hands back the chosen item', async () => {
    render();
    const onPick = vi.fn();
    act(() =>
      openPalettePicker({
        id: 'pick-1',
        placeholder: 'Choose a category…',
        items: [
          { id: 'cat-groceries', label: 'Groceries', hint: '3' },
          { id: 'cat-travel', label: 'Travel', hint: '1' },
        ],
        onPick,
      }),
    );
    const input = (await screen.findByPlaceholderText('Choose a category…')) as HTMLInputElement;
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'trav' } });
    expect(screen.queryByText('Groceries')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('cat-travel');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());

    // The next open is the usual list again.
    act(() => openCommandPalette());
    expect(await screen.findByPlaceholderText(/Search or type a command/)).toBeTruthy();
  });

  it('turns into a picker when a page command opens one', async () => {
    const run = () =>
      openPalettePicker({
        id: 'pick-2',
        placeholder: 'Choose a table…',
        items: [{ id: 'table-1', label: 'March documents' }],
        onPick: vi.fn(),
      });
    renderWithQuery(<PageWithCommands run={run} />);
    await open();
    fireEvent.click(screen.getByText('Add selected to a table'));
    expect(await screen.findByPlaceholderText('Choose a table…')).toBeTruthy();
    expect(screen.getByText('March documents')).toBeTruthy();
  });
});
