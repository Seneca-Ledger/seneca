import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectOption } from '@/app/test/select';
import { ReceiptUploadModal } from './ReceiptUploadModal';

const uploadHookMocks = vi.hoisted(() => ({
  uploadReceipts: vi.fn(),
  uploading: false,
  progress: 0,
  error: null as string | null,
}));

vi.mock('./hooks/useReceiptUpload', () => ({
  useReceiptUpload: () => uploadHookMocks,
}));

describe('ReceiptUploadModal', () => {
  beforeEach(() => {
    uploadHookMocks.uploadReceipts.mockReset();
    uploadHookMocks.uploading = false;
    uploadHookMocks.progress = 0;
    uploadHookMocks.error = null;
  });

  it('renders upload UI when open', () => {
    render(<ReceiptUploadModal isOpen onClose={() => undefined} onUploaded={() => undefined} />);

    expect(screen.getByText('Upload receipts')).toBeInTheDocument();
    expect(screen.getByText('Drop receipt images or PDFs here')).toBeInTheDocument();
    expect(screen.getByLabelText('OCR language')).toBeInTheDocument();
  });

  it('rejects oversized files before upload', () => {
    render(<ReceiptUploadModal isOpen onClose={() => undefined} onUploaded={() => undefined} />);

    const input = screen.getByLabelText('Select receipt files') as HTMLInputElement;
    const file = new File(['large'], 'receipt.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('Each file must be 10 MB or smaller.')).toBeInTheDocument();
    expect(uploadHookMocks.uploadReceipts).not.toHaveBeenCalled();
  });

  it('submits selected files and chosen language', async () => {
    uploadHookMocks.uploadReceipts.mockResolvedValue({ receipts: [] });

    render(<ReceiptUploadModal isOpen onClose={() => undefined} onUploaded={() => undefined} />);

    const input = screen.getByLabelText('Select receipt files') as HTMLInputElement;
    const file = new File(['ok'], 'receipt.jpg', { type: 'image/jpeg' });

    fireEvent.change(input, { target: { files: [file] } });
    selectOption(screen.getByLabelText('OCR language'), 'German');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Upload 1 receipt' }));
      await Promise.resolve();
    });

    expect(uploadHookMocks.uploadReceipts).toHaveBeenCalledWith([file], 'deu');
  });

  it('shows upload progress while files are uploading', () => {
    uploadHookMocks.uploading = true;
    uploadHookMocks.progress = 65;

    render(<ReceiptUploadModal isOpen onClose={() => undefined} onUploaded={() => undefined} />);

    expect(screen.getByText('Uploading... 65%')).toBeInTheDocument();
  });
});
