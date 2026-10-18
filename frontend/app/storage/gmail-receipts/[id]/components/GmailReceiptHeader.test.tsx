// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GmailReceipt } from '../hooks/useGmailReceiptData';
import { GmailReceiptHeader } from './GmailReceiptHeader';

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const renderHeader = (hasDisabledCategory = false) =>
  render(
    <GmailReceiptHeader
      receipt={{ id: 'r-1', subject: 'Invoice' } as GmailReceipt}
      statusLabel="Draft"
      lineItemsCount={1}
      hasCategoryIssues={false}
      hasCategory
      hasDisabledCategory={hasDisabledCategory}
      selectedCategory={{ id: 'cat-ads', name: 'Advertising' }}
      canSubmit
      submitting={false}
      exporting={false}
      gmailMessageLink={null}
      readinessSeverity="success"
      readinessInlineText=""
      onOpenCategory={vi.fn()}
      onSubmit={vi.fn()}
      onOpenPayable={vi.fn()}
      onExportToGmailDraft={vi.fn()}
      onExportToXlsx={vi.fn()}
    />,
  );

describe('GmailReceiptHeader', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it("names the chosen system category in the reader's language", () => {
    appLocale.current = 'ru';
    renderHeader();

    const button = screen.getByTitle('Реклама');
    expect(button).toHaveTextContent('Реклама');
    expect(screen.queryByText('Advertising')).toBeNull();
  });

  it("names a disabled category in the reader's language too", () => {
    appLocale.current = 'ru';
    renderHeader(true);

    expect(screen.getByText('Реклама — disabled')).toBeInTheDocument();
  });

  it('keeps the stored name in English', () => {
    renderHeader();

    expect(screen.getByTitle('Advertising')).toHaveTextContent('Advertising');
  });
});
