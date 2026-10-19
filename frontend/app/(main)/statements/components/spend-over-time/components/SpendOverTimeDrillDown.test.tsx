import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SpendOverTimeRecord } from '@/app/(main)/statements/components/spend-over-time.utils';
import { SpendOverTimeDrillDown } from './SpendOverTimeDrillDown';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/app/(main)/statements/components/analytics/AnalyticsSourceBadge', () => ({
  AnalyticsSourceBadge: () => <span>source-badge</span>,
}));

function renderDrillDown(onClose = vi.fn(), records: SpendOverTimeRecord[] = []) {
  render(
    <SpendOverTimeDrillDown
      selectedPoint={{
        period: '2026-08-24',
        label: '2026-08-24',
        income: 4850,
        expense: 0,
        net: 4850,
        count: 1,
        statementAmount: 4850,
        gmailAmount: 0,
      }}
      drillDownRecords={records}
      groupBy="day"
      onClose={onClose}
      currency="EUR"
      sourceLabels={{
        sourceBank: 'Bank',
        sourceReceipt: 'Receipt',
        sourceGmailInbox: 'Gmail',
        sourceCrypto: 'Crypto',
      }}
      labels={{
        drillDown: 'Drill-down',
        close: 'Close',
        noOperations: 'No operations',
        lastOperation: 'Last operation',
        source: 'Source',
        workspace: 'Workspace',
        amount: 'Amount',
      }}
    />,
  );
  return { onClose, dialog: screen.getByRole('dialog', { name: '2026-08-24 - Drill-down' }) };
}

describe('SpendOverTimeDrillDown', () => {
  it('renders above the page in a portal and keeps focus inside', () => {
    const { dialog } = renderDrillDown();

    expect(dialog.closest('.MuiModal-root')?.parentElement).toBe(document.body);
    expect(dialog.parentElement?.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', () => {
    const { dialog, onClose } = renderDrillDown();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a click in the dimmed area but not inside the dialog', () => {
    const { dialog, onClose } = renderDrillDown();

    fireEvent.click(screen.getByText('No operations'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the document behind an operation, from its name or the whole row', () => {
    const receipt = {
      id: 'rc-1',
      merchant: 'grizzlysms.com',
      amount: 3.73,
      currencyValue: 'USD',
      dateValue: '2026-10-12',
      sourceChannel: 'receipt',
      href: '/storage/receipts/rc-1',
    } as SpendOverTimeRecord;
    renderDrillDown(vi.fn(), [receipt]);

    const links = screen.getAllByRole('link', { name: /grizzlysms\.com/ });
    // The table's name link and the phone list's row link.
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/storage/receipts/rc-1',
      '/storage/receipts/rc-1',
    ]);

    push.mockReset();
    // A click elsewhere in the row, not on the link itself.
    const row = links[0].closest('tr') as HTMLElement;
    fireEvent.click(row.querySelector('td') as HTMLElement);
    expect(push).toHaveBeenCalledWith('/storage/receipts/rc-1');
  });
});
