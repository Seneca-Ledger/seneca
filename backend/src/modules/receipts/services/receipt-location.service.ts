import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isValidCoordinatePair,
  roundCoordinate,
} from '../../../common/utils/capture-location.util';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { Receipt, ReceiptLocationSource } from '../../../entities/receipt.entity';
import { AuditService } from '../../audit/audit.service';
import { GeocodingService } from '../../geocoding/geocoding.service';

type PickedPlace = { name: string; category?: string | null; osmType: string; osmId: string };

/** Points the user chose; automatic detection never replaces them. */
const USER_SOURCES = new Set<ReceiptLocationSource | null>([
  ReceiptLocationSource.MANUAL,
  ReceiptLocationSource.PLACE,
]);

type ResolvedLocation = {
  lat: number;
  lng: number;
  source: ReceiptLocationSource;
  accuracyM: number | null;
};

@Injectable()
export class ReceiptLocationService {
  private readonly logger = new Logger(ReceiptLocationService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    private readonly geocodingService: GeocodingService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Resolves the point from what the receipt already carries. Mutates the
   * entity; the caller saves it. A point the user placed is never replaced.
   */
  async applyAutoLocation(receipt: Receipt): Promise<void> {
    if (USER_SOURCES.has(receipt.locationSource)) {
      return;
    }

    this.assign(receipt, await this.resolveAutoLocation(receipt));
  }

  async setManual(
    id: string,
    workspaceId: string,
    point: { latitude: number; longitude: number; place?: PickedPlace },
    userId: string,
  ): Promise<Receipt | null> {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }

    const before = locationSnapshot(receipt);
    this.assign(receipt, {
      lat: roundCoordinate(point.latitude),
      lng: roundCoordinate(point.longitude),
      source: point.place ? ReceiptLocationSource.PLACE : ReceiptLocationSource.MANUAL,
      accuracyM: null,
    });
    this.setPlace(receipt, point.place ?? null);
    const saved = await this.receiptRepository.save(receipt);
    await this.recordAudit(saved, before, userId, workspaceId, point.place ? 'place' : 'manual');
    return saved;
  }

  async resetToAuto(id: string, workspaceId: string, userId: string): Promise<Receipt | null> {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }

    const before = locationSnapshot(receipt);
    this.assign(receipt, await this.resolveAutoLocation(receipt));
    this.setPlace(receipt, null);
    const saved = await this.receiptRepository.save(receipt);
    await this.recordAudit(saved, before, userId, workspaceId, 'reset');
    return saved;
  }

  private setPlace(receipt: Receipt, place: PickedPlace | null): void {
    if (place) {
      receipt.metadata = {
        ...receipt.metadata,
        place: {
          name: place.name,
          category: place.category ?? null,
          osmType: place.osmType,
          osmId: place.osmId,
        },
      };
      return;
    }
    if (receipt.metadata?.place) {
      const { place: _dropped, ...rest } = receipt.metadata;
      receipt.metadata = rest;
    }
  }

  // Coordinates are the stored, already rounded ones; an audit failure never fails the edit.
  private async recordAudit(
    receipt: Receipt,
    before: Record<string, unknown>,
    userId: string,
    workspaceId: string,
    change: 'manual' | 'place' | 'reset',
  ): Promise<void> {
    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.RECEIPT,
        entityId: receipt.id,
        action: AuditAction.UPDATE,
        diff: { before, after: locationSnapshot(receipt) },
        meta: {
          reason: 'location',
          change,
          place:
            receipt.metadata?.place?.name ??
            receipt.parsedData?.merchantAddress ??
            receipt.parsedData?.vendor ??
            null,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for receipt ${receipt.id}: ${message}`);
    }
  }

  // Store address first: it answers "where was this bought". The photo and the
  // device only say where the receipt was scanned, which may well be at home.
  private async resolveAutoLocation(receipt: Receipt): Promise<ResolvedLocation | null> {
    const address = receipt.parsedData?.merchantAddress;
    if (address) {
      const point = await this.geocodingService.geocode(address);
      if (point) {
        return { ...point, source: ReceiptLocationSource.MERCHANT_ADDRESS, accuracyM: null };
      }
    }

    const capture = receipt.metadata?.captureLocation;
    if (capture && isValidCoordinatePair(capture.lat, capture.lng)) {
      return {
        lat: capture.lat,
        lng: capture.lng,
        source:
          capture.source === 'exif' ? ReceiptLocationSource.EXIF : ReceiptLocationSource.DEVICE,
        accuracyM: capture.accuracyM ?? null,
      };
    }

    return null;
  }

  private assign(receipt: Receipt, next: ResolvedLocation | null): void {
    const lat = next?.lat ?? null;
    const lng = next?.lng ?? null;
    const source = next?.source ?? null;
    const changed =
      (receipt.locationLat ?? null) !== lat ||
      (receipt.locationLng ?? null) !== lng ||
      (receipt.locationSource ?? null) !== source;

    receipt.locationLat = lat;
    receipt.locationLng = lng;
    receipt.locationSource = source;
    receipt.locationAccuracyM = next?.accuracyM ?? null;
    if (changed) {
      receipt.locationUpdatedAt = new Date();
    }
  }
}

function locationSnapshot(receipt: Receipt): Record<string, unknown> {
  return {
    locationLat: receipt.locationLat ?? null,
    locationLng: receipt.locationLng ?? null,
    locationSource: receipt.locationSource ?? null,
  };
}
