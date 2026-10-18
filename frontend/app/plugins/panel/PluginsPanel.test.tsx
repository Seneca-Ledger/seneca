import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginsPanel } from './PluginsPanel';

const setPluginsMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const workspaceMock = vi.hoisted(() => ({
  current: {
    id: 'ws-1',
    memberRole: 'owner',
    settings: null as Record<string, unknown> | null,
  },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: workspaceMock.current,
    setWorkspacePlugins: setPluginsMock,
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: toastErrorMock, success: vi.fn() } }));
vi.mock('@/app/components/panels/app-panels-store', () => ({
  useAppPanelState: () => ({ panel: 'plugins', item: null }),
  closeAppPanel: vi.fn(),
  closeAppPanelItem: vi.fn(),
  openAppPanelItem: vi.fn(),
}));
vi.mock('../ai-assistant/AiAssistantDrawer', () => ({ AiAssistantDrawer: () => null }));
vi.mock('../webhooks/WebhooksDrawer', () => ({ WebhooksDrawer: () => null }));
vi.mock('../mcp-server/McpServerDrawer', () => ({ McpServerDrawer: () => null }));

const switchOf = (name: string) => screen.getByRole('switch', { name: new RegExp(`Toggle ${name}`) });

describe('PluginsPanel', () => {
  beforeEach(() => {
    setPluginsMock.mockReset();
    toastErrorMock.mockReset();
    workspaceMock.current = {
      id: 'ws-1',
      memberRole: 'owner',
      settings: { plugins: { webhooks: true, mcp: false, aiAssistant: false } },
    };
  });

  it('shows the switches stored on the workspace', () => {
    render(<PluginsPanel />);

    expect(switchOf('Webhooks')).toBeChecked();
    expect(switchOf('MCP')).not.toBeChecked();
    expect(switchOf('AI')).not.toBeChecked();
  });

  it('saves a flipped switch on the workspace', async () => {
    setPluginsMock.mockResolvedValue(undefined);
    render(<PluginsPanel />);

    fireEvent.click(switchOf('MCP'));

    await waitFor(() =>
      expect(setPluginsMock).toHaveBeenCalledWith({ workspaceId: 'ws-1', plugins: { mcp: true } }),
    );
  });

  it('tells the user when the switch could not be saved', async () => {
    setPluginsMock.mockRejectedValue(new Error('403'));
    render(<PluginsPanel />);

    fireEvent.click(switchOf('Webhooks'));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
  });

  it('lets a member see the switches but not flip them', () => {
    workspaceMock.current = { ...workspaceMock.current, memberRole: 'member' };
    render(<PluginsPanel />);

    expect(switchOf('Webhooks')).toBeDisabled();
    expect(switchOf('MCP')).toBeDisabled();
  });

  it('does not open the AI assistant while it is off', () => {
    render(<PluginsPanel />);

    expect(screen.getByRole('button', { name: /^AI Assistant/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Webhooks/ })).toBeEnabled();
  });
});
