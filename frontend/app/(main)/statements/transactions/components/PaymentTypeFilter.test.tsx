// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentTypeFilter } from './PaymentTypeFilter';

describe('PaymentTypeFilter', () => {
  it('offers All and the two types the sample showed', () => {
    render(<PaymentTypeFilter value={undefined} onChange={() => {}} />);

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Payment type' }));

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'All',
      'Card',
      'Bank transfer in',
    ]);
  });

  it('reports the chosen type, and none for All', () => {
    const onChange = vi.fn();
    render(<PaymentTypeFilter value="card" onChange={onChange} />);

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Payment type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bank transfer in' }));
    expect(onChange).toHaveBeenLastCalledWith('bank_transfer_in');

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Payment type' }));
    fireEvent.click(screen.getByRole('option', { name: 'All' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
