// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

import { DisclaimerGate, useDisclaimerAcceptance } from './DisclaimerGate';

const labels = {
  title: 'Before you start',
  intro: 'Lumio does not replace an accountant.',
  points: ['Rates may be out of date.', 'You remain responsible.'],
  consentLabel: 'I understand the above and accept these terms',
  acceptLabel: 'I accept',
  savingLabel: 'Saving…',
  errorLabel: 'Could not save your acknowledgement.',
};

describe('DisclaimerGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cannot be accepted until the box is ticked', async () => {
    const onAccepted = vi.fn();
    render(<DisclaimerGate {...labels} onAccepted={onAccepted} />);

    const button = screen.getByRole('button', { name: labels.acceptLabel });
    expect(button).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
  });

  it('shows every point it was given', () => {
    render(<DisclaimerGate {...labels} onAccepted={vi.fn()} />);

    for (const point of labels.points) {
      expect(screen.getByText(point)).toBeInTheDocument();
    }
  });

  it('records the acceptance before letting the user through', async () => {
    post.mockResolvedValue({ data: {} });
    const onAccepted = vi.fn();
    render(<DisclaimerGate {...labels} onAccepted={onAccepted} />);

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: labels.acceptLabel }));

    await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/users/me/disclaimer');
  });

  it('keeps the user on the gate when recording fails', async () => {
    post.mockRejectedValue(new Error('network'));
    const onAccepted = vi.fn();
    render(<DisclaimerGate {...labels} onAccepted={onAccepted} />);

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: labels.acceptLabel }));

    // Advancing here would leave the user believing they consented while the
    // audit trail says otherwise.
    await waitFor(() => expect(screen.getByText(labels.errorLabel)).toBeInTheDocument());
    expect(onAccepted).not.toHaveBeenCalled();
  });
});

function AcceptanceProbe() {
  const { loading, accepted } = useDisclaimerAcceptance();
  return <span data-testid="state">{loading ? 'loading' : accepted ? 'accepted' : 'blocked'}</span>;
}

describe('useDisclaimerAcceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets an accepted user through', async () => {
    get.mockResolvedValue({
      data: {
        version: '2026-08-21',
        accepted: true,
        acceptedAt: '2026-08-22T09:00:00.000Z',
        acceptedVersion: '2026-08-21',
      },
    });
    render(<AcceptanceProbe />);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('accepted'));
  });

  it('blocks a user who has not accepted', async () => {
    get.mockResolvedValue({
      data: { version: '2026-08-21', accepted: false, acceptedAt: null, acceptedVersion: null },
    });
    render(<AcceptanceProbe />);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'));
  });

  it('stays closed when the check itself fails', async () => {
    // A failed lookup must not become a silent bypass.
    get.mockRejectedValue(new Error('offline'));
    render(<AcceptanceProbe />);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'));
  });
});
