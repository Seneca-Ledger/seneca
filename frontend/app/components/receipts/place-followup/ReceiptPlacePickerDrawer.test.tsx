// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaceCandidate } from '@/app/lib/api';
import { ReceiptPlacePickerDrawer } from './ReceiptPlacePickerDrawer';
import type { PlaceQuestion } from './useReceiptPlaceFollowup';

const mocks = vi.hoisted(() => ({
  updateReceiptLocation: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  styles: {
    isPending: false,
    data: { styles: [{ id: 'osm-bright', name: 'OSM Bright' }], defaultStyleId: 'osm-bright' } as
      | { styles: Array<{ id: string; name: string }>; defaultStyleId: string | null }
      | undefined,
  },
}));

const labels: Record<string, string> = {
  drawerTitle: 'Which shop was it?',
  drawerHint: 'Places near where your phone found GPS again after the photo.',
  placesNearby: 'Places nearby',
  matchesReceipt: 'Matches the receipt',
  metres: 'm',
  save: 'Save',
  notInList: 'Not in the list — set it on the map',
  saved: 'Shop saved',
  saveFailed: 'Could not save the shop',
};

// Shared UI (DrawerShell, Spinner) reads its own labels through the same hook.
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key: string) => ({ value: labels[key] ?? key }) }),
}));
vi.mock('@/app/lib/api', () => ({
  receiptsApi: { updateReceiptLocation: mocks.updateReceiptLocation },
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, onClick }: { href: string; children: ReactNode; onClick: () => void }) => (
    <a
      href={href}
      onClick={event => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock('@/app/components/receipts/location/useMapStyles', () => ({
  useMapStyles: () => mocks.styles,
}));
vi.mock('@/app/components/receipts/location/useMapStylePreference', () => ({
  useMapStylePreference: () => ({ preference: null, setPreference: vi.fn() }),
}));
vi.mock('@/app/components/receipts/location/LazyReceiptLocationMap', () => ({
  LazyReceiptLocationMap: ({ position }: { position: [number, number] }) => (
    <div data-testid="map" data-position={position.join(',')} />
  ),
}));

const candidate = (overrides: Partial<PlaceCandidate>): PlaceCandidate => ({
  name: 'Somewhere',
  category: 'shop',
  type: 'supermarket',
  address: null,
  locality: null,
  lat: 43.73,
  lng: 7.417,
  osmType: 'node',
  osmId: '1',
  distanceM: 10,
  matchesVendor: false,
  ...overrides,
});

const question: PlaceQuestion = {
  statementId: 'statement-1',
  suggestions: {
    needed: true,
    receiptId: 'receipt-1',
    vendor: 'Carrefour',
    amount: 12.5,
    currency: 'EUR',
    date: null,
    candidates: [
      candidate({
        name: 'Carrefour',
        address: 'Avenue Albert II',
        locality: 'Monaco',
        lat: 43.7308,
        lng: 7.41697,
        osmId: '274497719',
        distanceM: 31,
        matchesVendor: true,
      }),
      candidate({ name: 'Le kiosque', category: 'amenity', type: 'cafe', osmId: '2', distanceM: 48 }),
    ],
  },
};

const renderDrawer = (props: Partial<Parameters<typeof ReceiptPlacePickerDrawer>[0]> = {}) => {
  const handlers = { onClose: vi.fn(), onSaved: vi.fn() };
  render(
    <ReceiptPlacePickerDrawer
      open
      question={question}
      summary="Carrefour · €12.50"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('ReceiptPlacePickerDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.styles.data = {
      styles: [{ id: 'osm-bright', name: 'OSM Bright' }],
      defaultStyleId: 'osm-bright',
    };
  });

  it('lists the places with distances, the vendor match first and selected', () => {
    renderDrawer();

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(2);
    expect(options[0]?.textContent).toContain('Carrefour');
    expect(options[0]?.textContent).toContain('Avenue Albert II, Monaco');
    expect(options[0]?.textContent).toContain('Matches the receipt');
    expect(options[0]?.textContent).toContain('31 m');
    expect(options[0]?.getAttribute('aria-checked')).toBe('true');
    expect(options[1]?.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('map').getAttribute('data-position')).toBe('43.7308,7.41697');
  });

  it('saves the chosen place with its OSM identity', async () => {
    mocks.updateReceiptLocation.mockResolvedValue({ id: 'receipt-1' });
    const { onSaved } = renderDrawer();

    fireEvent.click(screen.getByRole('radio', { name: /Le kiosque/ }));
    expect(screen.getByTestId('map').getAttribute('data-position')).toBe('43.73,7.417');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.updateReceiptLocation).toHaveBeenCalledWith('receipt-1', {
      latitude: 43.73,
      longitude: 7.417,
      place: { name: 'Le kiosque', category: 'amenity', osmType: 'node', osmId: '2' },
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Shop saved');
  });

  it('stays open and reports a failed save', async () => {
    mocks.updateReceiptLocation.mockRejectedValue({ code: 'ERR_NETWORK' });
    const { onSaved } = renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Could not save the shop'));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('links to the receipt to set the point by hand', () => {
    const { onClose } = renderDrawer();

    const link = screen.getByRole('link', { name: /not in the list/i });
    expect(link.getAttribute('href')).toBe('/storage/receipts/receipt-1');
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  it('still offers the list when map tiles are not configured', () => {
    mocks.styles.data = { styles: [], defaultStyleId: null };
    renderDrawer();

    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });
});
