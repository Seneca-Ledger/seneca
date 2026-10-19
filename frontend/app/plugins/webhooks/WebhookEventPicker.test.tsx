import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WebhookEventPicker } from './WebhookEventPicker';

describe('WebhookEventPicker', () => {
  it('offers every event of the contract, grouped', () => {
    render(<WebhookEventPicker selected={[]} onToggle={vi.fn()} />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(15);
    const payables = screen.getByRole('group', { name: 'Bills and invoices' });
    expect(within(payables).getAllByRole('checkbox')).toHaveLength(4);
    expect(within(payables).getByLabelText('Invoice Paid')).toBeInTheDocument();
  });

  it('shows the chosen events checked and reports a toggle', () => {
    const onToggle = vi.fn();
    render(<WebhookEventPicker selected={['budget.exceeded']} onToggle={onToggle} />);

    expect(screen.getByLabelText('Budget Exceeded')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Transactions Imported'));
    expect(onToggle).toHaveBeenCalledWith('transactions.imported');
  });
});
