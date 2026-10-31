// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentTypeLabel } from './PaymentTypeLabel';

describe('PaymentTypeLabel', () => {
  it('names the payment type', () => {
    render(<PaymentTypeLabel type="bank_transfer_in" />);

    expect(screen.getByText('Bank transfer in')).toBeInTheDocument();
  });

  it('shows nothing for an empty value', () => {
    const { container } = render(<PaymentTypeLabel type={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
