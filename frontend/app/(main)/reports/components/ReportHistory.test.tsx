// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const createObjectUrl = vi.hoisted(() => vi.fn(() => 'blob:report'));
const revokeObjectUrl = vi.hoisted(() => vi.fn());
const clickSpy = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiGet,
  },
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    labels: {
      historyEmpty: { value: 'Aucun rapport pour le moment' },
      historyEmptyHint: { value: 'Choisissez un modele et generez votre premier rapport.' },
      historyReport: { value: 'Rapport' },
      historyPeriod: { value: 'Periode' },
      historyFormat: { value: 'Format localise' },
      historyGenerated: { value: 'Genere' },
      historySize: { value: 'Taille' },
      historyDownload: { value: 'Telecharger' },
      justNow: { value: "A l'instant" },
      minutesAgo: { value: ' min' },
      hoursAgo: { value: ' h' },
      yesterday: { value: 'Hier' },
      daysAgo: { value: ' jours' },
    },
  }),
  useLocale: () => ({ locale: 'fr' }),
}));

vi.mock('@/app/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

// Imported once at collection: a dynamic import inside a test spends its
// timeout on the module graph under a loaded run.
import { ReportHistory } from './ReportHistory';

describe('ReportHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    apiGet.mockReset();
    clickSpy.mockReset();
    createObjectUrl.mockReset();
    createObjectUrl.mockReturnValue('blob:report');
    revokeObjectUrl.mockReset();

    // Stub only the blob helpers: replacing window.URL wholesale breaks `new URL()`.
    Object.assign(window.URL, {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', { value: clickSpy });
      }
      return element;
    }) as typeof document.createElement);
  });

  it('renders a re-download icon button and downloads the stored file', async () => {
    apiGet
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'report-1',
              templateId: 'pnl',
              templateName: 'Profit & Loss (P&L)',
              dateFrom: '2025-12-11',
              dateTo: '2026-03-18',
              format: 'excel',
              generatedBy: 'user@example.com',
              generatedAt: '2026-03-18T10:00:00.000Z',
              fileName: 'pnl-2025-12-11-2026-03-18.xlsx',
              fileSize: 18100,
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: new Blob(['report']) });

    render(<ReportHistory />);

    // Each row renders twice: the xs card list and the sm+ table.
    await waitFor(() => {
      expect(screen.getAllByText('Profit & Loss (P&L)')).toHaveLength(2);
    });

    const buttons = screen.getAllByRole('button', { name: 'Re-download Profit & Loss (P&L)' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(apiGet).toHaveBeenNthCalledWith(2, '/reports/history/report-1/download', {
        responseType: 'blob',
      });
    });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('renders localized headers and empty state copy from i18n', async () => {
    apiGet.mockResolvedValueOnce({ data: { data: [] } });

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText('Aucun rapport pour le moment')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Choisissez un modele et generez votre premier rapport.'),
    ).toBeInTheDocument();
  });

  it('renders localized table headers and relative time labels', async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'report-2',
            templateId: 'balance-sheet',
            templateName: 'Balance locale',
            dateFrom: '2026-03-01',
            dateTo: '2026-03-31',
            format: 'pdf',
            generatedBy: 'user@example.com',
            generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            fileName: 'balance.pdf',
            fileSize: 4096,
          },
        ],
      },
    });

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Balance locale')).toHaveLength(2);
    });

    expect(screen.getByText('Rapport')).toBeInTheDocument();
    expect(screen.getByText('Periode')).toBeInTheDocument();
    expect(screen.getByText('Format localise')).toBeInTheDocument();
    expect(screen.getByText('Genere')).toBeInTheDocument();
    expect(screen.getByText('Taille')).toBeInTheDocument();
    expect(screen.getByText('Telecharger')).toBeInTheDocument();
    expect(screen.getByText('2 h')).toBeInTheDocument();
  });
});
