// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => {
          const text = `${String(key)} {{year}}|{{line}}|{{count}}|{{payee}}|{{net}}|{{tax}}`;
          return { value: text, toString: () => text };
        },
      },
    ),
}));

import { elsterAmount, type UstvaResult, UstvaCard } from './UstvaCard';

const PERIOD = { periodStart: '2026-03-01', periodEnd: '2026-03-31' };

function result(overrides: Partial<UstvaResult> = {}): UstvaResult {
  return {
    unsupported: null,
    form: {
      form: 'USt 1 A',
      year: 2026,
      sourceUrl: 'https://example.test/form',
      checkedAt: '2026-10-11',
      fields: [
        { kz: '81', line: 13, label: 'Steuerpflichtige Umsätze 19 %', kind: 'base', amount: 1251, transactionIds: ['t-1'] },
        { kz: '66', line: 38, label: 'Vorsteuerbeträge', kind: 'tax', amount: 57.01, transactionIds: ['t-2'] },
      ],
      kz83: 180.68,
      open: [],
    },
    missingRates: [],
    sondervorauszahlungDue: false,
    ...overrides,
  };
}

describe('elsterAmount', () => {
  it('writes bases in whole euros and tax with a decimal comma', () => {
    expect(elsterAmount(1251.99, 'base')).toBe('1251');
    expect(elsterAmount(-10.7, 'base')).toBe('-10');
    expect(elsterAmount(57.01, 'tax')).toBe('57,01');
    expect(elsterAmount(-19, 'tax')).toBe('-19,00');
  });
});

describe('UstvaCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing outside Germany', async () => {
    api.get.mockResolvedValue({ data: result({ unsupported: 'not_germany', form: null }) });
    const { container } = renderWithQuery(<UstvaCard period={PERIOD} lines={[]} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each Kennzahl with its line and the amount ELSTER takes, then Kz 83', async () => {
    api.get.mockResolvedValue({ data: result() });
    renderWithQuery(
      <UstvaCard
        period={PERIOD}
        lines={[
          {
            transactionId: 't-1',
            date: '2026-03-10',
            counterparty: 'Acme GmbH',
            direction: 'output',
            currency: 'EUR',
            taxAmount: 237.69,
            netAmount: 1251,
            exchangeRate: 1,
            taxAmountConverted: 237.69,
          },
        ]}
      />,
    );

    const kz81 = await screen.findByTestId('ustva-kz-81');
    expect(kz81).toHaveTextContent('Kz 81');
    expect(kz81).toHaveTextContent('1251 €');
    expect(screen.getByTestId('ustva-kz-66')).toHaveTextContent('57,01 €');
    expect(screen.getByTestId('ustva-kz-83')).toHaveTextContent('180,68 €');

    // The rows behind a line.
    fireEvent.click(within(kz81).getByRole('button', { name: /^transactionsCount/ }));
    expect(within(kz81).getByText('2026-03-10 · Acme GmbH · 237.69')).toBeInTheDocument();
  });

  it('marks a payee as supplying services from an open item', async () => {
    api.get.mockResolvedValue({
      data: result({
        form: {
          ...(result().form as NonNullable<UstvaResult['form']>),
          open: [
            {
              reason: 'supply_type_unknown',
              direction: 'expense',
              lines: [25, 26, 28, 30],
              net: 119,
              tax: 22.61,
              payeeId: 'p-1',
              payeeName: 'Google Ireland',
              transactionIds: ['t-3'],
            },
          ],
        },
      }),
    });
    api.patch.mockResolvedValue({ data: {} });
    renderWithQuery(<UstvaCard period={PERIOD} lines={[]} />);

    const open = await screen.findByTestId('ustva-open');
    expect(open).toHaveTextContent('Google Ireland|119,00|22,61');
    fireEvent.click(within(open).getByRole('button', { name: /^markServices/ }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/payees/p-1', { supplyType: 'services' }),
    );
  });

  it('says when the year form was not checked', async () => {
    api.get.mockResolvedValue({ data: result({ unsupported: 'form_year_unknown', form: null }) });
    renderWithQuery(<UstvaCard period={{ periodStart: '2025-12-01', periodEnd: '2025-12-31' }} lines={[]} />);
    expect(await screen.findByText(/^formUnknown 2025/)).toBeInTheDocument();
  });
});
