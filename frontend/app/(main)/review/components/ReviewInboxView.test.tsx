// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewTransactionItem } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { UseReviewInboxResult } from '../hooks/useReviewInbox';
import { ReviewInboxView } from './ReviewInboxView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  resolveDuplicate: vi.fn(async () => undefined),
  approveReceipt: vi.fn(async () => undefined),
  decideSubscription: vi.fn(async () => undefined),
  ...overrides,
});

describe('ReviewInboxView', () => {
  it('sets the currency code apart from the figure', () => {
    const { container } = renderWithQuery(<ReviewInboxView state={state()} />);
    const amount = container.querySelector('[data-testid="review-row"] .lumio-stmt-list-item__amount');
    expect(amount?.textContent).toBe('289.00 ILS');
    expect(amount?.querySelector('.lumio-stmt-list-item__currency')?.textContent?.trim()).toBe(
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
    const links = container.querySelectorAll('[data-testid="review-row"] .lumio-review-row-approve');
    expect(links).toHaveLength(2);
    expect(container.querySelector('[data-testid="review-row"] .MuiButton-root')).toBeNull();
  });

  it('greys out empty tab counts and drops the brackets', () => {
    const { container } = renderWithQuery(<ReviewInboxView state={state()} />);
    const counts = [...container.querySelectorAll('.lumio-review-tab-count')];
    expect(counts.map(count => count.textContent)).toEqual(['2', '0', '0', '0']);
    expect(counts[0].className).not.toContain('--zero');
    expect(counts[1].className).toContain('lumio-review-tab-count--zero');
    expect(container.textContent).not.toContain('(0)');
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
});
