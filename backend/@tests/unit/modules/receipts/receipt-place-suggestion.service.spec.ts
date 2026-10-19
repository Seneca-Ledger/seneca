import { Receipt, ReceiptLocationSource } from '@/entities/receipt.entity';
import type { GeocodingService, NearbyPlace } from '@/modules/geocoding/geocoding.service';
import { NEARBY_PLACE_TYPES } from '@/modules/geocoding/nearby-place-types';
import { ReceiptPlaceSuggestionService } from '@/modules/receipts/services/receipt-place-suggestion.service';
import { createRepoMock } from '../../../helpers/create-repo-mock';

// Monaco, next to the Fontvieille Carrefour.
const FIX = { latitude: 43.7308, longitude: 7.417, accuracy: 40 };

const place = (overrides: Partial<NearbyPlace>): NearbyPlace => ({
  name: 'Somewhere',
  category: 'shop',
  type: 'supermarket',
  address: null,
  locality: 'Monaco',
  lat: 43.7308,
  lng: 7.417,
  osmType: 'node',
  osmId: '1',
  ...overrides,
});

const buildReceipt = (overrides: Partial<Receipt> = {}): Receipt =>
  ({
    id: 'receipt-1',
    workspaceId: 'ws-1',
    statementId: 'statement-1',
    metadata: {},
    parsedData: { vendor: 'ООО Carrefour Monaco', amount: 12.5, currency: 'EUR', date: '2026-09-28' },
    locationSource: null,
    ...overrides,
  }) as Receipt;

