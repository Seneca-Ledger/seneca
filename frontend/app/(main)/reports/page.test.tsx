// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    labels: {
      title: { value: 'Rapports' },
      subtitle: { value: 'Genere des rapports localises' },
      tabTemplates: { value: 'Modeles' },
      tabHistory: { value: 'Historique' },
      tabCashFlow: { value: 'Flux de tresorerie (onglet)' },
      backToTemplates: { value: 'Retour aux modeles' },
      balanceSheetTitle: { value: 'Bilan localise' },
      templatePnlName: { value: 'PnL localise' },
      templatePnlDescription: { value: 'Description PnL localisee' },
      templateBalanceName: { value: 'Balance locale' },
      templateBalanceDescription: { value: 'Description balance localisee' },
      templateCashFlowName: { value: 'Flux de tresorerie' },
      templateCashFlowDescription: { value: 'Description cash flow localisee' },
      templateExpenseByCategoryName: { value: 'Depenses par categorie' },
      templateExpenseByCategoryDescription: { value: 'Description depenses localisee' },
    },
  }),
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Reads the Review counts through React Query; its own test covers it.
vi.mock('@/app/components/review/UnconfirmedNotice', () => ({ UnconfirmedNotice: () => null }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/reports',
}));

vi.mock('@/app/hooks/useAttentionFocus', () => ({ useAttentionFocus: () => null }));

// The tab has its own tests; here only its label on the tab strip matters.
vi.mock('./components/cash-flow/CashFlowTab', () => ({
  CashFlowTab: () => <div>Cash Flow Tab</div>,
}));

vi.mock('./components/BalanceSheet', () => ({
  default: () => <div>Balance Sheet</div>,
}));

vi.mock('./components/ReportGenerator', () => ({
  ReportGenerator: () => <div>Report Generator</div>,
}));

vi.mock('./components/ReportHistory', () => ({
  ReportHistory: () => <div>Report History</div>,
}));

describe('ReportsPage', () => {
  // Explicit, so one failing case cannot leave its tree mounted and make the
  // next one find two of every tab.
  afterEach(cleanup);

  it('renders localized page copy and tab labels from i18n', async () => {
    const { default: ReportsPage } = await import('./page');
    render(<ReportsPage />);

    expect(screen.getByRole('tab', { name: 'Modeles' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Historique' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Flux de tresorerie (onglet)' })).toBeInTheDocument();

    // The page opens on Cash flow, so the templates are one click away.
    fireEvent.click(screen.getByRole('tab', { name: 'Modeles' }));
    expect(screen.getByText('Balance locale')).toBeInTheDocument();
    expect(screen.getByText('Description balance localisee')).toBeInTheDocument();
  });
});
