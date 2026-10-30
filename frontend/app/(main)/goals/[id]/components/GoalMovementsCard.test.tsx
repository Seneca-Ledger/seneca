// @vitest-environment jsdom
import type { GoalDetail } from '@/app/lib/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalMovementsCard } from './GoalMovementsCard';

type Movement = GoalDetail['contributions'][number];

const PAYEE = 'ACME Store - Wireless Buds';

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'c1',
    amount: 100,
    contributionDate: '2026-10-01',
    note: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    transaction: null,
    ...overrides,
  };
}

const money = (value: number): string => `$${value.toFixed(2)}`;

function renderCard(contributions: Movement[], onRemove = vi.fn()) {
  render(
    <GoalMovementsCard
      contributions={contributions}
      formatAmount={money}
      removing={false}
      onRemove={onRemove}
    />,
  );
  return onRemove;
}

describe('GoalMovementsCard', () => {
  it('keeps what was taken out apart from what was put aside', () => {
    renderCard([
      movement({ id: 'in', amount: 100 }),
      movement({
        id: 'out',
        amount: -40,
        transaction: { id: 't1', statementId: 's1', receiptId: 'r1', counterpartyName: PAYEE },
      }),
    ]);

    const [takenOut, putAside] = screen.getAllByRole('list');
    expect(within(takenOut).getByText('−$40.00')).toBeInTheDocument();
    expect(within(putAside).getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('Withdrawals and losses')).toBeInTheDocument();
  });

  it('links a movement back to its receipt, else to its statement', () => {
    renderCard([
      movement({
        id: 'a',
        amount: -40,
        transaction: { id: 't1', statementId: 's1', receiptId: 'r1', counterpartyName: PAYEE },
      }),
      movement({
        id: 'b',
        amount: 250,
        transaction: { id: 't2', statementId: 's2', receiptId: null, counterpartyName: 'Member One' },
      }),
    ]);

    expect(screen.getByRole('link', { name: PAYEE })).toHaveAttribute('href', '/storage/receipts/r1');
    expect(screen.getByRole('link', { name: 'Member One' })).toHaveAttribute(
      'href',
      '/statements/s2/edit',
    );
  });

  it('removes only movements typed in by hand', () => {
    const onRemove = renderCard([
      movement({ id: 'manual', amount: 100 }),
      movement({
        id: 'linked',
        amount: -40,
        transaction: { id: 't1', statementId: null, receiptId: null, counterpartyName: PAYEE },
      }),
    ]);

    const buttons = screen.getAllByRole('button', { name: 'Remove movement' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onRemove).toHaveBeenCalledWith('manual');
  });

  it('renders nothing for a goal that never moved', () => {
    const { container } = render(
      <GoalMovementsCard contributions={[]} formatAmount={money} removing={false} onRemove={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
