import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { joinSummary, PageTitle } from './page-title';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    nav: { dashboard: 'Dashboard', budgets: 'Budgets', review: 'Review' },
    breadcrumbs: { home: 'Home', label: { value: 'Breadcrumb' } },
  }),
}));

describe('PageTitle', () => {
  it('names the page as its sidebar row does, with the row icon', () => {
    const { container } = render(<PageTitle path="/budgets" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Budgets');
    expect(container.querySelector('.seneca-page-title__icon svg')).not.toBeNull();
    expect(container.querySelector('.seneca-page-title__summary')).toBeNull();
  });

  it('puts the summary after an arrow, outside the heading', () => {
    const { container } = render(<PageTitle path="/review" summary="Receipts · Uncategorized" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Review');
    expect(container.querySelector('.seneca-page-title__arrow')).not.toBeNull();
    expect(container.querySelector('.seneca-page-title__summary')?.textContent).toBe(
      'Receipts · Uncategorized',
    );
  });
});

describe('PageTitle breadcrumbs', () => {
  it('leads from Home to the page', () => {
    render(<PageTitle path="/budgets" />);

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs.textContent).toBe('Home/Budgets');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe(DEFAULT_APP_ROUTE);
  });

  it('are left off the dashboard', () => {
    render(<PageTitle path={DEFAULT_APP_ROUTE} />);

    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('joinSummary', () => {
  it('leaves out what is not in force and is empty when nothing is', () => {
    expect(joinSummary(['Paid', false, '', '  ', null, undefined, 'Invoice'])).toBe(
      'Paid · Invoice',
    );
    expect(joinSummary([false, null])).toBeUndefined();
  });
});
