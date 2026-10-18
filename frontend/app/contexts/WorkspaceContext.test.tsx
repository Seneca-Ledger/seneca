import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReadOnlyWorkspace, useWorkspace, WorkspaceProvider } from './WorkspaceContext';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
}));

vi.mock('../lib/api', () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock('@/app/lib/csrf', () => ({ hasSessionCookie: () => true }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  checkContract: async (_name: string, payload: unknown) => payload,
  reportContractDrift: async (_name: string, payload: unknown) => payload,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

const workspace = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Workspace ${id}`,
  kind: 'standard',
  version: null,
  ...extra,
});

const HOME = workspace('home');
const OTHER = workspace('other');
const VERSION = workspace('ver-ws', {
  name: 'Workspace home',
  kind: 'version',
  version: { id: 'v1', takenAt: '2026-10-01T08:30:00.000Z', sourceWorkspaceId: 'home' },
});

function Probe(): React.JSX.Element {
  const { currentWorkspace, workspaces, openVersion } = useWorkspace();
  const { isReadOnly, version } = useReadOnlyWorkspace();
  return (
    <div>
      <div data-testid="current">{currentWorkspace?.id ?? 'none'}</div>
      <div data-testid="list">{workspaces.map(w => w.id).join(',')}</div>
      <div data-testid="read-only">{String(isReadOnly)}</div>
      <div data-testid="source">{version?.sourceWorkspaceId ?? 'none'}</div>
      <button type="button" onClick={() => void openVersion('v1')}>
        open
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <WorkspaceProvider>
      <Probe />
    </WorkspaceProvider>,
  );

describe('WorkspaceProvider and past versions', () => {
  beforeEach(() => {
    mocks.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('keeps opened versions out of the list but resolves into one when it is current', async () => {
    localStorage.setItem('currentWorkspaceId', 'ver-ws');
    mocks.get.mockResolvedValue({ data: [HOME, VERSION, OTHER] });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('ver-ws'));
    expect(screen.getByTestId('list').textContent).toBe('home,other');
    expect(screen.getByTestId('read-only').textContent).toBe('true');
    expect(screen.getByTestId('source').textContent).toBe('home');
  });

  it('is not read only in an ordinary workspace', async () => {
    localStorage.setItem('currentWorkspaceId', 'other');
    mocks.get.mockResolvedValue({ data: [HOME, VERSION, OTHER] });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('other'));
    expect(screen.getByTestId('read-only').textContent).toBe('false');
    expect(screen.getByTestId('source').textContent).toBe('none');
  });

  it('never falls back into a version when the stored workspace is gone', async () => {
    localStorage.setItem('currentWorkspaceId', 'discarded-version');
    mocks.get.mockResolvedValue({ data: [VERSION, HOME] });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('home'));
    expect(localStorage.getItem('currentWorkspaceId')).toBe('home');
  });

  it('opens a version, switches into it and lands on the dashboard', async () => {
    localStorage.setItem('currentWorkspaceId', 'home');
    mocks.get.mockResolvedValueOnce({ data: [HOME, OTHER] });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('home'));

    // The copy is new: the list learns about it only on the refresh after the switch.
    mocks.get.mockResolvedValue({ data: [HOME, VERSION, OTHER] });
    mocks.post.mockImplementation(async (url: string) =>
      url === '/versions/v1/open'
        ? { data: { workspaceId: 'ver-ws', name: 'Workspace home' } }
        : { data: {} },
    );

    await act(async () => {
      screen.getByRole('button', { name: 'open' }).click();
    });

    await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('ver-ws'));
    expect(mocks.post.mock.calls.map(call => call[0])).toEqual([
      '/versions/v1/open',
      '/workspaces/ver-ws/switch',
    ]);
    expect(localStorage.getItem('currentWorkspaceId')).toBe('ver-ws');
    expect(screen.getByTestId('list').textContent).toBe('home,other');
    expect(screen.getByTestId('read-only').textContent).toBe('true');
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
  });
});
