import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DataGrid } from './DataGrid';
import type { GridColumnDef } from './features';
import { selectionColumn } from './selection-column';
import { useDataGrid } from './use-data-grid';

interface Person {
  id: string;
  name: string;
  age: number;
}

const PEOPLE: Person[] = [
  { id: 'a', name: 'Zoe', age: 30 },
  { id: 'b', name: 'Adam', age: 41 },
  { id: 'c', name: 'Mia', age: 25 },
];

const columns: GridColumnDef<Person, unknown>[] = [
  selectionColumn<Person>({ selectAll: 'Select all', selectRow: 'Select row' }),
  { id: 'name', accessorFn: row => row.name, header: 'Name', sortFn: 'text' },
  { id: 'age', accessorFn: row => row.age, header: 'Age', sortFn: 'basic', meta: { align: 'end' } },
];

function Harness({
  data = PEOPLE,
  loading,
  skeletonRows,
}: {
  data?: Person[];
  loading?: boolean;
  skeletonRows?: number;
}) {
  const [selected, setSelected] = useState<Record<string, true>>({});
  const table = useDataGrid<Person>({
    data,
    columns,
    getRowId: row => row.id,
    state: { rowSelection: selected },
    onRowSelectionChange: updater =>
      setSelected(typeof updater === 'function' ? updater(selected) : updater),
    enableRowSelection: true,
  });
  return (
    <>
      <output data-testid="selected">{Object.keys(selected).join(',')}</output>
      <DataGrid
        table={table}
        caption="People"
        loading={loading}
        skeletonRows={skeletonRows}
        emptyState={<span>Nothing here</span>}
      />
    </>
  );
}

const bodyNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map(row => row.querySelectorAll('td')[1]?.textContent);

describe('DataGrid', () => {
  it('renders semantic headers with sort affordances', () => {
    render(<Harness />);
    const header = screen.getByRole('columnheader', { name: /name/i });
    expect(header).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
    expect(bodyNames()).toEqual(['Zoe', 'Adam', 'Mia']);
  });

  it('sorts client-side when a header is clicked', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(bodyNames()).toEqual(['Adam', 'Mia', 'Zoe']);
    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(bodyNames()).toEqual(['Zoe', 'Mia', 'Adam']);
  });

  it('reports controlled row selection through the checkbox column', () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('checkbox', { name: 'Select row' });
    fireEvent.click(boxes[1]);
    expect(screen.getByTestId('selected')).toHaveTextContent('b');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByTestId('selected').textContent?.split(',').sort()).toEqual(['a', 'b', 'c']);
  });

  it('draws the requested number of placeholder rows while the first page loads', () => {
    const { container } = render(<Harness data={[]} loading skeletonRows={6} />);
    const placeholders = container.querySelectorAll('.seneca-grid__skeleton-row');
    expect(placeholders).toHaveLength(6);
    expect(placeholders[0].querySelectorAll('td')).toHaveLength(columns.length);
    expect(container.querySelector('.seneca-grid__loading-row')).toBeNull();
    expect(screen.queryByText('Nothing here')).toBeNull();
  });

  it('keeps the spinner, not placeholders, while more rows load under existing ones', () => {
    const { container } = render(<Harness loading skeletonRows={6} />);
    expect(container.querySelectorAll('.seneca-grid__skeleton-row')).toHaveLength(0);
    expect(container.querySelector('.seneca-grid__loading-row')).not.toBeNull();
  });

  it('shows the empty state when there are no rows', () => {
    render(<Harness data={[]} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
