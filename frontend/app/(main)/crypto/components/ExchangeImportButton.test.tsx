import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExchangeImportButton } from './ExchangeImportButton';

const labels = {
  button: 'Import from an exchange',
  hint: 'A Coinbase, Binance or Kraken history export (CSV)',
  failed: 'Could not read the file',
  done: 'Rows imported',
};

function pick(file: File): void {
  const input = screen.getByTestId('exchange-csv-input') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

const csv = (): File => new File(['a,b\n1,2'], 'history.csv', { type: 'text/csv' });

describe('ExchangeImportButton', () => {
  it('reports what the import brought in', async () => {
    const onImport = vi.fn().mockResolvedValue({
      exchange: 'Kraken',
      imported: 12,
      skipped: 0,
      walletId: 'w-1',
    });

    render(<ExchangeImportButton importing={false} labels={labels} onImport={onImport} />);
    pick(csv());

    await waitFor(() => expect(screen.getByText(/Kraken/)).toBeInTheDocument());
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it('says the file was not understood rather than failing silently', async () => {
    render(
      <ExchangeImportButton
        importing={false}
        labels={labels}
        onImport={vi.fn().mockResolvedValue(null)}
      />,
    );
    pick(csv());

    await waitFor(() => expect(screen.getByText(labels.failed)).toBeInTheDocument());
  });

  it('lets the same file be chosen twice in a row', async () => {
    const onImport = vi.fn().mockResolvedValue(null);
    render(<ExchangeImportButton importing={false} labels={labels} onImport={onImport} />);

    pick(csv());
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    pick(csv());
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2));
  });
});
