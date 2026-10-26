// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewTransactionItem } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { UseReviewInboxResult } from '../hooks/useReviewInbox';
import { ReviewInboxView } from './ReviewInboxView';

const appLocale = vi.hoisted(() => ({ current: 'en' }));
vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => '/review',
  useSearchParams: () => new URLSearchParams(),
}));

const row = (overrides: Partial<ReviewTransactionItem>): ReviewTransactionItem => ({
  kind: 'transaction',
  id: 'tx-1',
  date: '2026-10-09',
  counterpartyName: 'Anthropic, PBC',
  paymentPurpose: '',
  payee: null,
  amount: 289,
  currency: 'ILS',
  transactionType: 'expense',
  categoryId: null,
  categoryName: 'Professional services',
  categorySource: 'manual',
  categoryReason: null,
  statementId: null,
  receiptId: null,
  document: null,
  ...overrides,
});

const items = [
  row({}),
  row({ id: 'tx-2', categorySource: 'history', categoryReason: 'Captions (captions.ai)' }),
];

const state = (overrides: Partial<UseReviewInboxResult> = {}): UseReviewInboxResult => ({
  kind: 'transaction',
  setKind: vi.fn(),
  reviewer: 'anyone',
  setReviewer: vi.fn(),
  canFilterByReviewer: false,
  from: '',
  to: '',
  setFrom: vi.fn(),
  setTo: vi.fn(),
  initialDateFilter: null,
  uncategorized: false,
  clearUncategorized: vi.fn(),
  page: {
    kind: 'transaction',
    counts: { transaction: 2, receipt: 0, duplicate: 0, subscription: 0 },
    items,
    total: 2,
    page: 1,
    limit: 50,
  } as UseReviewInboxResult['page'],
  items,
  categories: [],
  isPending: false,
  error: null,
  selected: new Set(),
  toggle: vi.fn(),
  selectIds: vi.fn(),
  clearSelection: vi.fn(),
  cursor: -1,
  setCursor: vi.fn(),
  move: vi.fn(),
  busy: false,
  approve: vi.fn(async () => undefined),
  setCategory: vi.fn(async () => undefined),
  resolveDuplicate: vi.fn(async () => undefined),
  approveReceipt: vi.fn(async () => undefined),
  decideSubscription: vi.fn(async () => undefined),
  ...overrides,
});

describe('ReviewInboxView', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it('sets the currency code apart from the figure', () => {
    const { container } = renderWithQuery(<ReviewInboxView state={state()} />);
    const amount = container.querySelector('[data-testid="review-row"] .seneca-stmt-list-item__amount');
    expect(amount?.textContent).toBe('289.00 ILS');
    expect(amount?.querySelector('.seneca-stmt-list-item__currency')?.textContent?.trim()).toBe(
      'ILS',
    );
  });

  it('names the category source only when it is not the hand-picked default', () => {
    renderWithQuery(<ReviewInboxView state={state()} />);
    expect(screen.queryByText(/Picked by hand/i)).toBeNull();
    expect(screen.getByText(/Captions \(captions\.ai\)/)).toBeInTheDocument();
  });

  it('gives each row a quiet approve link instead of an outlined button', () => {
    const { container } = renderWithQuery(<ReviewInboxView state={state()} />);
    const links = container.querySelectorAll('[data-testid="review-row"] .seneca-review-row-approve');
    expect(links).toHaveLength(2);
    expect(container.querySelector('[data-testid="review-row"] .MuiButton-root')).toBeNull();
  });

  it('greys out empty tab counts and drops the brackets', () => {
    const { container } = renderWithQuery(<ReviewInboxView state={state()} />);
    const counts = [...container.querySelectorAll('.seneca-review-tab-count')];
    expect(counts.map(count => count.textContent)).toEqual(['2', '0', '0', '0']);
    expect(counts[0].className).not.toContain('--zero');
    expect(counts[1].className).toContain('seneca-review-tab-count--zero');
    expect(container.textContent).not.toContain('(0)');
  });

  it('shows the "no category" filter it was opened with, counts what it lists, and clears it', () => {
    const clearUncategorized = vi.fn();
    const base = state();
    const { container } = renderWithQuery(
      <ReviewInboxView
        state={state({
          uncategorized: true,
          clearUncategorized,
          // The rows tab badge counts unconfirmed rows; filtered, it counts the list.
          page: { ...base.page, total: 4 } as UseReviewInboxResult['page'],
        })}
      />,
    );
    const counts = [...container.querySelectorAll('.seneca-review-tab-count')];
    expect(counts[0].textContent).toBe('4');

    screen.getByRole('button', { name: /filterUncategorized|No category/ }).click();
    expect(clearUncategorized).toHaveBeenCalled();
  });

  it('opens the category drawer from an empty category slot instead of the document', async () => {
    const setCategory = vi.fn(async () => undefined);
    const push = vi.fn();
    routerPush.mockImplementation(push);
    renderWithQuery(
      <ReviewInboxView
        state={state({
          setCategory,
          items: [row({ categoryName: null, document: { source: 'statement', id: 's-1', fileName: 'a.pdf', fileType: 'pdf' } })],
          categories: [
            { id: '11111111-1111-4111-8111-111111111111', name: 'Groceries', type: 'expense', isEnabled: true },
          ] as UseReviewInboxResult['categories'],
        })}
      />,
    );

    screen.getAllByTestId('no-category-badge')[0].click();
    expect(push).not.toHaveBeenCalled();

    (await screen.findByText('Groceries')).click();
    expect(setCategory).toHaveBeenCalledWith('tx-1', '11111111-1111-4111-8111-111111111111');
  });

  it('shows the keyboard hints only once something is selected', () => {
    const { container, unmount } = renderWithQuery(<ReviewInboxView state={state()} />);
    expect(container.textContent).not.toMatch(/j\/k/);
    unmount();
    const selected = renderWithQuery(
      <ReviewInboxView state={state({ selected: new Set(['tx-1']) })} />,
    );
    expect(selected.container.textContent).toMatch(/j\/k/);
  });

  it("names a system category the workspace list does not hold in the reader's language", () => {
    appLocale.current = 'ru';
    renderWithQuery(
      <ReviewInboxView
        state={state({ items: [row({ categoryId: 'c-ads', categoryName: 'Advertising' })] })}
      />,
    );

    expect(screen.getByTitle('Реклама')).toHaveTextContent('Реклама');
    expect(screen.queryByText('Advertising')).toBeNull();
  });
});
