// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SuggestionsHint, useSuggestionsHint } from './SuggestionsHint';

const auth = vi.hoisted(() => ({ user: null as null | { pageHintsSeen?: Record<string, number> } }));
const markSeen = vi.hoisted(() => vi.fn());

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('@/app/components/page-hints/useMarkPageHintsSeen', () => ({
  useMarkPageHintsSeen: () => markSeen,
}));

const LABELS = {
  title: 'You will not fill this in every time',
  suggested: 'Dashed categories are suggestions.',
  learns: 'Every choice you make is remembered.',
  gaps: 'A row with no suggestion is normal.',
  gotIt: 'Got it',
};

function Harness() {
  const hint = useSuggestionsHint();
  return hint.open ? (
    <SuggestionsHint labels={LABELS} onClose={hint.close} />
  ) : (
    <button type="button" onClick={hint.show}>
      How categories get filled
    </button>
  );
}

describe('SuggestionsHint', () => {
  beforeEach(() => {
    markSeen.mockClear();
  });

  it('shows on a first statement, and closing it is remembered', () => {
    auth.user = { pageHintsSeen: {} };
    render(<Harness />);

    expect(screen.getByRole('note')).toHaveTextContent(LABELS.title);
    fireEvent.click(screen.getByRole('button', { name: LABELS.gotIt }));

    expect(markSeen).toHaveBeenCalledWith('statementCategories', 1);
  });

  it('stays closed once seen, and opens again when asked', () => {
    auth.user = { pageHintsSeen: { statementCategories: 1 } };
    render(<Harness />);

    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'How categories get filled' }));
    expect(screen.getByRole('note')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: LABELS.gotIt }));
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('does not show from a cached user that has no record yet', () => {
    auth.user = {};
    render(<Harness />);

    expect(screen.queryByRole('note')).toBeNull();
  });
});
