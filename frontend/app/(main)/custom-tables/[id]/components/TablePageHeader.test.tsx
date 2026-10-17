// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomTable } from '../utils/tableTypes';
import { TablePageHeader, type TablePageHeaderLabels } from './TablePageHeader';

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

const labels: TablePageHeaderLabels = {
  back: 'Back',
  rename: 'Rename',
  rows: '{{count}} rows',
  sources: { manual: 'Manual' },
  sourceKinds: {},
  syncedAt: 'Synced {{date}}',
  untitled: 'Untitled',
};

const table = {
  id: 'table-1',
  name: 'Ads spend',
  description: null,
  source: 'manual',
  categoryId: 'cat-ads',
  category: { id: 'cat-ads', name: 'Advertising' },
  columns: [],
} as unknown as CustomTable;

const renderHeader = () =>
  render(
    <TablePageHeader
      table={table}
      total={3}
      onBack={vi.fn()}
      onRename={vi.fn()}
      labels={labels}
    />,
  );

describe('TablePageHeader', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it("names the table's system category in the reader's language", () => {
    appLocale.current = 'ru';
    renderHeader();

    expect(screen.getByText('Реклама')).toBeInTheDocument();
    expect(screen.queryByText('Advertising')).toBeNull();
  });

  it('shows the stored name in English', () => {
    renderHeader();

    expect(screen.getByText('Advertising')).toBeInTheDocument();
  });
});
