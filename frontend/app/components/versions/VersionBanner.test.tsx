import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatStoredDate, formatStoredDateTime } from '@/app/lib/user-format-store';
import { VersionBanner } from './VersionBanner';

const VERSION = { id: 'v1', takenAt: '2026-10-01T08:30:00.000Z', sourceWorkspaceId: 'home' };

const state = vi.hoisted(() => ({
  current: null as null | { id: string; name: string; kind: string; version: unknown },
  switchWorkspace: vi.fn(),
  refreshWorkspaces: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useReadOnlyWorkspace: () => {
    const isReadOnly = state.current?.kind === 'version';
    return { isReadOnly, version: isReadOnly ? state.current?.version : null };
  },
  useWorkspace: () => ({
    currentWorkspace: state.current,
    switchWorkspace: state.switchWorkspace,
    refreshWorkspaces: state.refreshWorkspaces,
  }),
}));
vi.mock('@/app/lib/api', () => ({ api: { post: state.post, delete: state.delete } }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  checkContract: async (_name: string, payload: unknown) => payload,
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(state.toast, { error: vi.fn() }),
}));

const insideVersion = () => {
  state.current = { id: 'ver-ws', name: 'Household', kind: 'version', version: VERSION };
};

describe('VersionBanner', () => {
  afterEach(() => {
    state.current = null;
    vi.clearAllMocks();
  });

  it('shows nothing in an ordinary workspace', () => {
    state.current = { id: 'home', name: 'Household', kind: 'standard', version: null };

    const { container } = render(<VersionBanner />);

    expect(container.innerHTML).toBe('');
  });

  it('shows when the version was taken, that it is read only, and both ways out', () => {
    insideVersion();

    render(<VersionBanner />);

    const bar = screen.getByRole('status');
    expect(bar.textContent).toContain(formatStoredDateTime(VERSION.takenAt, 'en'));
    expect(bar.textContent).toContain('read only');
    expect(screen.getByRole('button', { name: 'Save as copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('goes back to the workspace the version was taken of, and closes the opened copy', async () => {
    insideVersion();
    state.switchWorkspace.mockResolvedValue(undefined);
    state.delete.mockResolvedValue({});

    render(<VersionBanner />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    });

    expect(state.switchWorkspace).toHaveBeenCalledWith('home');
    await waitFor(() => expect(state.delete).toHaveBeenCalledWith('/versions/v1/open'));
  });

  it('saves the version as a copy under the chosen name and closes', async () => {
    insideVersion();
    state.post.mockResolvedValue({ data: { workspaceId: 'ver-ws', name: 'Spring books' } });
    state.refreshWorkspaces.mockResolvedValue(undefined);

    render(<VersionBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Save as copy' }));

    const field = screen.getByLabelText('Name') as HTMLInputElement;
    expect(field.value).toBe(`Household — ${formatStoredDate(VERSION.takenAt, 'en')}`);
    fireEvent.change(field, { target: { value: '  Spring books ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save copy' }));
    });

    expect(state.post).toHaveBeenCalledWith('/versions/v1/copy', { name: 'Spring books' });
    expect(state.refreshWorkspaces).toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith('Saved as a copy — you can make changes now');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
