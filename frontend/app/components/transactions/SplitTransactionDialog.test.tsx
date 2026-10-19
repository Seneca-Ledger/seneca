// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplitTransactionDialog } from './SplitTransactionDialog';

const categories = [
  { id: 'cat-1', name: 'Food' },
  { id: 'cat-2', name: 'Travel' },
];

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof SplitTransactionDialog>> = {},
) => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <SplitTransactionDialog
      open
      transactionId="tx-1"
      totalAmount={100}
      currency="KZT"
      categories={categories}
      saving={false}
      locale="en"
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, onClose };
};

const amountFields = (): HTMLElement[] => screen.getAllByLabelText(/amount/i);
const saveButton = (): HTMLElement => screen.getByRole('button', { name: /^split$/i });

describe('SplitTransactionDialog', () => {
  it('starts with two empty part rows', () => {
    renderDialog();
    const amounts = amountFields();
    expect(amounts).toHaveLength(2);
    for (const field of amounts) {
      expect((field as HTMLInputElement).value).toBe('');
    }
  });

  it('shows the remaining amount and keeps save disabled when parts do not sum to the total', () => {
    renderDialog();
    fireEvent.change(amountFields()[0] as HTMLElement, { target: { value: '30' } });
    fireEvent.change(amountFields()[1] as HTMLElement, { target: { value: '50' } });

    expect(screen.getByTestId('split-remaining')).toHaveTextContent('20');
    expect(saveButton()).toBeDisabled();
  });

  it('enables save once the parts sum to the total', () => {
    renderDialog();
    fireEvent.change(amountFields()[0] as HTMLElement, { target: { value: '30' } });
    fireEvent.change(amountFields()[1] as HTMLElement, { target: { value: '70' } });

    expect(saveButton()).toBeEnabled();
  });

  it('keeps save disabled when a part is zero even if the sum matches', () => {
    renderDialog();
    fireEvent.change(amountFields()[0] as HTMLElement, { target: { value: '100' } });
    fireEvent.change(amountFields()[1] as HTMLElement, { target: { value: '0' } });

    expect(saveButton()).toBeDisabled();
  });

  it('submits the parts in the expected shape', () => {
    const { onSubmit } = renderDialog();
    fireEvent.change(amountFields()[0] as HTMLElement, { target: { value: '30' } });
    fireEvent.change(amountFields()[1] as HTMLElement, { target: { value: '70' } });

    fireEvent.mouseDown(within(screen.getByTestId('split-category-0')).getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Food' }));

    fireEvent.click(saveButton());

    expect(onSubmit).toHaveBeenCalledWith([{ amount: 30, categoryId: 'cat-1' }, { amount: 70 }]);
  });

  it('adds and removes rows but never goes below two', () => {
    renderDialog();
    expect(screen.getAllByRole('button', { name: /remove part/i })[0]).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /add part/i }));
    expect(amountFields()).toHaveLength(3);

    const removeButtons = screen.getAllByRole('button', { name: /remove part/i });
    expect(removeButtons[0]).toBeEnabled();
    fireEvent.click(removeButtons[2] as HTMLElement);

    expect(amountFields()).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /remove part/i })[0]).toBeDisabled();
  });

  it('distributes the total evenly and absorbs the rounding remainder in the last row', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /add part/i }));

    fireEvent.click(screen.getByRole('button', { name: /distribute evenly/i }));

    const values = amountFields().map(field => (field as HTMLInputElement).value);
    expect(values).toEqual(['33.33', '33.33', '33.34']);
    expect(saveButton()).toBeEnabled();
  });
});
