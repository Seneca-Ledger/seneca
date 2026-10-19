// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReceiptRecord } from '@/app/lib/api';
import { ReceiptLocationSection } from './ReceiptLocationSection';

const mocks = vi.hoisted(() => ({
  updateReceiptLocation: vi.fn(),
  resetReceiptLocation: vi.fn(),
  setPreference: vi.fn(),
  stylesQuery: {
    isPending: false,
    isError: false,
    data: {
      styles: [
        { id: 'osm-bright', name: 'OSM Bright' },
        { id: 'dark-matter', name: 'Dark Matter' },
      ],
      defaultStyleId: 'osm-bright',
    } as { styles: Array<{ id: string; name: string }>; defaultStyleId: string | null } | undefined,
  },
  toastError: vi.fn(),
}));

const i18nMocks = vi.hoisted(() => ({
  en: {
    title: 'Location',
    sourceMerchantAddress: 'From merchant address',
    sourceExif: 'From photo',
    sourceDevice: 'From device',
    sourceManual: 'Set manually',
    sourceFiscalQr: 'From tax receipt',
    sourcePlace: 'Picked shop',
    unsavedPoint: 'Unsaved point',
    noLocation: 'No location yet',
    cancel: 'Cancel',
    saveLocation: 'Save location',
    resetToAutomatic: 'Reset to automatic',
    mapUnavailable: 'Map is unavailable right now',
    tilesNotConfigured: 'Map tiles are not configured',
    moveHint: 'Drag the pin or click the map to move it.',
    placeHint: 'Click the map to place the point where this purchase was made.',
    saveFailed: 'Failed to save location',
    resetFailed: 'Failed to reset location',
    mapStyle: 'Map style',
    styleSaveFailed: 'Failed to save map style',
  } as Record<string, string>,
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    // Shared UI primitives (Spinner, ModalShell) read these from the same mock.
    loading: { value: 'Loading' },
    closeModal: { value: 'Close modal' },
    closeDrawer: { value: 'Close drawer' },
    ...Object.fromEntries(Object.entries(i18nMocks.en).map(([key, value]) => [key, { value }])),
  }),
}));

vi.mock('@/app/lib/api', () => ({
  apiBaseUrl: '/api/v1',
  receiptsApi: {
    updateReceiptLocation: mocks.updateReceiptLocation,
    resetReceiptLocation: mocks.resetReceiptLocation,
  },
}));

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));

vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError, success: vi.fn() } }));

vi.mock('./useMapStyles', () => ({ useMapStyles: () => mocks.stylesQuery }));

vi.mock('./useMapStylePreference', () => ({
  useMapStylePreference: () => ({ preference: null, setPreference: mocks.setPreference }),
}));

vi.mock('./LazyReceiptLocationMap', () => ({
  LazyReceiptLocationMap: ({
    position,
    styleId,
    onPick,
  }: {
    position: [number, number] | null;
    styleId: string;
    onPick: (point: [number, number]) => void;
  }) => (
    <div data-testid="map" data-style={styleId} data-position={position?.join(',') ?? ''}>
      <button type="button" onClick={() => onPick([43.2383, 76.9453])}>
        pick
      </button>
    </div>
  ),
}));

const baseReceipt = {
  id: 'receipt-1',
  subject: 'scan.jpg',
  sender: 'camera-scan',
  source: 'scan',
  status: 'draft',
  receivedAt: '2026-09-13T10:00:00Z',
  parsedData: { vendor: 'Magnum' },
  locationLat: null,
  locationLng: null,
  locationSource: null,
} as ReceiptRecord;

