// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  // Every string is its own key, so the test reads which text was meant.
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: String(key), toString: () => String(key) }) }),
  useLocale: () => ({ locale: 'en' }),
}));

import { categoryItem, taxJurisdictionItem } from '@/app/test/fixtures/contracts';
import { TaxStatusSection } from './TaxStatusSection';

function mockApi(
  vatStatus = 'registered',
  reserve: { percent: number | null; paymentsCategoryId: string | null } = {
    percent: null,
    paymentsCategoryId: 'cat-tax',
  },
) {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/tax/settings'
          ? { jurisdiction: taxJurisdictionItem(), vatStatus }
          : url === '/tax/settings/vat-filing'
            ? {
                frequency: 'quarterly',
                isDefault: true,
                extension: false,
                extensionName: 'Dauerfristverlängerung',
                deadlinesKnown: true,
                knownFrequencies: ['monthly', 'quarterly'],
              }
            : url === '/tax/settings/reserve'
            ? reserve
            : [
                categoryItem({ id: 'cat-tax', name: 'Taxes' }),
                categoryItem({ id: 'cat-fees', name: 'Fees' }),
                categoryItem({ id: 'cat-sub', name: 'VAT', parentId: 'cat-tax' }),
                categoryItem({ id: 'cat-sales', name: 'Sales', type: 'income' }),
              ],
    }),
  );
}

describe('TaxStatusSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.put.mockImplementation((url: string, body: unknown) =>
      Promise.resolve({
        data: url === '/tax/settings/vat-status' ? { vatStatus: 'not_registered', reassessed: 3 } : body,
      }),
    );
    api.post.mockResolvedValue({ data: { reassessed: 5 } });
  });

  it('explains the current status', async () => {
    mockApi('small_business');
    renderWithQuery(<TaxStatusSection />);

    expect(await screen.findByText('smallBusinessHelp')).toBeInTheDocument();
    // Re-applying rules only means something where VAT is worked out.
    expect(screen.queryByRole('button', { name: 'reassess' })).not.toBeInTheDocument();
  });

  it('changes the VAT status and reports how many rows moved', async () => {
    mockApi();
    renderWithQuery(<TaxStatusSection />);
    await screen.findByText('registeredHelp');

    selectOption(screen.getAllByRole('combobox')[0], 'notRegistered');

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/tax/settings/vat-status', { status: 'not_registered' }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('statusSaved'));
  });

  it('re-applies the tax rules on request', async () => {
    mockApi();
    renderWithQuery(<TaxStatusSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'reassess' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tax/settings/reassess', {}));
  });

  it('saves the reserve share with the payments category, offering only top-level expense categories', async () => {
    mockApi();
    renderWithQuery(<TaxStatusSection />);
    const percent = await screen.findByRole('textbox', { name: 'percentLabel' });
    await waitFor(() => expect(percent).toBeEnabled());

    fireEvent.change(percent, { target: { value: '27,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/tax/settings/reserve', {
        percent: 27.5,
        paymentsCategoryId: 'cat-tax',
      }),
    );
    expect(screen.queryByText('VAT')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales')).not.toBeInTheDocument();
  });

  it('will not save a share outside 0–100', async () => {
    mockApi();
    renderWithQuery(<TaxStatusSection />);
    const percent = await screen.findByRole('textbox', { name: 'percentLabel' });
    await waitFor(() => expect(percent).toBeEnabled());

    fireEvent.change(percent, { target: { value: '120' } });

    expect(await screen.findByText('percentInvalid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
  });

  it('turns the reserve off when the share is cleared', async () => {
    mockApi('registered', { percent: 30, paymentsCategoryId: null });
    renderWithQuery(<TaxStatusSection />);
    const percent = await screen.findByRole('textbox', { name: 'percentLabel' });
    await waitFor(() => expect(percent).toBeEnabled());
    await waitFor(() => expect(percent).toHaveValue('30'));

    fireEvent.change(percent, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/tax/settings/reserve', {
        percent: null,
        paymentsCategoryId: null,
      }),
    );
  });

  it('saves the filing frequency and keeps the extension as it was', async () => {
    mockApi();
    renderWithQuery(<TaxStatusSection />);
    await screen.findByText('remindersOn');

    selectOption(screen.getAllByRole('combobox')[1], 'frequencyMonthly');

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/tax/settings/vat-filing', {
        frequency: 'monthly',
        extension: false,
      }),
    );
  });

  it('holds the extension without pinning the default frequency', async () => {
    mockApi();
    renderWithQuery(<TaxStatusSection />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'extensionLabel' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/tax/settings/vat-filing', {
        frequency: null,
        extension: true,
      }),
    );
  });
});
