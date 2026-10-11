// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { selectOption } from '@/app/test/select';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: String(key), toString: () => String(key) }) }),
}));

import { LineAdjustmentInput, UnitSelect, XRechnungMissingAlert } from './XRechnungFields';

describe('UnitSelect', () => {
  it('offers the usual units and reports the UN/ECE code picked', () => {
    const onChange = vi.fn();
    render(<UnitSelect value="C62" onChange={onChange} />);
    selectOption(screen.getByRole('combobox'), 'unitHour');
    expect(onChange).toHaveBeenCalledWith('HUR');
  });

  it('keeps a unit set elsewhere selectable under its code', () => {
    render(<UnitSelect value="MTR" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('MTR');
  });
});

describe('XRechnungMissingAlert', () => {
  it('names each missing thing once, in words', () => {
    const onClose = vi.fn();
    render(
      <XRechnungMissingAlert
        missing={['seller_street', 'seller_city', 'buyer_reference', 'seller_iban']}
        onClose={onClose}
      />,
    );
    const items = screen.getAllByRole('listitem').map(item => item.textContent);
    expect(items).toEqual(['missingSellerAddress', 'missingBuyerReference', 'missingSellerIban']);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('LineAdjustmentInput', () => {
  it('reports a discount as a negative percent and an emptied field as none', () => {
    const onChange = vi.fn();
    const { rerender } = render(<LineAdjustmentInput value={undefined} onChange={onChange} />);
    const input = screen.getByLabelText('lineAdjustment');
    fireEvent.change(input, { target: { value: '-10' } });
    expect(onChange).toHaveBeenLastCalledWith(-10);
    rerender(<LineAdjustmentInput value={-10} onChange={onChange} />);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