describe('ReceiptLocationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stylesQuery.isPending = false;
    mocks.stylesQuery.isError = false;
    mocks.stylesQuery.data = {
      styles: [
        { id: 'osm-bright', name: 'OSM Bright' },
        { id: 'dark-matter', name: 'Dark Matter' },
      ],
      defaultStyleId: 'osm-bright',
    };
  });

  it('invites the user to place a point when the receipt has none', () => {
    render(<ReceiptLocationSection receipt={baseReceipt} onReceiptChange={vi.fn()} />);

    expect(screen.getByText('No location yet')).toBeTruthy();
    expect(screen.getByText(/click the map to place the point/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Location' })).toBeTruthy();
    expect(screen.getByTestId('map').getAttribute('data-position')).toBe('');
  });

  it('shows where the point came from and the printed store address', () => {
    render(
      <ReceiptLocationSection
        receipt={{
          ...baseReceipt,
          parsedData: { merchantAddress: 'г. Алматы, ул. Абая 10' },
          locationLat: 43.2383,
          locationLng: 76.9453,
          locationSource: 'merchant_address',
        }}
        onReceiptChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/From merchant address · г\. Алматы, ул\. Абая 10/)).toBeTruthy();
    expect(screen.getByTestId('map').getAttribute('data-position')).toBe('43.2383,76.9453');
    expect(screen.queryByRole('button', { name: /reset to automatic/i })).toBeNull();
  });

  it('saves a picked point and hands the updated receipt back', async () => {
    const onReceiptChange = vi.fn();
    mocks.updateReceiptLocation.mockResolvedValue({
      id: 'receipt-1',
      locationLat: 43.2383,
      locationLng: 76.9453,
      locationSource: 'manual',
    });
    render(<ReceiptLocationSection receipt={baseReceipt} onReceiptChange={onReceiptChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick' }));
    expect(screen.getByText('Unsaved point')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /save location/i }));

    await waitFor(() =>
      expect(onReceiptChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'receipt-1', locationSource: 'manual', subject: 'scan.jpg' }),
      ),
    );
    expect(mocks.updateReceiptLocation).toHaveBeenCalledWith('receipt-1', {
      latitude: 43.2383,
      longitude: 76.9453,
    });
  });

  it('discards a picked point on cancel', () => {
    render(<ReceiptLocationSection receipt={baseReceipt} onReceiptChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByText('No location yet')).toBeTruthy();
    expect(mocks.updateReceiptLocation).not.toHaveBeenCalled();
  });

  it('keeps the draft and reports the error when saving fails', async () => {
    // No server message to show, so the localized fallback is what the user sees.
    mocks.updateReceiptLocation.mockRejectedValue({ code: 'ERR_NETWORK' });
    render(<ReceiptLocationSection receipt={baseReceipt} onReceiptChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick' }));
    fireEvent.click(screen.getByRole('button', { name: /save location/i }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Failed to save location'));
    expect(screen.getByText('Unsaved point')).toBeTruthy();
  });

  it('offers a reset only for a manual point', async () => {
    const onReceiptChange = vi.fn();
    mocks.resetReceiptLocation.mockResolvedValue({ id: 'receipt-1', locationSource: 'device' });
    render(
      <ReceiptLocationSection
        receipt={{
          ...baseReceipt,
          locationLat: 1,
          locationLng: 2,
          locationSource: 'manual',
        }}
        onReceiptChange={onReceiptChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /reset to automatic/i }));

    await waitFor(() => expect(mocks.resetReceiptLocation).toHaveBeenCalledWith('receipt-1'));
    expect(onReceiptChange).toHaveBeenCalledWith(
      expect.objectContaining({ locationSource: 'device' }),
    );
  });

  it('names a picked shop and lets the user undo it', async () => {
    mocks.resetReceiptLocation.mockResolvedValue({ id: 'receipt-1', locationSource: null });
    render(
      <ReceiptLocationSection
        receipt={{
          ...baseReceipt,
          parsedData: { merchantAddress: 'printed address' },
          metadata: {
            place: { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' },
          },
          locationLat: 43.7308,
          locationLng: 7.417,
          locationSource: 'place',
        }}
        onReceiptChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Picked shop · Carrefour')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reset to automatic/i }));

    await waitFor(() => expect(mocks.resetReceiptLocation).toHaveBeenCalledWith('receipt-1'));
  });

  it('switches the map style in one click', () => {
    render(<ReceiptLocationSection receipt={baseReceipt} onReceiptChange={vi.fn()} />);

    const darkButton = screen.getByRole('button', { name: 'Dark Matter' });
    expect(darkButton.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(darkButton);

    expect(mocks.setPreference).toHaveBeenCalledWith('dark-matter');
  });

  it('explains that maps are off when no tile server is configured', () => {
    mocks.stylesQuery.data = { styles: [], defaultStyleId: null };
    render(
      <ReceiptLocationSection
        receipt={{ ...baseReceipt, locationLat: 43.2383, locationLng: 76.9453, locationSource: 'device' }}
        onReceiptChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Map tiles are not configured')).toBeTruthy();
    expect(screen.getAllByText(/43\.23830, 76\.94530/).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('map')).toBeNull();
  });
});
