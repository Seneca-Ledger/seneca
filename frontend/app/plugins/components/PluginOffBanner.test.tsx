import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginOffBanner } from './PluginOffBanner';

const setPluginsMock = vi.hoisted(() => vi.fn());
const workspaceMock = vi.hoisted(() => ({
  current: { id: 'ws-1', memberRole: 'owner', settings: null as Record<string, unknown> | null },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: workspaceMock.current,
    setWorkspacePlugins: setPluginsMock,
  }),
}));

describe('PluginOffBanner', () => {
  beforeEach(() => {
    setPluginsMock.mockReset();
    workspaceMock.current = { id: 'ws-1', memberRole: 'owner', settings: null };
  });

  it('lets an owner switch the plugin on from the banner', async () => {
    setPluginsMock.mockResolvedValue(undefined);
    render(<PluginOffBanner plugin="webhooks" message="Webhooks are off." />);

    expect(screen.getByRole('status')).toHaveTextContent('Webhooks are off.');
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(setPluginsMock).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        plugins: { webhooks: true },
      }),
    );
  });

  it('asks a member to go to an owner or admin instead', () => {
    workspaceMock.current = { ...workspaceMock.current, memberRole: 'member' };
    render(<PluginOffBanner plugin="webhooks" message="Webhooks are off." />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/owner or admin/);
  });

  it('is not shown while the plugin is on', () => {
    workspaceMock.current = {
      ...workspaceMock.current,
      settings: { plugins: { webhooks: true } },
    };
    const { container } = render(<PluginOffBanner plugin="webhooks" message="off" />);

    expect(container).toBeEmptyDOMElement();
  });
});
