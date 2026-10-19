// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const uiLocale = vi.hoisted(() => ({ value: 'kk' }));

vi.mock('../../../lib/api', () => ({
  default: {
    get: apiGet,
    post: apiPost,
  },
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    labels: {
      assets: { value: 'Actifs' },
      liabilities: { value: 'Passifs' },
      asOfNow: { value: 'Maintenant' },
      asOfDate: { value: 'A la date' },
      savingBalance: { value: 'Enregistrement...' },
      balanceSaved: { value: 'Balance enregistree' },
      exportBalance: { value: 'Exporter le bilan' },
      exportExcel: { value: 'Excel localise' },
      exportPdf: { value: 'PDF localise' },
      balanceDifference: { value: 'Difference' },
      loadingEllipsis: { value: 'Chargement...' },
      noData: { value: 'Pas de donnees' },
      refresh: { value: 'Actualiser' },
    },
    errors: {
      loadReport: { value: 'Erreur de chargement' },
    },
  }),
  useLocale: () => ({ locale: uiLocale.value }),
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));

describe('BalanceSheet', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    uiLocale.value = 'kk';
  });

  it('asks for the sheet in a language the report has, not the UI locale as is', async () => {
    // The API takes ru, en or kk and answers 400 to anything else.
    uiLocale.value = 'de';
    apiGet.mockResolvedValueOnce({
      data: {
        date: '2026-04-02',
        currency: 'EUR',
        assets: { total: 0, sections: [] },
        liabilities: { total: 0, sections: [] },
        difference: 0,
        isBalanced: true,
        missingRates: [],
      },
    });

    const { default: BalanceSheet } = await import('./BalanceSheet');
    renderWithQuery(<BalanceSheet />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/reports/balance/sheet', {
        params: { locale: 'en' },
        signal: expect.any(AbortSignal),
      });
    });
  });

  it('passes locale to sheet and export API calls', async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        date: '2026-04-02',
        currency: 'KZT',
        assets: { total: 100, sections: [] },
        liabilities: { total: 100, sections: [] },
        difference: 0,
        isBalanced: true,
        missingRates: [],
      },
    });
    apiPost.mockResolvedValueOnce({
      data: new Blob(['sheet']),
      headers: {
        'content-disposition': 'attachment; filename="balance-sheet-2026-04-02.xlsx"',
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

    const createObjectUrl = vi.fn(() => 'blob:balance');
    const revokeObjectUrl = vi.fn();
    // Only the two statics: replacing URL itself breaks everything that constructs one.
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrl, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectUrl, configurable: true });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', { value: vi.fn() });
      }
      return element;
    }) as typeof document.createElement);

    const { default: BalanceSheet } = await import('./BalanceSheet');
    renderWithQuery(<BalanceSheet />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenNthCalledWith(1, '/reports/balance/sheet', {
        params: { locale: 'kk' },
        signal: expect.any(AbortSignal),
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Exporter le bilan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel localise' }));

    // Exports go through the shared template endpoint so they land in report history.
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/reports/generate',
        {
          templateId: 'balance-sheet',
          dateFrom: '2026-04-02',
          dateTo: '2026-04-02',
          format: 'excel',
          locale: 'kk',
        },
        { responseType: 'blob' },
      );
    });
  });
});
