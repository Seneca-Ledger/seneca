import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhooksDrawer } from './WebhooksDrawer';

const state = vi.hoisted(() => ({
  newToken: null as string | null,
  createEndpoint: vi.fn(),
  subscriptions: [] as unknown[],
}));

// The "webhooks are off" banner reads the workspace's plugin switches; webhooks are on here.
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: 'ws-1', memberRole: 'owner', settings: { plugins: { webhooks: true } } },
    setWorkspacePlugins: vi.fn(),
  }),
}));
vi.mock('./useWebhooks', () => ({
  useWebhookEndpoints: () => ({
    endpoints: [],
    loading: false,
    newToken: state.newToken,
    setNewToken: vi.fn(),
    create: state.createEndpoint,
    remove: vi.fn(),
    toggle: vi.fn(),
  }),
  useWebhookSubscriptions: () => ({
    subscriptions: state.subscriptions,
    loading: false,
    create: vi.fn(),
    remove: vi.fn(),
    testPing: vi.fn(),
  }),
}));
// The real fields load wallets and branches; the drawer only needs what they report.
vi.mock('./EndpointDefaultsFields', () => ({
  EndpointDefaultsFields: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ defaultWalletId: 'wallet-1', defaultBranchId: null })}
    >
      pick wallet
    </button>
  ),
}));
vi.mock('./WebhookDeliveryLog', () => ({
  WebhookDeliveryLog: ({ subscriptionId }: { subscriptionId: string }) => (
    <div>log of {subscriptionId}</div>
  ),
}));

describe('WebhooksDrawer', () => {
  beforeEach(() => {
    state.newToken = null;
    state.subscriptions = [];
    state.createEndpoint.mockReset();
  });

  it('gives a new endpoint its full upload URLs, not just the token', () => {
    state.newToken = 'tok-123';
    render(<WebhooksDrawer isOpen onClose={vi.fn()} />);

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/https?:\/\/[^\s]+\/api\/v1\/webhooks\/tok-123\/statements/);
    expect(text).toMatch(/\/webhooks\/tok-123\/receipts/);
  });

  it('creates an endpoint with the account its statements default to', async () => {
    render(<WebhooksDrawer isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /New Endpoint/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Scanner' } });
    fireEvent.click(screen.getByRole('button', { name: 'pick wallet' }));
    fireEvent.click(screen.getByRole('button', { name: /^Create$/ }));

    await waitFor(() =>
      expect(state.createEndpoint).toHaveBeenCalledWith({
        name: 'Scanner',
        defaultWalletId: 'wallet-1',
        defaultBranchId: null,
      }),
    );
  });

  it('names a subscription events and opens its delivery log', () => {
    state.subscriptions = [
      {
        id: 'sub-1',
        name: 'Zapier',
        url: 'https://hooks.example.com/x',
        events: ['invoice.paid', 'budget.exceeded'],
        isActive: true,
        createdAt: '2026-10-18T00:00:00.000Z',
      },
    ];
    render(<WebhooksDrawer isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Outbound' }));

    expect(screen.getByText('Invoice Paid')).toBeInTheDocument();
    expect(screen.getByText('Budget Exceeded')).toBeInTheDocument();
    expect(screen.queryByText('log of sub-1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Deliveries' }));
    expect(screen.getByText('log of sub-1')).toBeInTheDocument();
  });
});
