import { notificationUrl } from '@/modules/notifications/notification-url';

const link = (overrides: Record<string, unknown>) =>
  ({
    type: 'statement.uploaded',
    entityType: null,
    entityId: null,
    meta: null,
    ...overrides,
  }) as any;

describe('notificationUrl', () => {
  it('opens a statement on its details page, which exists, not on a bare /statements/:id', () => {
    expect(
      notificationUrl(link({ type: 'parsing.error', entityType: 'statement', entityId: 's-1' })),
    ).toBe('/statements/s-1/edit');
    expect(
      notificationUrl(link({ type: 'something.new', entityType: 'statement', entityId: 's-1' })),
    ).toBe('/statements/s-1/edit');
  });

  it('sends the weekly review digest to Review, though it reuses a statement type', () => {
    expect(
      notificationUrl(
        link({ type: 'transaction.uncategorized', entityType: 'review-inbox', entityId: 'ws-1' }),
      ),
    ).toBe('/review');
  });

  it('opens a receivable on its own page with the row focused', () => {
    expect(
      notificationUrl(
        link({ type: 'payable.overdue', entityId: 'p-1', meta: { direction: 'receivable' } }),
      ),
    ).toBe('/statements/receive?status=overdue&focus=payable%3Ap-1');
  });

  it('opens a transaction in its statement', () => {
    expect(
      notificationUrl(
        link({ type: 'other', entityType: 'transaction', meta: { statementId: 's-2' } }),
      ),
    ).toBe('/statements/s-2/edit');
  });

  it('falls back to the dashboard when there is nowhere better to go', () => {
    expect(notificationUrl(link({ type: 'other' }))).toBe('/dashboard');
  });
});
