import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { categoryItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { CustomTableColumn, CustomTableGridRow } from '../../utils/types';
import { EditableCell } from './EditableCell';
import { APP_NAME } from '@/app/lib/brand';

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));

vi.mock('@/app/lib/query-fn-schema', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/lib/query-fn-schema')>()),
  apiQueryDecoded: vi.fn(async () => [
    categoryItem({ id: 'cat-rent', name: 'Rent' }),
    categoryItem({ id: 'cat-travel', name: 'Travel' }),
    categoryItem({ id: 'cat-off', name: 'Archived', isEnabled: false }),
  ]),
}));

const labels = {
  yes: 'Yes',
  no: 'No',
  clear: 'Clear',
  edit: 'Edit',
  readOnlySource: 'Comes from the app',
};

const column = (partial: Partial<CustomTableColumn>): CustomTableColumn => ({
  id: 'c',
  key: 'c',
  title: 'Amount',
  type: 'number',
  position: 0,
  config: null,
  ...partial,
});

const row = (value: CustomTableGridRow['data'][string]): CustomTableGridRow => ({
  id: 'r1',
  rowNumber: 1,
  data: { c: value },
});

describe('EditableCell', () => {
  it('saves a parsed number on Enter and reverts on Escape', () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <EditableCell
        column={column({ type: 'number' })}
        row={row(10)}
        fallbackCurrency="KZT"
        missingRequired={false}
        onUpdate={onUpdate}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit: Amount' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '1 234,5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('r1', 'c', 1234.5);
  });

  it('toggles booleans without entering edit mode', () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <EditableCell
        column={column({ type: 'boolean', title: 'Paid' })}
        row={row(false)}
        fallbackCurrency="KZT"
        missingRequired={false}
        onUpdate={onUpdate}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paid' }));
    expect(onUpdate).toHaveBeenCalledWith('r1', 'c', true);
  });

  it('renders formulas read-only with the column format', () => {
    render(
      <EditableCell
        column={column({ type: 'formula', config: { precision: 1, format: 'percent' } })}
        row={row(12.5)}
        fallbackCurrency="KZT"
        missingRequired={false}
        onUpdate={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/12[.,]5/)).toBeInTheDocument();
  });

  it(`picks a currency code from the app drawer for ${APP_NAME} currency columns`, () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <EditableCell
        column={column({
          type: 'text',
          title: 'Currency',
          config: { source: { kind: 'app_field', field: 'currency' } },
        })}
        row={row('EUR')}
        fallbackCurrency="KZT"
        missingRequired={false}
        onUpdate={onUpdate}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit: Currency' }));
    expect(screen.queryByRole('textbox', { name: 'Currency' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /USD/ })[0]);
    expect(onUpdate).toHaveBeenCalledWith('r1', 'c', 'USD');
  });

  it('keeps free text for an ordinary column titled Currency', () => {
    render(
      <EditableCell
        column={column({ type: 'text', title: 'Currency' })}
        row={row('EUR')}
        fallbackCurrency="KZT"
        missingRequired={false}
        onUpdate={vi.fn()}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit: Currency' }));
    expect(screen.getByRole('textbox')).toHaveValue('EUR');
  });

  it(`picks a category from the app drawer for ${APP_NAME} category columns`, async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderWithQuery(
      <EditableCell
        column={column({
          type: 'text',
          title: 'Category',
          config: { source: { kind: 'app_field', field: 'category' } },
        })}
        row={row('Rent')}
        fallbackCurrency="KZT"
        missingRequired={false}
        onUpdate={onUpdate}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit: Category' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Travel' }));
    expect(onUpdate).toHaveBeenCalledWith('r1', 'c', 'Travel');
    expect(screen.queryByRole('button', { name: 'Archived' })).toBeNull();
  });

  describe('tables filled from app data', () => {
    const statement = column({
      type: 'text',
      title: 'Statement',
      config: { source: { kind: 'app_field', field: 'statement' } },
    });
    const purpose = column({
      type: 'text',
      title: 'Purpose',
      config: { source: { kind: 'app_field', field: 'purpose' } },
    });
    const sourced = (value: string) => ({ ...row(value), sourceKey: 'tx-1' });

    it('shows a field the app keeps itself as plain text, with a hint', () => {
      render(
        <EditableCell
          column={statement}
          row={sourced('a.csv')}
          fallbackCurrency="KZT"
          missingRequired={false}
          onUpdate={vi.fn()}
          labels={labels}
          sourceKind="transactions"
        />,
      );
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByTitle('Comes from the app')).toHaveTextContent('a.csv');
    });

    it('keeps a writable field editable', () => {
      render(
        <EditableCell
          column={purpose}
          row={sourced('Rent')}
          fallbackCurrency="KZT"
          missingRequired={false}
          onUpdate={vi.fn()}
          labels={labels}
          sourceKind="transactions"
        />,
      );
      expect(screen.getByRole('button', { name: 'Edit: Purpose' })).toBeInTheDocument();
    });

    it('lets a hand-added row edit even the read-only field: it is a plain table cell', () => {
      render(
        <EditableCell
          column={statement}
          row={{ ...row('note'), sourceKey: null }}
          fallbackCurrency="KZT"
          missingRequired={false}
          onUpdate={vi.fn()}
          labels={labels}
          sourceKind="transactions"
        />,
      );
      expect(screen.getByRole('button', { name: 'Edit: Statement' })).toBeInTheDocument();
    });

    it('judges the field by the table source: status is read-only for invoices only', () => {
      const status = column({
        type: 'text',
        title: 'Status',
        config: { source: { kind: 'app_field', field: 'status' } },
      });
      const { rerender } = render(
        <EditableCell
          column={status}
          row={sourced('draft')}
          fallbackCurrency="KZT"
          missingRequired={false}
          onUpdate={vi.fn()}
          labels={labels}
          sourceKind="invoices"
        />,
      );
      expect(screen.queryByRole('button')).toBeNull();
      rerender(
        <EditableCell
          column={status}
          row={sourced('active')}
          fallbackCurrency="KZT"
          missingRequired={false}
          onUpdate={vi.fn()}
          labels={labels}
          sourceKind="subscriptions"
        />,
      );
      expect(screen.getByRole('button', { name: 'Edit: Status' })).toBeInTheDocument();
    });
  });
});
