// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptLocationCaptureSection } from './ReceiptLocationCaptureSection';

const mocks = vi.hoisted(() => ({
  supported: true,
  choice: null as 'on' | 'off' | null,
  requestLocationAccess: vi.fn(),
  setReceiptLocationCapture: vi.fn(),
  promptOn: true,
  setReceiptPlacePrompt: vi.fn(),
  text: {
    toggleLabel: 'Save where receipts are photographed',
    toggleHelp: 'Only on this device and only for photos taken with the camera.',
    unsupported: 'Location is not available in this browser.',
    browserBlocked: 'Your browser blocks location for this site.',
    placePromptLabel: 'Ask for the shop when there was no GPS',
    placePromptHelp: 'Seneca asks which shop it was once GPS is back.',
  } as Record<string, string>,
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    Object.fromEntries(Object.entries(mocks.text).map(([key, value]) => [key, { value }])),
}));

vi.mock('@/app/lib/device-location', () => ({
  isDeviceLocationSupported: () => mocks.supported,
  requestLocationAccess: () => mocks.requestLocationAccess(),
}));

vi.mock('@/app/lib/receipt-location-capture', () => ({
  useReceiptLocationCapture: () => mocks.choice,
  setReceiptLocationCapture: (on: boolean) => mocks.setReceiptLocationCapture(on),
}));

vi.mock('@/app/lib/receipt-place-followup', () => ({
  useReceiptPlaceFollowups: () => ({ promptOn: mocks.promptOn, pending: [] }),
  setReceiptPlacePrompt: (on: boolean) => mocks.setReceiptPlacePrompt(on),
}));

const toggle = () => screen.getAllByRole('switch')[0] as HTMLInputElement;
const placeToggle = () =>
  screen.getByRole('switch', { name: /ask for the shop/i }) as HTMLInputElement;

describe('ReceiptLocationCaptureSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supported = true;
    mocks.choice = null;
    mocks.promptOn = true;
  });

  it('follows the capture switch with the shop question switch', () => {
    mocks.choice = 'off';
    const { rerender } = render(<ReceiptLocationCaptureSection />);

    expect(placeToggle().checked).toBe(false);
    expect(placeToggle().disabled).toBe(true);

    mocks.choice = 'on';
    rerender(<ReceiptLocationCaptureSection />);
    expect(placeToggle().checked).toBe(true);
    expect(placeToggle().disabled).toBe(false);
  });

  it('turns the shop question off and back on', () => {
    mocks.choice = 'on';
    render(<ReceiptLocationCaptureSection />);

    fireEvent.click(placeToggle());
    expect(mocks.setReceiptPlacePrompt).toHaveBeenCalledWith(false);
    expect(mocks.requestLocationAccess).not.toHaveBeenCalled();
  });

  it('shows the shop question as off after "don’t show again"', () => {
    mocks.choice = 'on';
    mocks.promptOn = false;
    render(<ReceiptLocationCaptureSection />);

    expect(placeToggle().checked).toBe(false);
    fireEvent.click(placeToggle());
    expect(mocks.setReceiptPlacePrompt).toHaveBeenCalledWith(true);
  });

  it('shows the current choice of this device', () => {
    mocks.choice = 'on';
    render(<ReceiptLocationCaptureSection />);

    expect(toggle().checked).toBe(true);
    expect(screen.getByText(/only on this device/i)).toBeTruthy();
  });

  it('asks the browser when turned on and keeps it on once granted', async () => {
    mocks.choice = 'off';
    mocks.requestLocationAccess.mockResolvedValue('granted');
    render(<ReceiptLocationCaptureSection />);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(mocks.requestLocationAccess).toHaveBeenCalledTimes(1);
    expect(mocks.setReceiptLocationCapture).toHaveBeenCalledWith(true);
  });

  it('stays off and explains when the browser blocks location', async () => {
    mocks.choice = 'off';
    mocks.requestLocationAccess.mockResolvedValue('denied');
    render(<ReceiptLocationCaptureSection />);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(mocks.setReceiptLocationCapture).toHaveBeenCalledWith(false);
    expect(screen.getByText(/browser blocks location/i)).toBeTruthy();
  });

  it('turns off without prompting', async () => {
    mocks.choice = 'on';
    render(<ReceiptLocationCaptureSection />);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(mocks.requestLocationAccess).not.toHaveBeenCalled();
    expect(mocks.setReceiptLocationCapture).toHaveBeenCalledWith(false);
  });

  it('is disabled where the browser cannot share location', () => {
    mocks.supported = false;
    mocks.choice = 'on';
    render(<ReceiptLocationCaptureSection />);

    expect(toggle().disabled).toBe(true);
    expect(toggle().checked).toBe(false);
    expect(screen.getByText(/not available in this browser/i)).toBeTruthy();
  });
});
