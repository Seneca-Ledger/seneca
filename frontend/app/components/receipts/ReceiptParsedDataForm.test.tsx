import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptParsedDataForm } from './ReceiptParsedDataForm';
import type { EditableReceiptParsedData } from './receipt-types';

type CustomDatePickerMockProps = {
  value?: string;
  onChange?: (value: string) => void;
  label?: React.ReactNode;
  containerTestId?: string;
};

vi.mock('@/app/i18n', async () => ({
  useLocale: () => ({ locale: 'en' }),
  // Real dictionaries; without a provider they resolve to the default locale (English).
  useIntlayer: (await vi.importActual<typeof import('react-intlayer')>('react-intlayer'))
    .useIntlayer,
}));

vi.mock('@/app/components/CustomDatePicker', () => ({
  default: ({ value, onChange, label, containerTestId }: CustomDatePickerMockProps) => (
    <div data-testid={containerTestId ?? 'mock-custom-date-picker'}>
      <span>{label}</span>
      <button type="button" aria-label="HeroUI Date" onClick={() => onChange?.('2024-07-29')}>
        {value || 'Pick date'}
      </button>
    </div>
  ),
}));

const baseValue: EditableReceiptParsedData = {
  vendor: 'Magnum',
  amount: 15420,
  currency: 'KZT',
  date: '2014-07-29',
  tax: '',
  paymentMethod: '',
  transactionType: 'expense',
  categoryId: '',
  lineItems: [],
};

describe('ReceiptParsedDataForm', () => {
  it('uses the HeroUI date picker instead of a native date input', () => {
    render(<ReceiptParsedDataForm value={baseValue} categories={[]} onChange={vi.fn()} />);

    expect(screen.queryByLabelText('Date')).toBeFalsy();
    expect(screen.queryByDisplayValue('2014-07-29')).toBeFalsy();
    expect(screen.getByTestId('receipt-date-picker')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'HeroUI Date' })).toBeTruthy();
  });

  it('updates the receipt date when the HeroUI picker changes', () => {
    const onChange = vi.fn();

    render(<ReceiptParsedDataForm value={baseValue} categories={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'HeroUI Date' }));

    expect(onChange).toHaveBeenCalledWith({
      ...baseValue,
      date: '2024-07-29',
    });
  });

  it('picks the category in the side drawer, named in the selected locale', () => {
    const onChange = vi.fn();
    render(
      <ReceiptParsedDataForm
        value={baseValue}
        categories={[
          {
            id: 'meals',
            name: 'Питание и представительские расходы',
            isEnabled: true,
            isSystem: true,
          },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(screen.getByRole('button', { name: 'Create category' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Meals and entertainment' }));

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, categoryId: 'meals' });
  });

  it('shows the chosen category on the field', () => {
    render(
      <ReceiptParsedDataForm
        value={{ ...baseValue, categoryId: 'meals' }}
        categories={[{ id: 'meals', name: 'Meals and entertainment', isEnabled: true }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Category' }).textContent).toContain(
      'Meals and entertainment',
    );
  });

  it('keeps line items collapsed until asked, then lists them and adds a line', () => {
    const onChange = vi.fn();

    render(
      <ReceiptParsedDataForm
        value={{
          ...baseValue,
          lineItems: [{ id: 'line-1', description: 'Milk', amount: 12.5 }],
        }}
        categories={[]}
        onChange={onChange}
      />,
    );

    expect(screen.queryByDisplayValue('Milk')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Line items (1)' }));

    expect(screen.getByDisplayValue('Milk')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: expect.arrayContaining([expect.objectContaining({ description: '' })]),
      }),
    );
  });

  it('offers to itemize a receipt that has no items, without inventing one', () => {
    const onChange = vi.fn();

    render(<ReceiptParsedDataForm value={baseValue} categories={[]} onChange={onChange} />);

    expect(screen.queryByRole('button', { name: /Line items/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Itemize' }));

    expect(onChange).toHaveBeenCalledWith({
      ...baseValue,
      lineItems: [expect.objectContaining({ description: '', amount: 0 })],
    });
  });

  it('says how far the items are from the amount', () => {
    const { rerender } = render(
      <ReceiptParsedDataForm
        value={{
          ...baseValue,
          amount: 30,
          currency: 'EUR',
          lineItems: [
            { id: 'line-1', description: 'Milk', amount: 10 },
            { id: 'line-2', description: 'Bread', amount: 15 },
          ],
        }}
        categories={[]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Line items (2)' }));

    expect(screen.getByRole('status').textContent).toBe('Differs from the amount by €5.00');

    rerender(
      <ReceiptParsedDataForm
        value={{
          ...baseValue,
          amount: 25,
          currency: 'EUR',
          lineItems: [
            { id: 'line-1', description: 'Milk', amount: 10 },
            { id: 'line-2', description: 'Bread', amount: 15 },
          ],
        }}
        categories={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('Items add up to the amount');
  });
});
