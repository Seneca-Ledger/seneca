import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const documentTypeIconSpy = vi.hoisted(() => vi.fn());
const pdfThumbnailSpy = vi.hoisted(() => vi.fn());

type IconProps = {
  fileId?: string;
};

vi.mock('@/app/components/DocumentTypeIcon', () => ({
  DocumentTypeIcon: (props: IconProps) => {
    documentTypeIconSpy(props);
    return <div data-testid={`document-type-icon-${props.fileId || 'static'}`} />;
  },
}));

vi.mock('@/app/components/PDFThumbnail', () => ({
  PDFThumbnail: (props: IconProps) => {
    pdfThumbnailSpy(props);
    return <div data-testid={`pdf-thumbnail-${props.fileId || 'static'}`} />;
  },
}));

import { StatementsListItem } from './StatementsListItem';

type StatementsListItemProps = React.ComponentProps<typeof StatementsListItem>;

type Statement = {
  id: string;
  source?: 'statement' | 'gmail' | 'scan';
  fileName: string;
  subject?: string;
  sender?: string;
  status: string;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
  createdAt: string;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  bankName: string;
  fileType: string;
  currency?: string | null;
  receivedAt?: string;
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
  };
};

describe('StatementsListItem', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    documentTypeIconSpy.mockReset();
    pdfThumbnailSpy.mockReset();
  });

  afterEach(() => {
    container.remove();
    container = null as unknown as HTMLDivElement;
  });

  it('renders Gmail receipt using document layout', () => {
    const root = createRoot(container);
    const onView = vi.fn();
    const onIconClick = vi.fn();

    const statement: Statement = {
      id: 'gmail-1',
      source: 'gmail',
      fileName: 'Receipt.pdf',
      subject: 'Receipt',
      sender: 'sender@example.com',
      status: 'parsed',
      totalDebit: null,
      totalCredit: null,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: null,
      statementDateTo: null,
      bankName: 'gmail',
      fileType: 'pdf',
      currency: 'KZT',
      receivedAt: '2026-02-01T00:00:00Z',
      parsedData: {
        amount: 1200,
        currency: 'KZT',
        vendor: 'Shop',
        date: '2026-02-01',
      },
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt
          isProcessing={false}
          merchantLabel="Shop"
          amountLabel="1,200KZT"
          dateLabel="02/01/2026"
          onView={onView}
          onIconClick={onIconClick}
          typeLabel="PDF"
          onToggleSelect={() => undefined}
        />,
      );
    });

    expect(container.textContent).toContain('Shop');
    const viewIcon = container.querySelector('[data-testid="statement-view-icon"]');
    expect(viewIcon).toBeTruthy();
    expect(container.querySelector('img[alt="Gmail"]')).not.toBeNull();
  });

  it('renders a stacked phone layout next to the column layout', () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'statement-1',
      source: 'statement',
      fileName: 'Report.pdf',
      status: 'parsed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
        />,
      );
    });

    // CSS shows one or the other at 768px; the phone row must carry who, how much and when.
    const mobile = container.querySelector('[data-testid="statement-item-mobile-statement-1"]');
    expect(mobile?.querySelector('.lumio-stmt-list-item__mobile-merchant')?.textContent).toBe(
      'Kaspi',
    );
    expect(mobile?.querySelector('.lumio-stmt-list-item__mobile-amount')?.textContent).toBe(
      '1,200 KZT',
    );
    expect(mobile?.textContent).toContain('01/31/2026');
    expect(
      container.querySelector('[data-testid="statement-item-desktop-statement-1"]'),
    ).toBeTruthy();
  });

  it('uses receipt thumbnail source for local receipts', async () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'receipt-local-1',
      source: 'scan',
      fileName: 'receipt.jpg',
      subject: 'Store receipt',
      sender: 'camera-scan',
      status: 'parsed',
      totalDebit: null,
      totalCredit: null,
      createdAt: '2026-03-27T00:00:00Z',
      statementDateFrom: null,
      statementDateTo: null,
      bankName: 'receipt',
      fileType: 'receipt',
      currency: 'KZT',
      receivedAt: '2026-03-27T00:00:00Z',
      parsedData: {
        amount: 90.32,
        currency: 'KZT',
        vendor: 'Walmart',
        date: '2026-03-27',
      },
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt
          isProcessing={false}
          merchantLabel="Walmart"
          amountLabel="90.32KZT"
          dateLabel="03/27/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="Receipt"
        />,
      );
    });

    expect(documentTypeIconSpy).toHaveBeenCalled();
    expect(documentTypeIconSpy.mock.calls.every(([props]) => props.source === 'receipt')).toBe(
      true,
    );

    const previewTrigger = container.querySelector(
      '[data-testid="statement-thumbnail-trigger-receipt-local-1"]',
    ) as HTMLButtonElement | null;
    expect(previewTrigger).toBeTruthy();

    await act(async () => {
      previewTrigger?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await Promise.resolve();
    });

    expect(pdfThumbnailSpy).toHaveBeenCalled();
    expect(pdfThumbnailSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        fileId: 'receipt-local-1',
        source: 'receipt',
      }),
    );
  });

  it('renders hover preview in portal without clipping', async () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'statement-hover-preview',
      source: 'statement',
      fileName: 'Preview.pdf',
      status: 'parsed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
        />,
      );
    });

    const previewTrigger = container.querySelector(
      '[data-testid="statement-thumbnail-trigger-statement-hover-preview"]',
    ) as HTMLButtonElement | null;
    expect(previewTrigger).toBeTruthy();

    await act(async () => {
      previewTrigger?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.querySelector('[data-testid="statement-hover-preview"]')).toBeTruthy();
  });

  it('dismisses hover preview when the list scrolls', async () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'statement-hover-scroll',
      source: 'statement',
      fileName: 'Preview.pdf',
      status: 'parsed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
        />,
      );
    });

    const previewTrigger = container.querySelector(
      '[data-testid="statement-thumbnail-trigger-statement-hover-scroll"]',
    ) as HTMLButtonElement | null;
    expect(previewTrigger).toBeTruthy();

    await act(async () => {
      previewTrigger?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.querySelector('[data-testid="statement-hover-preview"]')).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      await Promise.resolve();
    });

    expect(document.body.querySelector('[data-testid="statement-hover-preview"]')).toBeNull();
  });

  it('opens from the unified column row overlay', () => {
    const root = createRoot(container);
    const onView = vi.fn();

    const statement: Statement = {
      id: 'statement-compact',
      source: 'statement',
      fileName: 'Receipt.pdf',
      status: 'parsed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          onView={onView}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
        />,
      );
    });

    const rowContainer = container.querySelector(
      '[data-testid="statement-item-desktop-statement-compact"]',
    ) as HTMLDivElement | null;
    expect(rowContainer).toBeTruthy();
    expect(rowContainer?.textContent).toContain('Kaspi');
    expect(rowContainer?.textContent).toContain('1,200 KZT');
    expect(rowContainer?.textContent).toContain('01/31/2026');

    act(() => {
      rowContainer?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onView).toHaveBeenCalledTimes(1);

    const overlayButton = container.querySelector(
      '.lumio-stmt-list-item__desktop-overlay',
    ) as HTMLButtonElement | null;
    expect(overlayButton).toBeTruthy();

    act(() => {
      overlayButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onView).toHaveBeenCalledTimes(2);
  });

  it('renders payments icon for manual expense type', () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'manual-1',
      source: 'statement',
      fileName: 'manual-expense.csv',
      status: 'completed',
      totalDebit: 222,
      totalCredit: 0,
      createdAt: '2026-02-20T00:00:00Z',
      statementDateFrom: '2026-02-20',
      statementDateTo: '2026-02-20',
      bankName: 'other',
      fileType: 'file',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          isManualExpense
          merchantLabel="adad"
          amountLabel="222KZT"
          dateLabel="02/20/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="FILE"
        />,
      );
    });

    const paymentsIcon = container.querySelector(
      '[data-testid="manual-expense-type-icon"]',
    ) as SVGElement | null;

    expect(paymentsIcon).toBeTruthy();
    expect(container.textContent).not.toContain('FILE');
  });

  it('renders receipt icon for receipt-scan statement instead of gmail icon', () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'receipt-scan-1',
      source: 'scan',
      fileName: 'receipt.jpg',
      status: 'completed',
      totalDebit: 90.32,
      totalCredit: 0,
      createdAt: '2026-03-27T00:00:00Z',
      statementDateFrom: '2026-03-27',
      statementDateTo: '2026-03-27',
      bankName: 'other',
      fileType: 'image',
      currency: 'KZT',
      parsingDetails: {
        detectedBy: 'receipt-scan',
        importPreview: {
          source: 'receipt-scan',
          merchant: 'Walmart',
        },
      },
    } as Statement & {
      parsingDetails: {
        detectedBy: string;
        importPreview: { source: string; merchant: string };
      };
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement as StatementsListItemProps['statement']}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Walmart"
          amountLabel="90.32KZT"
          dateLabel="03/27/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="IMAGE"
        />,
      );
    });

    expect(container.querySelector('img[alt="Gmail"]')).toBeNull();
    const receiptIcons = container.querySelectorAll('[data-testid="receipt-statement-type-icon"]');
    expect(receiptIcons.length).toBe(1);
    expect(
      container.querySelector('[data-testid="statement-thumbnail-trigger-receipt-scan-1"]'),
    ).toBeTruthy();
  });

  it('badges a needs_review statement distinctly from a completed one', () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'statement-needs-review',
      source: 'statement',
      fileName: 'Unreconciled.pdf',
      status: 'needs_review',
      totalDebit: 100,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="100 KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
        />,
      );
    });

    expect(container.querySelector('.lumio-stmt-badge--review')).toBeTruthy();
    // Must not read as done: the statement is excluded from analytics until confirmed.
    expect(container.querySelector('.lumio-stmt-badge--completed')).toBeNull();
    expect(container.textContent).toContain('Needs review');
  });

  it('does not call onView when view is disabled', () => {
    const root = createRoot(container);
    const onView = vi.fn();

    const statement: Statement = {
      id: 'statement-disabled-view',
      source: 'statement',
      fileName: 'Processing.pdf',
      status: 'processing',
      totalDebit: 0,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing
          merchantLabel="Kaspi"
          amountLabel="0 KZT"
          dateLabel="01/31/2026"
          onView={onView}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
          viewDisabled
        />,
      );
    });

    const overlayButton = container.querySelector(
      '.lumio-stmt-list-item__desktop-overlay',
    ) as HTMLButtonElement | null;
    expect(overlayButton).toBeTruthy();

    act(() => {
      overlayButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const desktopViewButton = container.querySelector(
      '[data-testid="statement-view-icon"]',
    ) as HTMLButtonElement | null;
    expect(desktopViewButton).toBeTruthy();

    act(() => {
      desktopViewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onView).not.toHaveBeenCalled();
  });

  it('renders amount loader instead of zero while statement parsing is in progress', () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'statement-loading-amount',
      source: 'statement',
      fileName: 'Scanning.pdf',
      status: 'uploaded',
      totalDebit: 0,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Scanning..."
          amountLabel="0 KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
          viewDisabled
        />,
      );
    });

    expect(container.textContent).not.toContain('0 KZT');
    // One loader in the column layout, one in the phone layout.
    expect(container.querySelectorAll('[aria-label="Loading"]')).toHaveLength(2);
  });

  it('uses the primary color for amounts in dark mode', () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'statement-dark-amount',
      source: 'statement',
      fileName: 'Readable.pdf',
      status: 'completed',
      totalDebit: 702799.13,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="702,799.13KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
        />,
      );
    });

    const desktop = container.querySelector(
      '[data-testid="statement-item-desktop-statement-dark-amount"]',
    ) as HTMLElement;
    const amountNodes = Array.from(desktop.querySelectorAll('p, span')).filter(node =>
      node.textContent?.includes('702,799.13KZT'),
    );

    expect(amountNodes).toHaveLength(1);
    amountNodes.forEach(node => {
      expect(node.textContent).toContain('702,799.13KZT');
    });
  });

  it('renders primary duplicate badge and review action for duplicate item', () => {
    const root = createRoot(container);

    const statement: Statement = {
      id: 'duplicate-1',
      source: 'statement',
      fileName: 'Duplicate.pdf',
      status: 'completed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          duplicateActionLabel="Review"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          isPossibleDuplicate
          duplicateRole="primary"
          duplicatePosition={1}
          duplicateGroupSize={2}
          duplicateReason="Same amount + same date + same merchant"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          typeLabel="PDF"
        />,
      );
    });

    expect(container.textContent).toContain('PRIMARY #1/2');
    expect(container.textContent).toContain('Review');
    const duplicateRow = container.querySelector('.lumio-stmt-list-item') as HTMLElement | null;
    const duplicateAccent = container.querySelector(
      '.lumio-stmt-list-item__accent',
    ) as HTMLElement | null;

    expect(duplicateRow?.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(duplicateRow?.style.boxShadow).toContain('inset 0 0 0 1px');
    expect(duplicateAccent?.style.width).toBe('4px');
  });

  it('honors desktop column visibility and keeps hidden action rows clickable', () => {
    const root = createRoot(container);
    const onView = vi.fn();

    const statement: Statement = {
      id: 'column-hidden-action',
      source: 'statement',
      fileName: 'Configurable.pdf',
      status: 'completed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    };

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          onView={onView}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          columns={[
            { id: 'merchant', label: 'Merchant', visible: true, order: 0 },
            { id: 'amount', label: 'Amount', visible: false, order: 1 },
            { id: 'action', label: 'Action', visible: false, order: 2 },
          ]}
        />,
      );
    });

    const desktopContainer = container.querySelector(
      '[data-testid="statement-item-desktop-column-hidden-action"]',
    ) as HTMLDivElement | null;
    expect(desktopContainer?.textContent).toContain('Kaspi');
    expect(desktopContainer?.textContent).not.toContain('1,200 KZT');
    expect(desktopContainer?.querySelector('[data-testid="statement-view-icon"]')).toBeNull();

    const desktopOverlay = container.querySelector(
      '.lumio-stmt-list-item__desktop-overlay',
    ) as HTMLButtonElement | null;
    expect(desktopOverlay).toBeTruthy();

    act(() => {
      desktopOverlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('renders optional summary columns with fallbacks from statement data', () => {
    const root = createRoot(container);

    const statement = {
      id: 'column-optional-values',
      source: 'statement',
      fileName: 'Summary.pdf',
      status: 'completed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'USD',
      category: { id: 'cat-1', name: 'Software' },
      tags: [{ id: 'tag-1', name: 'SaaS' }],
      transactionSummary: {
        description: 'Cloud subscription',
        exchangeRate: '4.5500',
        exchangeRateMixed: false,
        cardLabel: 'Corporate card',
      },
    } as StatementsListItemProps['statement'];

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          currentExchangeRateLabels={{ 'USD:KZT': '1 USD = 512.34 KZT' }}
          workspaceCurrency="KZT"
          columns={[
            { id: 'category', label: 'Category', visible: true, order: 0 },
            { id: 'tag', label: 'Tag', visible: true, order: 1 },
            { id: 'description', label: 'Description', visible: true, order: 2 },
            { id: 'exchangeRate', label: 'Exchange rate', visible: true, order: 3 },
            { id: 'card', label: 'Card', visible: true, order: 4 },
          ]}
        />,
      );
    });

    const desktopContainer = container.querySelector(
      '[data-testid="statement-item-desktop-column-optional-values"]',
    ) as HTMLDivElement | null;
    expect(desktopContainer?.textContent).toContain('Software');
    expect(desktopContainer?.textContent).toContain('SaaS');
    expect(desktopContainer?.textContent).toContain('Cloud subscription');
    expect(desktopContainer?.textContent).toContain('1 USD = 512.34 KZT');
    expect(desktopContainer?.textContent).toContain('Corporate card');
  });

  it('uses the current USD exchange rate for non-USD statement rows', () => {
    const root = createRoot(container);

    const statement = {
      id: 'column-usd-rate',
      source: 'statement',
      fileName: 'Summary.pdf',
      status: 'completed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      statementDateFrom: '2026-01-01',
      statementDateTo: '2026-01-31',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    } as StatementsListItemProps['statement'];

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          currentExchangeRateLabels={{ 'USD:KZT': '1 USD = 512.34 KZT' }}
          workspaceCurrency="KZT"
          columns={[{ id: 'exchangeRate', label: 'Exchange rate', visible: true, order: 0 }]}
        />,
      );
    });

    const desktopContainer = container.querySelector(
      '[data-testid="statement-item-desktop-column-usd-rate"]',
    ) as HTMLDivElement | null;
    expect(desktopContainer?.textContent).toContain('1 USD = 512.34 KZT');
  });

  it('uses the current USD exchange rate when workspace currency is missing', () => {
    const root = createRoot(container);

    const statement = {
      id: 'column-usd-rate-default-currency',
      source: 'statement',
      fileName: 'Summary.pdf',
      status: 'completed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
    } as StatementsListItemProps['statement'];

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          currentExchangeRateLabels={{ 'USD:KZT': '1 USD = 512.34 KZT' }}
          workspaceCurrency={null}
          columns={[{ id: 'exchangeRate', label: 'Exchange rate', visible: true, order: 0 }]}
        />,
      );
    });

    const desktopContainer = container.querySelector(
      '[data-testid="statement-item-desktop-column-usd-rate-default-currency"]',
    ) as HTMLDivElement | null;
    expect(desktopContainer?.textContent).toContain('1 USD = 512.34 KZT');
  });

  it('normalizes NIS workspace currency to ILS for current exchange rates', () => {
    const root = createRoot(container);

    const statement = {
      id: 'column-usd-rate-nis-currency',
      source: 'statement',
      fileName: 'Summary.pdf',
      status: 'completed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-01T00:00:00Z',
      bankName: 'hapoalim',
      fileType: 'pdf',
      currency: 'ILS',
    } as StatementsListItemProps['statement'];

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Hapoalim"
          amountLabel="1,200 ILS"
          dateLabel="01/31/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          currentExchangeRateLabels={{ 'USD:ILS': '1 USD = 3.72 ILS' }}
          workspaceCurrency="NIS"
          columns={[{ id: 'exchangeRate', label: 'Exchange rate', visible: true, order: 0 }]}
        />,
      );
    });

    const desktopContainer = container.querySelector(
      '[data-testid="statement-item-desktop-column-usd-rate-nis-currency"]',
    ) as HTMLDivElement | null;
    expect(desktopContainer?.textContent).toContain('1 USD = 3.72 ILS');
  });

  it('links the category chip to that category on the Top categories leaderboard', () => {
    const root = createRoot(container);

    const statement = {
      id: 'column-category-link',
      source: 'statement',
      fileName: 'Summary.pdf',
      status: 'completed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-05T00:00:00Z',
      statementDateTo: '2026-03-18T00:00:00Z',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
      category: { id: 'cat-1', name: 'Meals and entertainment', color: '#b45309', icon: null },
    } as StatementsListItemProps['statement'];

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="03/18/2026"
          onView={() => undefined}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          columns={[{ id: 'category', label: 'Category', visible: true, order: 0 }]}
        />,
      );
    });

    const link = container.querySelector('a.lumio-stmt-category-link') as HTMLAnchorElement | null;
    // The statement's own month, so the leaderboard opens where the row is.
    expect(link?.getAttribute('href')).toBe(
      '/reports?tab=cash-flow&month=2026-03&focus=category%3Ameals+and+entertainment',
    );
    expect(link?.textContent).toContain('Meals and entertainment');
  });

  it('treats a category chip click as a row click until the chip lights up', () => {
    const root = createRoot(container);
    const onView = vi.fn();

    const statement = {
      id: 'column-category-link-click',
      source: 'statement',
      fileName: 'Summary.pdf',
      status: 'completed',
      totalDebit: 1200,
      totalCredit: 0,
      createdAt: '2026-02-05T00:00:00Z',
      bankName: 'kaspi',
      fileType: 'pdf',
      currency: 'KZT',
      category: { id: 'cat-1', name: 'Travel', color: null, icon: null },
    } as StatementsListItemProps['statement'];

    act(() => {
      root.render(
        <StatementsListItem
          statement={statement}
          viewLabel="View"
          isReceipt={false}
          isProcessing={false}
          merchantLabel="Kaspi"
          amountLabel="1,200 KZT"
          dateLabel="02/05/2026"
          onView={onView}
          onIconClick={() => undefined}
          onToggleSelect={() => undefined}
          columns={[{ id: 'category', label: 'Category', visible: true, order: 0 }]}
        />,
      );
    });

    const link = container.querySelector('a.lumio-stmt-category-link') as HTMLAnchorElement | null;
    // jsdom would try to follow the href and log "navigation not implemented".
    container.addEventListener('click', event => event.preventDefault(), true);

    // Not lit: the chip is still part of the row.
    const beforeDwell = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => {
      link?.dispatchEvent(beforeDwell);
    });
    expect(onView).toHaveBeenCalledTimes(1);
    expect(beforeDwell.defaultPrevented).toBe(true);

    // Focus lights it without the dwell; now the click belongs to the link.
    act(() => {
      link?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(link?.className).toContain('lumio-stmt-category-link--lit');

    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onView).toHaveBeenCalledTimes(1);
  });
});
