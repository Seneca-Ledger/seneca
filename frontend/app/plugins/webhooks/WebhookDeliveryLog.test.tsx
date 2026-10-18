import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryLog } from './WebhookDeliveryLog';

const state = vi.hoisted(() => ({
  deliveries: [] as unknown[],
  retry: vi.fn(),
}));

vi.mock('./useWebhooks', () => ({
  useWebhookDeliveries: () => ({
    deliveries: state.deliveries,
    loading: false,
    retry: state.retry,
    retrying: null,
  }),
}));

const delivery = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  event: 'bill.paid',
  status,
  attemptCount: 1,
  maxAttempts: 3,
  lastAttemptedAt: '2026-10-18T10:00:00.000Z',
  nextAttemptAt: null,
  lastResponseCode: null,
  lastError: null,
  createdAt: '2026-10-18T09:59:00.000Z',
  ...extra,
});

describe('WebhookDeliveryLog', () => {
  beforeEach(() => {
    state.retry.mockReset();
  });

  it('says so when nothing was sent', () => {
    state.deliveries = [];
    render(<WebhookDeliveryLog subscriptionId="s1" />);

    expect(screen.getByText('Nothing sent yet.')).toBeInTheDocument();
  });

  it('shows each delivery with its event, attempts and what went wrong', () => {
    state.deliveries = [
      delivery('d1', 'success', { lastResponseCode: 200 }),
      delivery('d2', 'exhausted', { attemptCount: 3, lastError: 'connect ECONNREFUSED' }),
    ];
    render(<WebhookDeliveryLog subscriptionId="s1" />);

    expect(screen.getAllByText('Bill Paid')).toHaveLength(2);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Gave up')).toBeInTheDocument();
    expect(screen.getByText(/Attempt 3 of 3 · connect ECONNREFUSED/)).toBeInTheDocument();
  });

  it('offers a retry only for what did not arrive', () => {
    state.deliveries = [delivery('d1', 'success'), delivery('d2', 'failed'), delivery('d3', 'pending')];
    render(<WebhookDeliveryLog subscriptionId="s1" />);

    const buttons = screen.getAllByRole('button', { name: 'Retry' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(state.retry).toHaveBeenCalledWith('d2');
  });
});
