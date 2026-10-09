import { describe, expect, it } from 'vitest';
import { notificationHref } from './notification-href';

type Link = Parameters<typeof notificationHref>[0];

const make = (overrides: Partial<Link>): Link => ({
  type: 'statement.uploaded',
  entityType: null,
  entityId: null,
  meta: null,
  ...overrides,
});

describe('notificationHref', () => {
  it('opens an overdue payable filtered to overdue and rings its row', () => {
    expect(
      notificationHref(
        make({
          type: 'payable.overdue',
          entityType: 'payable',
          entityId: 'p-1',
          meta: { payableId: 'p-1', direction: 'payable' },
        }),
      ),
    ).toBe('/statements/pay?status=overdue&focus=payable%3Ap-1');
  });

  it('sends a receivable to the receive page', () => {
    expect(
      notificationHref(
        make({ type: 'payable.due_soon', entityId: 'p-2', meta: { direction: 'receivable' } }),
      ),
    ).toBe('/statements/receive?focus=payable%3Ap-2');
  });

  it('falls back to the pay page for payables written before direction was stored', () => {
    expect(
      notificationHref(make({ type: 'payable.marked_paid', meta: { payableId: 'p-3' } })),
    ).toBe('/statements/pay?status=paid&focus=payable%3Ap-3');
  });

  it('rings the budget card by category, or opens budgets when the category is unknown', () => {
    expect(
      notificationHref(
        make({ type: 'budget.warning', entityId: 'b-1', meta: { budgetId: 'b-1', categoryId: 'c-1' } }),
      ),
    ).toBe('/budgets?focus=budget%3Ac-1');
    expect(
      notificationHref(make({ type: 'budget.exceeded', entityId: 'b-1', meta: { budgetId: 'b-1' } })),
    ).toBe('/budgets');
  });

  it('rings the subscription the notification points at', () => {
    expect(
      notificationHref(
        make({ type: 'subscription.upcoming', entityType: 'subscription', entityId: 's-1' }),
      ),
    ).toBe('/subscriptions?focus=subscription%3As-1');
    expect(notificationHref(make({ type: 'subscription.detected' }))).toBe('/subscriptions');
  });

  it('opens the tax tab on the threshold card, not the workspace overview', () => {
    expect(
      notificationHref(
        make({ type: 'tax.threshold.reached', entityType: 'workspace', entityId: 'w-1' }),
      ),
    ).toBe('/reports?tab=tax&focus=tax%3Athreshold');
  });

  it('keeps statement notifications on the statement editor', () => {
    expect(notificationHref(make({ type: 'import.committed', entityId: 'st-1' }))).toBe(
      '/statements/st-1/edit',
    );
    expect(
      notificationHref(make({ type: 'receipt.uncategorized', entityType: 'receipt', entityId: 'r-1' })),
    ).toBe('/storage/gmail-receipts/r-1');
  });

  it('opens the review queue for the weekly digest, not a statement named by the workspace id', () => {
    expect(
      notificationHref(
        make({ type: 'transaction.uncategorized', entityType: 'review-inbox', entityId: 'ws-1' }),
      ),
    ).toBe('/review');
  });

  it('sends deleted statements to the trash and membership changes to members', () => {
    expect(notificationHref(make({ type: 'data.deleted', entityType: 'statement' }))).toBe(
      '/statements/trash',
    );
    expect(notificationHref(make({ type: 'data.deleted', entityType: 'transaction' }))).toBe(
      '/statements',
    );
    expect(notificationHref(make({ type: 'member.joined' }))).toBe('/workspaces/members');
  });

  it('returns null when there is nowhere to go', () => {
    expect(notificationHref(make({ type: 'note.mentioned' }))).toBeNull();
  });
});
