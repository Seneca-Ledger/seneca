import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TopMerchantsDrillDown } from './TopMerchantsDrillDown';

vi.mock('@/app/(main)/statements/components/analytics/AnalyticsSourceBadge', () => ({
  AnalyticsSourceBadge: () => <span>source-badge</span>,
}));

const baseProps: ComponentProps<typeof TopMerchantsDrillDown> = {
  selectedRow: {
    id: 'merchant-1',
    merchant: 'GitHub',
    sourceType: 'receipt',
    sourceChannel: 'receipt',
    flowType: 'spend',
    count: 1,
    total: 39,
    average: 39,
    lastDate: '2026-03-16',
    currency: 'USD',
  },
  drillDownRecords: [
    {
      id: 'receipt-1',
      source: 'scan',
      fileName: 'GitHub receipt',
      subject: 'GitHub',
      sender: 'noreply@github.com',
      status: 'processed',
      fileType: 'receipt',
      createdAt: '2026-03-16T00:00:00.000Z',
      statementDateFrom: '2026-03-16',
      statementDateTo: null,
      bankName: 'receipt',
      totalDebit: 39,
      totalCredit: null,
      currency: 'USD',
      exported: null,
      paid: null,
      parsingDetails: null,
      user: null,
      receivedAt: '2026-03-16T00:00:00.000Z',
      parsedData: { vendor: 'GitHub', date: '2026-03-16' },
      sourceType: 'receipt',
      sourceChannel: 'receipt',
      flowType: 'spend',
      merchant: 'GitHub',
      amount: 39,
      currencyValue: 'USD',
      dateValue: '2026-03-16',
      paymentPurpose: null,
      workspaceId: 'ws-1',
      workspaceName: 'Admin workspace',
    },
  ],
  onClose: () => {},
  currency: 'KZT',
  sourceLabels: {
    sourceBank: 'Bank',
    sourceCrypto: 'Crypto',
    sourceReceipt: 'Receipt',
  },
  labels: {
    drillDown: 'Drill-down',
    close: 'Close',
    noOperations: 'No operations',
    lastOperation: 'Last operation',
    source: 'Source',
    workspace: 'Workspace',
    amount: 'Amount',
  },

};

describe('TopMerchantsDrillDown', () => {
  it('uses record currency for drill-down rows instead of workspace currency', () => {
    render(<TopMerchantsDrillDown {...baseProps} />);
    const html = document.body.innerHTML;

    expect(html).toContain('39');
    expect(html).toContain('$');
    expect(html).not.toContain('KZT');
  });

  it('keeps focus inside the dialog and closes on Escape', () => {
    const onClose = vi.fn();
    render(<TopMerchantsDrillDown {...baseProps} onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'GitHub - Drill-down' });
    expect(dialog.parentElement?.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a click in the dimmed area but not inside the dialog', () => {
    const onClose = vi.fn();
    render(<TopMerchantsDrillDown {...baseProps} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'GitHub - Drill-down' });

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
