// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { TaxStep } from './TaxStep';

const get = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: { get: (...args: unknown[]) => get(...args) },
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: (key: string) =>
    key === 'onboardingPage'
      ? {
          tax: {
            title: 'Where do you pay tax?',
            countryLabel: 'Tax residence',
            notListed: "My country isn't listed",
            notListedHint: 'Tax features stay off',
            loadFailed: 'Could not load the list of countries.',
          },
        }
      : {
          taxpayerTypeLabel: { value: 'You file as' },
          typeEmployee: { value: 'Employee' },
          typeSelfEmployed: { value: 'Self-employed' },
          typeCompany: { value: 'Company' },
        },
}));

const jurisdiction = (code: string, name: string) => ({
  id: code,
  code,
  name,
  taxName: 'VAT',
  currency: 'EUR',
  scheme: 'vat',
  registrationThreshold: null,
});

const props = {
  locale: 'en' as const,
  profile: 'business' as const,
  taxCountry: null,
  taxpayerType: null,
  onTaxCountryChange: vi.fn(),
  onTaxpayerTypeChange: vi.fn(),
  onDefer: vi.fn(),
};

describe('TaxStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: [jurisdiction('DE', 'Germany'), jurisdiction('PL', 'Poland')] });
  });

  it('asks for the taxpayer kind only once a country is chosen', async () => {
    renderWithQuery(<TaxStep {...props} />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.getByText('Tax features stay off')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('offers company only to a business workspace', () => {
    const { unmount } = renderWithQuery(<TaxStep {...props} taxCountry="DE" />);
    expect(screen.getAllByRole('radio').map(radio => radio.textContent)).toEqual([
      'Employee',
      'Self-employed',
      'Company',
    ]);
    unmount();

    renderWithQuery(<TaxStep {...props} taxCountry="DE" profile="home" />);
    expect(screen.queryByRole('radio', { name: /Company/ })).toBeNull();
  });

  it('lets the country wait', () => {
    const onDefer = vi.fn();
    renderWithQuery(<TaxStep {...props} taxCountry="DE" onDefer={onDefer} />);

    fireEvent.click(screen.getByRole('button', { name: "My country isn't listed" }));
    expect(onDefer).toHaveBeenCalledTimes(1);
  });

  it('says so when the country list cannot be loaded, and still lets the step be passed', async () => {
    get.mockRejectedValue(new Error('offline'));
    renderWithQuery(<TaxStep {...props} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the list of countries.',
    );
    expect(screen.getByRole('button', { name: "My country isn't listed" })).toBeEnabled();
  });
});
