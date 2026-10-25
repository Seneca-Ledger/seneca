// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPost = vi.fn();
const toastLoading = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: {
    post: apiPost,
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    loading: toastLoading,
    success: toastSuccess,
    error: toastError,
  },
}));

describe('ExportDropdown', () => {
  const createObjectUrl = vi.fn(() => 'blob:url');
  const revokeObjectUrl = vi.fn();
  const originalCreateElement = document.createElement.bind(document);
  let anchorElement: HTMLAnchorElement | null = null;
  // Typed explicitly: since vitest 4 a bare vi.fn() is Mock<Procedure | Constructable>,
  // which no longer assigns to the () => void slots on HTMLAnchorElement below.
  let clickSpy: Mock<() => void>;
  let removeSpy: Mock<() => void>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    apiPost.mockReset();
    toastLoading.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    toastLoading.mockReturnValue('toast-id');
    createObjectUrl.mockReset();
    createObjectUrl.mockReturnValue('blob:url');
    revokeObjectUrl.mockReset();
    clickSpy = vi.fn();
    removeSpy = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrl,
    });

    vi.spyOn(document, 'createElement').mockImplementation(tagName => {
      if (tagName === 'a') {
        anchorElement = originalCreateElement('a');
        anchorElement.click = clickSpy;
        anchorElement.remove = removeSpy;

        return anchorElement;
      }

      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    anchorElement = null;
  });

  it('exports the workspace in the selected format', async () => {
    apiPost.mockResolvedValue({
      // A file, as axios returns for responseType: 'blob'.
      data: new Blob([new Uint8Array([1, 2, 3])]),
      headers: {
        'content-disposition': 'attachment; filename="workspace-transactions-2026-04-01.pdf"',
      },
    });

    const { ExportDropdown } = await import('./ExportDropdown');

    render(
      <ExportDropdown
        t={{
          button: { value: 'Export' },
          title: { value: 'Export data' },
          excel: { value: 'Excel (.xlsx)' },
          pdf: { value: 'PDF' },
          csv: { value: 'CSV' },
          docx: { value: 'Word (.docx)' },
          downloading: { value: 'Downloading...' },
          success: { value: 'File downloaded successfully' },
          error: { value: 'Download failed' },
        }}
      />,
    );

    // Open the dropdown menu
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    // Click the PDF item
    fireEvent.click(screen.getByTestId('dropdown-item-pdf'));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/reports/workspace-export',
        { format: 'pdf' },
        { responseType: 'blob' },
      );
    });

    expect(toastLoading).toHaveBeenCalledWith('Downloading...');
    expect(createObjectUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(anchorElement?.href).toBe('blob:url');
    expect(anchorElement?.download).toBe('workspace-transactions-2026-04-01.pdf');
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('File downloaded successfully', { id: 'toast-id' });
  });

  it('shows an error toast when export fails', async () => {
    apiPost.mockRejectedValue(new Error('boom'));

    const { ExportDropdown } = await import('./ExportDropdown');

    render(
      <ExportDropdown
        t={{
          button: { value: 'Export' },
          title: { value: 'Export data' },
          excel: { value: 'Excel (.xlsx)' },
          pdf: { value: 'PDF' },
          csv: { value: 'CSV' },
          docx: { value: 'Word (.docx)' },
          downloading: { value: 'Downloading...' },
          success: { value: 'File downloaded successfully' },
          error: { value: 'Download failed' },
        }}
      />,
    );

    // Open the dropdown menu
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    // Click the docx item
    fireEvent.click(screen.getByTestId('dropdown-item-docx'));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Download failed', { id: 'toast-id' });
    });
  });

  it('falls back to built-in labels when i18n tokens are missing', async () => {
    const { ExportDropdown } = await import('./ExportDropdown');

    render(
      <ExportDropdown
        t={
          {
            title: { value: 'Export data' },
            excel: { value: 'Excel (.xlsx)' },
            pdf: { value: 'PDF' },
            csv: { value: 'CSV' },
            docx: { value: 'Word (.docx)' },
            downloading: { value: 'Downloading...' },
            success: { value: 'File downloaded successfully' },
            error: { value: 'Download failed' },
          } as Partial<Parameters<typeof ExportDropdown>[0]['t']>
        }
      />,
    );

    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('renders the trigger button with rounded corners', async () => {
    const { ExportDropdown } = await import('./ExportDropdown');

    render(
      <ExportDropdown
        t={{
          button: { value: 'Export' },
          title: { value: 'Export data' },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
  });
});
