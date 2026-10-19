import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceProfileSection } from './WorkspaceProfileSection';

const patchMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn(async () => undefined));
const workspaceMock = vi.hoisted(() => ({
  current: { id: 'ws-1', settings: null as Record<string, unknown> | null },
}));

vi.mock('@/app/lib/api', () => ({ default: { patch: patchMock } }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: workspaceMock.current, refreshWorkspaces: refreshMock }),
}));

const tx = (path: string[], fallback: string) => fallback;

describe('WorkspaceProfileSection', () => {
  beforeEach(() => {
    patchMock.mockReset();
    refreshMock.mockClear();
    workspaceMock.current = { id: 'ws-1', settings: null };
  });

  it('shows business for a workspace that never chose, and saves home then re-reads the workspace', async () => {
    patchMock.mockResolvedValue({ data: {} });
    render(<WorkspaceProfileSection tx={tx} />);

    expect(screen.getByRole('button', { name: /Business/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));

    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/workspaces/ws-1', { profile: 'home' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it('does nothing when the current profile is pressed again', () => {
    workspaceMock.current = { id: 'ws-1', settings: { profile: 'home' } };
    render(<WorkspaceProfileSection tx={tx} />);

    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    expect(patchMock).not.toHaveBeenCalled();
  });
});
