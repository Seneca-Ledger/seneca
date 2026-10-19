import { Receipt, ReceiptLocationSource } from '@/entities/receipt.entity';
import type { GeocodingService } from '@/modules/geocoding/geocoding.service';
import { ReceiptLocationService } from '@/modules/receipts/services/receipt-location.service';
import { createRepoMock } from '../../../helpers/create-repo-mock';

const buildReceipt = (overrides: Partial<Receipt> = {}): Receipt =>
  ({
    id: 'receipt-1',
    workspaceId: 'ws-1',
    metadata: {},
    parsedData: {},
    locationLat: null,
    locationLng: null,
    locationSource: null,
    locationAccuracyM: null,
    locationUpdatedAt: null,
    ...overrides,
  }) as Receipt;

describe('ReceiptLocationService', () => {
  let repository: ReturnType<typeof createRepoMock<Receipt>>;
  let geocode: jest.Mock;
  let service: ReceiptLocationService;
  let auditService: { createEvent: jest.Mock };

  beforeEach(() => {
    repository = createRepoMock<Receipt>();
    repository.save.mockImplementation(async (receipt: Receipt) => receipt);
    geocode = jest.fn().mockResolvedValue(null);
    auditService = { createEvent: jest.fn().mockResolvedValue({}) };
    service = new ReceiptLocationService(
      repository as never,
      { geocode } as unknown as GeocodingService,
      auditService as never,
    );
  });

  describe('applyAutoLocation', () => {
    it('never moves a point the user placed', async () => {
      geocode.mockResolvedValue({ lat: 43.2383, lng: 76.9453 });
      const updatedAt = new Date('2026-09-01T00:00:00Z');
      const receipt = buildReceipt({
        parsedData: { merchantAddress: 'г. Алматы, ул. Абая 10' },
        locationLat: 51.1,
        locationLng: 71.4,
        locationSource: ReceiptLocationSource.MANUAL,
        locationUpdatedAt: updatedAt,
      });

      await service.applyAutoLocation(receipt);

      expect(geocode).not.toHaveBeenCalled();
      expect(receipt).toMatchObject({
        locationLat: 51.1,
        locationLng: 71.4,
        locationSource: ReceiptLocationSource.MANUAL,
        locationUpdatedAt: updatedAt,
      });
    });

    it('never moves a shop the user picked', async () => {
      geocode.mockResolvedValue({ lat: 43.2383, lng: 76.9453 });
      const receipt = buildReceipt({
        parsedData: { merchantAddress: 'г. Алматы, ул. Абая 10' },
        metadata: { place: { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' } },
        locationLat: 43.7308,
        locationLng: 7.417,
        locationSource: ReceiptLocationSource.PLACE,
      });

      await service.applyAutoLocation(receipt);

      expect(geocode).not.toHaveBeenCalled();
      expect(receipt).toMatchObject({
        locationLat: 43.7308,
        locationSource: ReceiptLocationSource.PLACE,
      });
    });

    it('prefers the geocoded merchant address over the capture point', async () => {
      geocode.mockResolvedValue({ lat: 43.2383, lng: 76.9453 });
      const receipt = buildReceipt({
        parsedData: { merchantAddress: 'г. Алматы, ул. Абая 10' },
        metadata: {
          captureLocation: {
            lat: 43.3,
            lng: 76.8,
            accuracyM: 20,
            source: 'device',
            capturedAt: '2026-09-13T10:00:00Z',
          },
        },
      });

      await service.applyAutoLocation(receipt);

      expect(geocode).toHaveBeenCalledWith('г. Алматы, ул. Абая 10');
      expect(receipt).toMatchObject({
        locationLat: 43.2383,
        locationLng: 76.9453,
        locationSource: ReceiptLocationSource.MERCHANT_ADDRESS,
        locationAccuracyM: null,
      });
      expect(receipt.locationUpdatedAt).toBeInstanceOf(Date);
    });

    it('falls back to the photo GPS when the address does not geocode', async () => {
      const receipt = buildReceipt({
        parsedData: { merchantAddress: 'somewhere 1' },
        metadata: {
          captureLocation: { lat: 43.3, lng: 76.8, source: 'exif', capturedAt: '2026-09-13' },
        },
      });

      await service.applyAutoLocation(receipt);

      expect(receipt).toMatchObject({
        locationLat: 43.3,
        locationLng: 76.8,
        locationSource: ReceiptLocationSource.EXIF,
        locationAccuracyM: null,
      });
    });

    it('uses the device point with its accuracy when nothing better exists', async () => {
      const receipt = buildReceipt({
        metadata: {
          captureLocation: {
            lat: 43.3,
            lng: 76.8,
            accuracyM: 35,
            source: 'device',
            capturedAt: '2026-09-13',
          },
        },
      });

      await service.applyAutoLocation(receipt);

      expect(geocode).not.toHaveBeenCalled();
      expect(receipt).toMatchObject({
        locationSource: ReceiptLocationSource.DEVICE,
        locationAccuracyM: 35,
      });
    });

    it('clears a stale automatic point when no source is left', async () => {
      const receipt = buildReceipt({
        locationLat: 43.3,
        locationLng: 76.8,
        locationSource: ReceiptLocationSource.DEVICE,
        locationAccuracyM: 35,
      });

      await service.applyAutoLocation(receipt);

      expect(receipt).toMatchObject({
        locationLat: null,
        locationLng: null,
        locationSource: null,
        locationAccuracyM: null,
      });
      expect(receipt.locationUpdatedAt).toBeInstanceOf(Date);
    });

    it('keeps the timestamp when the point did not change', async () => {
      geocode.mockResolvedValue({ lat: 43.2383, lng: 76.9453 });
      const updatedAt = new Date('2026-09-01T00:00:00Z');
      const receipt = buildReceipt({
        parsedData: { merchantAddress: 'г. Алматы, ул. Абая 10' },
        locationLat: 43.2383,
        locationLng: 76.9453,
        locationSource: ReceiptLocationSource.MERCHANT_ADDRESS,
        locationUpdatedAt: updatedAt,
      });

      await service.applyAutoLocation(receipt);

      expect(receipt.locationUpdatedAt).toBe(updatedAt);
    });
  });

  describe('setManual', () => {
    it('pins a rounded point inside the caller workspace', async () => {
      repository.findOne.mockResolvedValue(buildReceipt());

      const saved = await service.setManual(
        'receipt-1',
        'ws-1',
        { latitude: 43.238312345, longitude: 76.945398765 },
        'user-1',
      );

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'receipt-1', workspaceId: 'ws-1' },
      });
      expect(saved).toMatchObject({
        locationLat: 43.23831,
        locationLng: 76.9454,
        locationSource: ReceiptLocationSource.MANUAL,
        locationAccuracyM: null,
      });
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('stores a picked shop as a place with its OSM identity', async () => {
      repository.findOne.mockResolvedValue(
        buildReceipt({ metadata: { snippet: 'kept' } }),
      );

      const saved = await service.setManual('receipt-1', 'ws-1', {
        latitude: 43.730797,
        longitude: 7.416968,
        place: { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' },
      }, 'user-1');

      expect(saved).toMatchObject({
        locationLat: 43.7308,
        locationLng: 7.41697,
        locationSource: ReceiptLocationSource.PLACE,
        locationAccuracyM: null,
        metadata: { snippet: 'kept', place: { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' } },
      });
    });

    it('forgets the shop when the user then drops a pin by hand', async () => {
      repository.findOne.mockResolvedValue(
        buildReceipt({
          metadata: { place: { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' } },
          locationSource: ReceiptLocationSource.PLACE,
          locationLat: 43.7308,
          locationLng: 7.417,
        }),
      );

      const saved = await service.setManual(
        'receipt-1',
        'ws-1',
        { latitude: 43.8, longitude: 7.5 },
        'user-1',
      );

      expect(saved?.locationSource).toBe(ReceiptLocationSource.MANUAL);
      expect(saved?.metadata).not.toHaveProperty('place');
    });

    it('returns null for a receipt from another workspace', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.setManual('receipt-1', 'ws-other', { latitude: 1, longitude: 2 }, 'user-1'),
      ).resolves.toBeNull();
      expect(repository.save).not.toHaveBeenCalled();
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('resetToAuto', () => {
    it('drops the manual point and recomputes from stored data', async () => {
      repository.findOne.mockResolvedValue(
        buildReceipt({
          locationLat: 51.1,
          locationLng: 71.4,
          locationSource: ReceiptLocationSource.MANUAL,
          metadata: {
            captureLocation: { lat: 43.3, lng: 76.8, source: 'device', capturedAt: '2026-09-13' },
          },
        }),
      );

      const saved = await service.resetToAuto('receipt-1', 'ws-1', 'user-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'receipt-1', workspaceId: 'ws-1' },
      });
      expect(saved).toMatchObject({
        locationLat: 43.3,
        locationLng: 76.8,
        locationSource: ReceiptLocationSource.DEVICE,
      });
    });

    it('drops a picked shop together with its details', async () => {
      repository.findOne.mockResolvedValue(
        buildReceipt({
          locationLat: 43.7308,
          locationLng: 7.417,
          locationSource: ReceiptLocationSource.PLACE,
          metadata: { place: { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' } },
        }),
      );

      const saved = await service.resetToAuto('receipt-1', 'ws-1', 'user-1');

      expect(saved).toMatchObject({ locationLat: null, locationSource: null });
      expect(saved?.metadata).not.toHaveProperty('place');
    });

    it('returns null when the receipt is not in the workspace', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.resetToAuto('receipt-1', 'ws-other', 'user-1')).resolves.toBeNull();
    });
  });

  describe('audit', () => {
    it('logs a manual pin as a receipt update with the stored rounded point and the place', async () => {
      repository.findOne.mockResolvedValue(
        buildReceipt({ parsedData: { vendor: 'Magnum', merchantAddress: 'ул. Абая 10' } }),
      );

      await service.setManual(
        'receipt-1',
        'ws-1',
        { latitude: 43.238312345, longitude: 76.945398765 },
        'user-1',
      );

      expect(auditService.createEvent).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        actorType: 'user',
        actorId: 'user-1',
        entityType: 'receipt',
        entityId: 'receipt-1',
        action: 'update',
        diff: {
          before: { locationLat: null, locationLng: null, locationSource: null },
          after: {
            locationLat: 43.23831,
            locationLng: 76.9454,
            locationSource: ReceiptLocationSource.MANUAL,
          },
        },
        meta: { reason: 'location', change: 'manual', place: 'ул. Абая 10' },
      });
    });

    it('logs a picked shop by its name', async () => {
      repository.findOne.mockResolvedValue(
        buildReceipt({ parsedData: { vendor: 'Carrefour Monaco SAM' } }),
      );

      await service.setManual(
        'receipt-1',
        'ws-1',
        {
          latitude: 43.7308,
          longitude: 7.417,
          place: { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' },
        },
        'user-1',
      );

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          diff: expect.objectContaining({
            after: expect.objectContaining({ locationSource: ReceiptLocationSource.PLACE }),
          }),
          meta: { reason: 'location', change: 'place', place: 'Carrefour' },
        }),
      );
    });

    it('logs a reset with the previous manual point as before', async () => {
      repository.findOne.mockResolvedValue(
        buildReceipt({
          locationLat: 51.1,
          locationLng: 71.4,
          locationSource: ReceiptLocationSource.MANUAL,
        }),
      );

      await service.resetToAuto('receipt-1', 'ws-1', 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          action: 'update',
          diff: {
            before: {
              locationLat: 51.1,
              locationLng: 71.4,
              locationSource: ReceiptLocationSource.MANUAL,
            },
            after: { locationLat: null, locationLng: null, locationSource: null },
          },
          meta: expect.objectContaining({ change: 'reset' }),
        }),
      );
    });

    it('still returns the saved receipt when the audit write fails', async () => {
      repository.findOne.mockResolvedValue(buildReceipt());
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(
        service.setManual('receipt-1', 'ws-1', { latitude: 1, longitude: 2 }, 'user-1'),
      ).resolves.toMatchObject({ locationSource: ReceiptLocationSource.MANUAL });
    });
  });
});
