// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/app/components/dashboard/test-setup';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  // Every string is its own key, so the test reads which text was meant.
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: String(key), toString: () => String(key) }) }),
  useLocale: () => ({ locale: 'en' }),
}));

import WorkspacePayeesView from './WorkspacePayeesView';

const REWE = {
  id: 'payee-rewe',
  name: 'REWE SAGT DANKE',
  mode: 'auto',
  category: null,
  defaultCategory: { id: 'cat-food', name: 'Groceries', source: 'history' },
  countryCode: null,
  vatId: null,
  vatIdStatus: null,
  vatIdName: null,
  vatIdCheckedAt: null,
  supplyType: null,
  transactionCount: 12,
  lastSeen: '2026-10-01',
};
const LIDL = {
  id: 'payee-lidl',
  name: 'LIDL DIENSTLEISTUNG',
  mode: 'auto',
  category: null,
  defaultCategory: null,
  countryCode: 'PL',
  vatId: 'PL1234567890',
  vatIdStatus: null,
  vatIdName: null,
  vatIdCheckedAt: null,
  supplyType: null,
  transactionCount: 1,
  lastSeen: '2026-09-20',
};

describe('WorkspacePayeesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/categories'
            ? [
                { id: 'cat-food', name: 'Groceries', type: 'expense' },
                { id: 'cat-home', name: 'Household', type: 'expense' },
              ]
            : { data: [REWE, LIDL], total: 2, page: 1, limit: 50 },
      }),
    );
    api.patch.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: { merged: 1 } });
  });

  it('lists each payee with what it files as', async () => {
    renderWithQuery(<WorkspacePayeesView />);

    const rows = await screen.findAllByTestId('payee-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('REWE SAGT DANKE');
    expect(rows[0]).toHaveTextContent('filesAs');
    expect(rows[1]).toHaveTextContent('noDefault');
  });

  it('renames a payee', async () => {
    renderWithQuery(<WorkspacePayeesView />);
    const [rewe] = await screen.findAllByTestId('payee-row');

    fireEvent.click(rewe.querySelector('button[aria-label="rename"]') as HTMLElement);
    fireEvent.change(screen.getByRole('textbox', { name: 'rename' }), {
      target: { value: 'REWE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/payees/payee-rewe', { name: 'REWE' }));
  });

  it('offers a merge when the new name is taken', async () => {
    api.patch.mockRejectedValue({
      response: { status: 409, data: { code: 'PAYEE_NAME_TAKEN', payeeId: '0b0c3f6e-1111-4222-8333-444455556666' } },
    });
    renderWithQuery(<WorkspacePayeesView />);
    const [rewe] = await screen.findAllByTestId('payee-row');

    fireEvent.click(rewe.querySelector('button[aria-label="rename"]') as HTMLElement);
    fireEvent.change(screen.getByRole('textbox', { name: 'rename' }), {
      target: { value: 'Lidl' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(toast.custom).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('pins "always" to what the payee files as now', async () => {
    renderWithQuery(<WorkspacePayeesView />);
    const [rewe] = await screen.findAllByTestId('payee-row');

    selectOption(within(rewe).getByRole('combobox'), 'modeAlways');

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/payees/payee-rewe', {
        mode: 'always',
        categoryId: 'cat-food',
      }),
    );
  });

  it('merges the selected payees into the one picked', async () => {
    renderWithQuery(<WorkspacePayeesView />);
    const rows = await screen.findAllByTestId('payee-row');
    for (const row of rows) {
      fireEvent.click(row.querySelector('[aria-label]') as HTMLElement);
    }

    const bar = await screen.findByTestId('payees-merge-bar');
    selectOption(within(bar).getByRole('combobox'), 'REWE SAGT DANKE');
    fireEvent.click(screen.getByRole('button', { name: 'merge' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/payees/payee-rewe/merge', {
        sourceIds: ['payee-lidl'],
      }),
    );
  });

  it('shows the VAT details a payee already has', async () => {
    renderWithQuery(<WorkspacePayeesView />);
    const rows = await screen.findAllByTestId('payee-row');

    expect(rows[1]).toHaveTextContent('PL PL1234567890');
    expect(rows[0]).not.toHaveTextContent('PL1234567890');
  });

  it('saves a country and VAT id, upper-casing the country', async () => {
    renderWithQuery(<WorkspacePayeesView />);
    const [rewe] = await screen.findAllByTestId('payee-row');

    fireEvent.click(within(rewe).getByRole('button', { name: 'vatDetails' }));
    const form = await screen.findByTestId('payee-vat-form');
    fireEvent.change(within(form).getByLabelText('countryCode'), { target: { value: 'pl' } });
    fireEvent.change(within(form).getByLabelText('vatId'), { target: { value: ' PL555 ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/payees/payee-rewe', {
        countryCode: 'PL',
        vatId: 'PL555',
        supplyType: null,
      }),
    );
  });

  it('refuses a country that is not two letters', async () => {
    renderWithQuery(<WorkspacePayeesView />);
    const [rewe] = await screen.findAllByTestId('payee-row');

    fireEvent.click(within(rewe).getByRole('button', { name: 'vatDetails' }));
    const form = await screen.findByTestId('payee-vat-form');
    fireEvent.change(within(form).getByLabelText('countryCode'), { target: { value: 'P1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('countryCodeInvalid'));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('clears the VAT details when both fields are emptied', async () => {
    renderWithQuery(<WorkspacePayeesView />);
    const rows = await screen.findAllByTestId('payee-row');

    fireEvent.click(within(rows[1]).getByRole('button', { name: 'vatDetails' }));
    const form = await screen.findByTestId('payee-vat-form');
    fireEvent.change(within(form).getByLabelText('countryCode'), { target: { value: '' } });
    fireEvent.change(within(form).getByLabelText('vatId'), { target: { value: '' } });
    fireEvent.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/payees/payee-lidl', {
        countryCode: null,
        vatId: null,
        supplyType: null,
      }),
    );
  });
  it('saves what the payee supplies, for the German VAT return', async () => {
    renderWithQuery(<WorkspacePayeesView />);
    const rows = await screen.findAllByTestId('payee-row');

    fireEvent.click(within(rows[1]).getByRole('button', { name: 'vatDetails' }));
    const form = await screen.findByTestId('payee-vat-form');
    selectOption(within(form).getAllByRole('combobox')[0], 'supplyServices');
    fireEvent.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/payees/payee-lidl', {
        countryCode: 'PL',
        vatId: 'PL1234567890',
        supplyType: 'services',
      }),
    );
  });

  describe('VIES', () => {
    const listWith = (lidl: Record<string, unknown>) =>
      api.get.mockImplementation((url: string) =>
        Promise.resolve({
          data:
            url === '/categories'
              ? []
              : { data: [REWE, { ...LIDL, ...lidl }], total: 2, page: 1, limit: 50 },
        }),
      );

    it('shows the registered name of a valid number', async () => {
      listWith({ vatIdStatus: 'valid', vatIdName: 'LIDL SP Z O O', vatIdCheckedAt: '2026-10-11' });
      renderWithQuery(<WorkspacePayeesView />);
      const rows = await screen.findAllByTestId('payee-row');

      expect(within(rows[1]).getByTestId('payee-vat-status')).toHaveTextContent('vatValidNamed');
      expect(within(rows[1]).queryByRole('button', { name: 'vatRecheck' })).not.toBeInTheDocument();
      expect(within(rows[0]).queryByTestId('payee-vat-status')).not.toBeInTheDocument();
    });

    it('marks an invalid number and checks it again on request', async () => {
      listWith({ vatIdStatus: 'invalid', vatIdName: null, vatIdCheckedAt: '2026-10-11' });
      api.post.mockResolvedValue({
        data: { ...LIDL, vatIdStatus: 'valid', vatIdCheckedAt: '2026-10-12' },
      });
      renderWithQuery(<WorkspacePayeesView />);
      const rows = await screen.findAllByTestId('payee-row');

      expect(within(rows[1]).getByTestId('payee-vat-status')).toHaveTextContent('vatInvalid');
      fireEvent.click(within(rows[1]).getByRole('button', { name: 'vatRecheck' }));

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/payees/payee-lidl/vat-check', {}));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('vatSavedValid'));
    });

    it('says what VIES made of a number just saved', async () => {
      api.patch.mockResolvedValue({
        data: { ...REWE, countryCode: 'PL', vatId: 'PL555', vatIdStatus: 'invalid', vatIdCheckedAt: '2026-10-11' },
      });
      renderWithQuery(<WorkspacePayeesView />);
      const [rewe] = await screen.findAllByTestId('payee-row');

      fireEvent.click(within(rewe).getByRole('button', { name: 'vatDetails' }));
      const form = await screen.findByTestId('payee-vat-form');
      fireEvent.change(within(form).getByLabelText('countryCode'), { target: { value: 'PL' } });
      fireEvent.change(within(form).getByLabelText('vatId'), { target: { value: 'PL555' } });
      fireEvent.click(within(form).getByRole('button', { name: 'save' }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('vatSavedInvalid'));
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