describe('ReceiptPlaceSuggestionService', () => {
  let repository: ReturnType<typeof createRepoMock<Receipt>>;
  let searchNearby: jest.Mock;
  let service: ReceiptPlaceSuggestionService;

  beforeEach(() => {
    repository = createRepoMock<Receipt>();
    repository.findOne.mockResolvedValue(buildReceipt());
    searchNearby = jest.fn().mockResolvedValue([]);
    service = new ReceiptPlaceSuggestionService(
      repository as never,
      { searchNearby } as unknown as GeocodingService,
    );
  });

  it('looks the receipt up by statement inside the caller workspace', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.suggest('statement-1', 'ws-other', FIX)).resolves.toBeNull();
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { statementId: 'statement-1', workspaceId: 'ws-other' },
      order: { createdAt: 'DESC' },
    });
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it.each([
    ReceiptLocationSource.MERCHANT_ADDRESS,
    ReceiptLocationSource.MANUAL,
    ReceiptLocationSource.PLACE,
  ])('does not ask when the location is already %s', async (locationSource) => {
    repository.findOne.mockResolvedValue(buildReceipt({ locationSource }));

    await expect(service.suggest('statement-1', 'ws-1', FIX)).resolves.toEqual({ needed: false });
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it('asks when only a rough device point exists', async () => {
    repository.findOne.mockResolvedValue(
      buildReceipt({ locationSource: ReceiptLocationSource.DEVICE }),
    );

    await expect(service.suggest('statement-1', 'ws-1', FIX)).resolves.toMatchObject({
      needed: true,
      receiptId: 'receipt-1',
      vendor: 'ООО Carrefour Monaco',
      amount: 12.5,
      currency: 'EUR',
      date: '2026-09-28',
    });
  });

  it('reports fields OCR left empty as missing', async () => {
    repository.findOne.mockResolvedValue(
      buildReceipt({ parsedData: { vendor: '  ', currency: '', date: '' } }),
    );

    await expect(service.suggest('statement-1', 'ws-1', FIX)).resolves.toMatchObject({
      vendor: null,
      amount: null,
      currency: null,
      date: null,
    });
  });

  it('searches by vendor name and by every kind of place around the fix', async () => {
    await service.suggest('statement-1', 'ws-1', FIX);

    const searches = searchNearby.mock.calls.map(([search]) => search);
    expect(searches).toHaveLength(NEARBY_PLACE_TYPES.length + 1);
    expect(searches[0]).toEqual({
      lat: 43.7308,
      lng: 7.417,
      radiusM: 150 + 80,
      name: 'ООО Carrefour Monaco',
    });
    expect(searches.slice(1).map((search) => search.placeType)).toEqual([...NEARBY_PLACE_TYPES]);
  });

  it('skips the name search when OCR found no vendor', async () => {
    repository.findOne.mockResolvedValue(buildReceipt({ parsedData: {} }));

    await service.suggest('statement-1', 'ws-1', FIX);

    expect(searchNearby).toHaveBeenCalledTimes(NEARBY_PLACE_TYPES.length);
    expect(searchNearby.mock.calls.every(([search]) => search.name === undefined)).toBe(true);
  });

  it.each([
    [undefined, 250],
    [10, 150],
    [200, 300],
    [5000, 500],
  ])('sizes the search from accuracy %s to a %s m radius', async (accuracy, radiusM) => {
    await service.suggest('statement-1', 'ws-1', { ...FIX, accuracy });

    expect(searchNearby.mock.calls[0][0].radiusM).toBe(radiusM + 80);
  });

  it('puts the vendor match first, then the nearest, without duplicates or far places', async () => {
    const carrefour = place({
      name: 'Carrefour',
      lat: 43.7318, // ~110 m north
      osmId: '274497719',
    });
    const cafe = place({ name: 'Giudi’s', category: 'amenity', type: 'cafe', osmId: '2' });
    const pharmacy = place({ name: 'Pharmacie Plati', lat: 43.7312, osmId: '3' });
    const tooFar = place({ name: 'Far away', lat: 43.7338, osmId: '4' }); // ~330 m
    searchNearby.mockImplementation(async (search: { name?: string; placeType?: string }) => {
      if (search.name) return [carrefour];
      if (search.placeType === 'supermarket') return [carrefour, tooFar];
      if (search.placeType === 'cafe') return [cafe];
      if (search.placeType === 'pharmacy') return [pharmacy];
      return [];
    });

    const result = await service.suggest('statement-1', 'ws-1', FIX);

    if (!result?.needed) throw new Error('expected suggestions');
    expect(result.candidates.map((candidate) => candidate.name)).toEqual([
      'Carrefour',
      'Giudi’s',
      'Pharmacie Plati',
    ]);
    expect(result.candidates[0]).toMatchObject({ matchesVendor: true, distanceM: 111 });
    expect(result.candidates[1]).toMatchObject({ matchesVendor: false, distanceM: 0 });
  });

  it('matches names regardless of accents and legal forms', async () => {
    repository.findOne.mockResolvedValue(
      buildReceipt({ parsedData: { vendor: 'SARL Boulangerie Émile' } }),
    );
    searchNearby.mockImplementation(async (search: { placeType?: string }) =>
      search.placeType === 'bakery'
        ? [
            place({ name: 'Sarl Paul', osmId: '1' }),
            place({ name: 'Chez Emile', osmId: '2', lat: 43.731 }),
          ]
        : [],
    );

    const result = await service.suggest('statement-1', 'ws-1', FIX);

    if (!result?.needed) throw new Error('expected suggestions');
    expect(result.candidates.map((candidate) => [candidate.name, candidate.matchesVendor])).toEqual([
      ['Chez Emile', true],
      ['Sarl Paul', false],
    ]);
  });

  it('does not count the town in the vendor name as a match', async () => {
    searchNearby.mockImplementation(async (search: { placeType?: string }) =>
      search.placeType === 'sports'
        ? [place({ name: 'AS Monaco Football Store', osmId: '9' })]
        : [],
    );

    const result = await service.suggest('statement-1', 'ws-1', FIX);

    if (!result?.needed) throw new Error('expected suggestions');
    expect(result.candidates[0]).toMatchObject({ name: 'AS Monaco Football Store', matchesVendor: false });
  });

  it('returns at most eight candidates', async () => {
    searchNearby.mockImplementation(async (search: { placeType?: string }) =>
      search.placeType
        ? [place({ name: `Shop ${search.placeType}`, osmId: search.placeType })]
        : [],
    );

    const result = await service.suggest('statement-1', 'ws-1', FIX);

    if (!result?.needed) throw new Error('expected suggestions');
    expect(result.candidates).toHaveLength(8);
  });
});
