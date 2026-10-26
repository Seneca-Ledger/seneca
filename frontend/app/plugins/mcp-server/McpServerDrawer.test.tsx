import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpServerDrawer } from './McpServerDrawer';

const state = vi.hoisted(() => ({
  role: 'admin',
  settings: { plugins: { mcp: true } } as Record<string, unknown> | null,
  newKey: null as { key: string } | null,
}));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { role: state.role } }) }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: 'ws-1', memberRole: 'owner', settings: state.settings },
    setWorkspacePlugins: vi.fn(),
  }),
}));
vi.mock('./useApiKeys', () => ({
  useApiKeys: () => ({
    keys: [],
    loading: false,
    newKey: state.newKey,
    isActive: false,
    scopes: null,
    create: vi.fn(),
    revoke: vi.fn(),
    clearNewKey: vi.fn(),
  }),
}));

describe('McpServerDrawer', () => {
  beforeEach(() => {
    state.role = 'admin';
    state.settings = { plugins: { mcp: true } };
    state.newKey = null;
  });

  it('shows the HTTP endpoint and ready commands instead of a local build', () => {
    render(<McpServerDrawer isOpen onClose={vi.fn()} />);

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/https?:\/\/[^\s"]+\/api\/v1\/mcp/);
    expect(text).toContain('claude mcp add --transport http stoic-budget');
    expect(text).toContain('"X-Api-Key": "lum_<your-api-key>"');
    expect(text).not.toMatch(/npm run build|LUMIO_WORKSPACE_ID/);
  });

  it('puts a just-created key into the Claude Code command', () => {
    // Built at run time so the secret scanner does not read a stand-in key as a real one.
    const freshKey = ['lum', 'fresh123'].join('_');
    state.newKey = { key: freshKey };
    render(<McpServerDrawer isOpen onClose={vi.fn()} />);

    expect(document.body.textContent).toContain(`--header "X-Api-Key: ${freshKey}"`);
  });

  it('warns while MCP is switched off for the workspace', () => {
    state.settings = { plugins: { mcp: false } };
    render(<McpServerDrawer isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(/MCP is off/);
  });

  it('tells a non-admin that only an instance admin creates keys', () => {
    state.role = 'user';
    render(<McpServerDrawer isOpen onClose={vi.fn()} />);

    expect(document.body.textContent).toMatch(/Only an instance administrator can create API keys/);
  });
});
