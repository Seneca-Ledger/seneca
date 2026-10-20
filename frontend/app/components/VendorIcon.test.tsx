import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VendorIcon } from './VendorIcon';

describe('VendorIcon', () => {
  it.each([
    ['Vendor - Plan', 'V'],
    ['42 Studio', '4'],
    ['vendor', 'V'],
    ['!!!', '?'],
  ])('falls back to the first letter or digit of %j', (vendorName, initial) => {
    render(<VendorIcon vendorName={vendorName} />);

    expect(screen.getByRole('img', { name: vendorName }).textContent).toBe(initial);
  });
});
