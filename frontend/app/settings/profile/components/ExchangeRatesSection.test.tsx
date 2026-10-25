import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enTx as tx } from '@/app/settings/profile/helpers/en-tx';
import { ExchangeRatesSection } from './ExchangeRatesSection';

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: getMock, post: postMock } }));
vi.mock('@/app/i18n', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe('ExchangeRatesSection', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({
      data: {
        currency: 'EUR',
        currencies: [
          { currency: 'USD', rate: 0.8824336319459329, rateDate: '2026-10-01', stale: false, rows: 2 },
        ],
        missing: [],
      },
    });
  });

  it('shows a readable rate and finds the field by its visible label', async () => {
    postMock.mockResolvedValue({ data: {} });
    render(<ExchangeRatesSection tx={tx} />);

    expect(await screen.findByText('1 USD = 0.882434 EUR')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(tx(['exchangeRatesCard', 'colRate']).replace('{{currency}}', 'EUR')), { target: { value: '0,9' } });
    fireEvent.click(screen.getByRole('button', { name: tx(['exchangeRatesCard', 'setRate']) }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/exchange-rates/manual', { from: 'USD', to: 'EUR', rate: 0.9 }),
    );
  });
});
