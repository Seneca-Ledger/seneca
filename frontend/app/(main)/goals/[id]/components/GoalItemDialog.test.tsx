// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalItemDialog } from './GoalItemDialog';

function renderDialog(onSave = vi.fn()) {
  renderWithQuery(
    <GoalItemDialog
      open
      editing={null}
      defaultCurrency="USD"
      saving={false}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  return onSave;
}

describe('GoalItemDialog', () => {
  it('does not take a typed currency code', () => {
    renderDialog();

    const currency = screen.getByLabelText('Currency');
    expect(currency).toHaveAttribute('readonly');
    expect(currency).toHaveValue('USD - $');
  });

  it('picks the currency from the currency drawer and saves it', async () => {
    const onSave = renderDialog();

    fireEvent.click(screen.getByLabelText('Currency'));
    const drawer = screen.getByPlaceholderText(/search/i).closest('.MuiDrawer-root') as HTMLElement;
    fireEvent.click(within(drawer).getAllByText('EUR - €')[0]);

    expect(screen.getByLabelText('Currency')).toHaveValue('EUR - €');
    // Choosing closes the drawer; the dialog is inert until it has gone.
    await waitFor(() => expect(screen.queryByPlaceholderText(/search/i)).toBeNull());

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Visa' } });
    fireEvent.change(screen.getByLabelText('Estimate'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Visa', estimatedAmount: 150, currency: 'EUR' }),
    );
  });
});
