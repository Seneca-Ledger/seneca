// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptLocationConsent } from './ReceiptLocationConsent';

const mocks = vi.hoisted(() => ({
  requestLocationAccess: vi.fn(),
  setReceiptLocationCapture: vi.fn(),
  text: {
    title: 'Save where receipts are photographed?',
    body: 'Seneca will save the place…',
    privacy: 'The place is stored only with the receipt…',
    allow: 'Allow',
    notNow: 'Not now',
    requesting: 'Waiting for your browser…',
    grantedTitle: 'Location is on',
    grantedBody: 'Receipts you photograph will be placed on the map automatically.',
    deniedTitle: 'Location access is blocked',
    deniedBody: 'Receipts will be saved without the place they were photographed.',
    openCamera: 'Open camera',
  } as Record<string, string>,
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    // Shared UI primitives (Spinner, ModalShell) read these from the same mock.
    loading: { value: 'Loading' },
    closeModal: { value: 'Close modal' },
    closeDrawer: { value: 'Close drawer' },
    ...Object.fromEntries(Object.entries(mocks.text).map(([key, value]) => [key, { value }])),
  }),
}));

vi.mock('@/app/lib/device-location', () => ({
  requestLocationAccess: () => mocks.requestLocationAccess(),
}));

vi.mock('@/app/lib/receipt-location-capture', () => ({
  setReceiptLocationCapture: (on: boolean) => mocks.setReceiptLocationCapture(on),
}));

describe('ReceiptLocationConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains what is saved before asking', () => {
    render(<ReceiptLocationConsent onOpenCamera={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'Save where receipts are photographed?' }),
    ).toBeTruthy();
    expect(screen.getByText(/stored only with the receipt/)).toBeTruthy();
    expect(mocks.requestLocationAccess).not.toHaveBeenCalled();
  });

  it('declines without prompting and opens the camera straight away', () => {
    const onOpenCamera = vi.fn();
    render(<ReceiptLocationConsent onOpenCamera={onOpenCamera} />);

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(mocks.setReceiptLocationCapture).toHaveBeenCalledWith(false);
    expect(mocks.requestLocationAccess).not.toHaveBeenCalled();
    expect(onOpenCamera).toHaveBeenCalledTimes(1);
  });

  it('turns capture on when the browser grants access', async () => {
    let answer: (value: string) => void = () => undefined;
    mocks.requestLocationAccess.mockReturnValue(
      new Promise(resolve => {
        answer = resolve;
      }),
    );
    const onOpenCamera = vi.fn();
    render(<ReceiptLocationConsent onOpenCamera={onOpenCamera} />);

    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(screen.getByText('Waiting for your browser…')).toBeTruthy();

    await act(async () => {
      answer('granted');
    });

    expect(mocks.setReceiptLocationCapture).toHaveBeenCalledWith(true);
    expect(screen.getByRole('heading', { name: 'Location is on' })).toBeTruthy();
    expect(onOpenCamera).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open camera' }));
    expect(onOpenCamera).toHaveBeenCalledTimes(1);
  });

  it('keeps capture on when the browser merely has no fix', async () => {
    mocks.requestLocationAccess.mockResolvedValue('unavailable');
    render(<ReceiptLocationConsent onOpenCamera={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    });

    expect(mocks.setReceiptLocationCapture).toHaveBeenCalledWith(true);
  });

  it('turns capture off and explains how to enable it when access is refused', async () => {
    mocks.requestLocationAccess.mockResolvedValue('denied');
    render(<ReceiptLocationConsent onOpenCamera={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    });

    expect(mocks.setReceiptLocationCapture).toHaveBeenCalledWith(false);
    expect(screen.getByRole('heading', { name: 'Location access is blocked' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open camera' })).toBeTruthy();
  });
});
